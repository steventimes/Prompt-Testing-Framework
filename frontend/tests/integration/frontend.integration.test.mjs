import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateMetrics, createMockApi } from '../../src/lib/mockApi.js'
import { average, clamp, ensureLeadingSlash } from '../../src/lib/mockMath.js'

// Source: tests/integration/mockMath.integration.test.mjs
{
  const normalizeScores = (scores) => {
    const mean = average(scores)
    const bounded = clamp(mean, 0, 100)
    return {
      endpoint: ensureLeadingSlash('scores/summary'),
      mean,
      bounded,
    }
  }

  test('integration: composed workflow returns stable endpoint and bounded aggregate', () => {
    const result = normalizeScores([40, 50, 200])
    assert.equal(result.endpoint, '/scores/summary')
    assert.equal(result.mean, (40 + 50 + 200) / 3)
    assert.equal(result.bounded, 96.66666666666667)
  })

  test('integration: empty score list degrades safely through composition', () => {
    const result = normalizeScores([])
    assert.equal(result.endpoint, '/scores/summary')
    assert.equal(result.mean, 0)
    assert.equal(result.bounded, 0)
  })
}

// Source: tests/integration/assertionFailureMetrics.mockApi.test.mjs
{
  class MemoryStorage {
    #values = new Map()
    getItem(key) { return this.#values.get(key) ?? null }
    setItem(key, value) { this.#values.set(key, String(value)) }
    removeItem(key) { this.#values.delete(key) }
  }

  test('Mock 与真实 API 一样在断言失败时保留生成指标', async () => {
    const api = createMockApi({
      persistentStorage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
      now: () => Date.parse('2026-08-10T10:00:00Z'),
      latencyMs: 0,
    })

    const result = await api.request('/quick-test', {
      method: 'POST',
      body: {
        promptContent: '回答 {{topic}}',
        aiProvider: 'openai',
        modelName: 'deterministic-v1',
        testCases: [{
          name: '必然失败的断言',
          variables: { topic: '指标' },
          assertions: [{ type: 'CONTAINS', value: '不会出现' }],
        }],
      },
    })

    assert.equal(result.status, 'FAILED')
    assert.ok(result.metrics.averageResponseTimeMs > 0)
    assert.ok(result.metrics.totalTokens > 0)
    assert.equal(result.metrics.completedCases, 0)
    assert.equal(result.metrics.failedCases, 1)
  })
}

// Source: tests/integration/mockApi.contract.test.mjs
{
  class MemoryStorage {
    #values = new Map()

    getItem(key) {
      return this.#values.get(key) ?? null
    }

    setItem(key, value) {
      this.#values.set(key, String(value))
    }

    removeItem(key) {
      this.#values.delete(key)
    }
  }

  test('mock API 与真实 CRUD、运行和历史回放契约一致', async () => {
    const api = createMockApi({
      persistentStorage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
      now: () => Date.parse('2026-08-10T08:00:00Z'),
      latencyMs: 0,
    })

    const created = await api.request('/prompts', {
      method: 'POST',
      body: {
        name: ' 退款答复 ',
        description: ' 面向一线客服 ',
        initialContent: '为 {{customer}} 回复：{topic}',
      },
    })
    assert.equal(created.name, '退款答复')
    assert.equal(created.versions[0].versionNumber, 1)

    const updated = await api.request(`/prompts/${created.id}`, {
      method: 'PUT',
      body: { name: '退款答复助手', description: '升级后的说明' },
    })
    assert.equal(updated.name, '退款答复助手')

    const version = await api.request(`/prompts/${created.id}/versions`, {
      method: 'POST',
      body: { content: '为 {{customer}} 回复：{topic}。语气：{{tone}}' },
    })
    assert.equal(version.versionNumber, 2)

    const run = await api.request('/test-runs', {
      method: 'POST',
      body: {
        promptVersionId: version.id,
        aiProvider: 'mock',
        modelName: 'deterministic-v1',
        testInputs: [
          { customer: '林女士', topic: '退款', tone: '克制' },
          { customer: '周先生', topic: '账单' },
        ],
      },
    })

    assert.equal(run.status, 'PARTIAL')
    assert.equal(run.results[0].status, 'COMPLETED')
    assert.equal(run.results[1].errorCode, 'PROMPT_VARIABLES_MISSING')
    assert.equal(run.metrics.completedCases, 1)
    assert.equal(run.metrics.failedCases, 1)

    const history = await api.request(`/test-runs/version/${version.id}`)
    const replay = await api.request(`/test-runs/${run.id}`)
    assert.equal(history.length, 1)
    assert.deepEqual(replay.results, run.results)
  })
}

// Source: tests/integration/qualityEvidence.mockApi.test.mjs
{
  class MemoryStorage {
    #values = new Map()
    getItem(key) { return this.#values.get(key) ?? null }
    setItem(key, value) { this.#values.set(key, String(value)) }
    removeItem(key) { this.#values.delete(key) }
  }

  function mockApi() {
    return createMockApi({
      persistentStorage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
      now: () => Date.parse('2026-08-13T08:00:00Z'),
      latencyMs: 0,
    })
  }

  test('没有生成响应时质量均值为未知，并显式报告零覆盖率', async () => {
    const result = await mockApi().request('/quick-test', {
      method: 'POST',
      body: {
        promptContent: '回答 {{topic}}',
        aiProvider: 'mock',
        modelName: 'deterministic-v1',
        testCases: [{ name: '缺失变量', variables: {}, assertions: [] }],
      },
    })

    assert.equal(result.metrics.averageQualityScore, null)
    assert.equal(result.metrics.qualityScoredCases, 0)
    assert.equal(result.metrics.qualityCoverage, 0)
  })

  test('部分质量分只聚合已评分执行用例，并报告实际覆盖率', () => {
    const metrics = calculateMetrics([
      { status: 'COMPLETED', aiResponse: '已生成', qualityScore: 0.8, responseTimeMs: 100, tokenCount: 1, costUsd: 0, privacyRiskScore: 0, privacyFlags: [], assertionResults: [] },
      { status: 'FAILED', aiResponse: '已生成但裁判不可用', qualityScore: null, responseTimeMs: 100, tokenCount: 1, costUsd: null, privacyRiskScore: 0, privacyFlags: [], assertionResults: [] },
    ])

    assert.equal(metrics.qualityScoredCases, 1)
    assert.equal(metrics.qualityCoverage, 0.5)
    assert.equal(metrics.averageQualityScore, 0.8)
  })
}

// Source: tests/integration/regressionGate.mockApi.test.mjs
{
  class MemoryStorage {
    #values = new Map()
    getItem(key) { return this.#values.get(key) ?? null }
    setItem(key, value) { this.#values.set(key, String(value)) }
    removeItem(key) { this.#values.delete(key) }
  }

  test('mock 门禁路由以左侧为基线，持久化矩阵指纹并把新增失败判为回归', async () => {
    const api = createMockApi({
      persistentStorage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
      now: () => Date.parse('2026-08-13T12:00:00Z'),
      latencyMs: 0,
    })
    const prompt = await api.request('/prompts', {
      method: 'POST',
      body: { name: '发布门禁', initialContent: '安全答复 {{topic}}' },
    })
    const challenger = await api.request(`/prompts/${prompt.id}/versions`, {
      method: 'POST',
      body: { content: '普通答复 {{topic}}' },
    })
    const matrix = [{ name: '安全输出', variables: { topic: '退款' }, assertions: [{ type: 'CONTAINS', value: '安全' }] }]
    const baseline = await api.request('/test-runs', {
      method: 'POST',
      body: { promptVersionId: prompt.versions[0].id, aiProvider: 'mock', modelName: 'deterministic-v1', testCases: matrix },
    })
    const candidate = await api.request('/test-runs', {
      method: 'POST',
      body: { promptVersionId: challenger.id, aiProvider: 'mock', modelName: 'deterministic-v1', testCases: matrix },
    })

    assert.match(baseline.datasetFingerprint, /^[0-9a-f]{64}$/)
    assert.equal(candidate.datasetFingerprint, baseline.datasetFingerprint)
    const gate = await api.request(`/test-runs/${candidate.id}/regression-gate`, {
      method: 'POST',
      body: { baselineRunId: baseline.id },
    })

    assert.equal(gate.baselineRunId, baseline.id)
    assert.equal(gate.candidateRunId, candidate.id)
    assert.equal(gate.verdict, 'REGRESSED')
    assert.equal(gate.passed, false)
    assert.equal(gate.newFailures.length, 1)
  })
}

// Source: tests/integration/testSuites.mockApi.contract.test.mjs
{
  class MemoryStorage {
    #values = new Map()

    getItem(key) {
      return this.#values.get(key) ?? null
    }

    setItem(key, value) {
      this.#values.set(key, String(value))
    }

    removeItem(key) {
      this.#values.delete(key)
    }
  }

  test('测试套件 CRUD 与同套件运行保持真实 API 契约', async () => {
    const api = createMockApi({
      persistentStorage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
      now: () => Date.parse('2026-08-10T09:30:00Z'),
      latencyMs: 0,
    })

    const suite = await api.request('/test-suites', {
      method: 'POST',
      body: {
        name: '退款回归集',
        description: '发布前固定挑战集',
        cases: [{
          name: '输出必须完成渲染',
          variables: { question: '怎样退款？' },
          assertions: [
            { type: 'CONTAINS', value: '[MOCK]' },
            { type: 'MAX_LATENCY_MS', threshold: 500 },
          ],
        }],
      },
    })

    assert.ok(suite.id)
    assert.equal((await api.request('/test-suites')).some((item) => item.id === suite.id), true)

    const run = await api.request('/test-runs', {
      method: 'POST',
      body: {
        promptVersionId: 12,
        testSuiteId: suite.id,
        aiProvider: 'openai',
        modelName: 'deterministic-v1',
      },
    })

    assert.equal(run.testSuiteId, suite.id)
    assert.equal(run.status, 'COMPLETED')
    assert.equal(run.results[0].caseName, '输出必须完成渲染')
    assert.equal(run.results[0].assertionResults.length, 2)
    assert.equal(run.metrics.assertionPassRate, 1)

    const updated = await api.request(`/test-suites/${suite.id}`, {
      method: 'PUT',
      body: { ...suite, name: '退款发布门禁' },
    })
    assert.equal(updated.name, '退款发布门禁')

    await api.request(`/test-suites/${suite.id}`, { method: 'DELETE' })
    await assert.rejects(
      () => api.request(`/test-suites/${suite.id}`),
      (error) => error.status === 404,
    )
  })
}
