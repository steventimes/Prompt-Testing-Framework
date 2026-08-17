import test from 'node:test'
import assert from 'node:assert/strict'

import { compareRuns, scoreRun } from '../../src/lib/comparison.js'
import { presentGateMetric, presentGateReason } from '../../src/lib/gatePresentation.js'
import { evaluateRegressionGate, fingerprintCaseMatrix } from '../../src/lib/regressionGate.js'

// Source: tests/unit/comparison.unit.test.mjs
{
  test('综合评分奖励质量并惩罚延迟、成本和隐私风险', () => {
    const strong = scoreRun({ averageQualityScore: 0.9, averageResponseTimeMs: 300, totalCostUsd: 0.001, averagePrivacyRiskScore: 0 })
    const risky = scoreRun({ averageQualityScore: 0.92, averageResponseTimeMs: 900, totalCostUsd: 0.02, averagePrivacyRiskScore: 0.6 })

    assert.ok(strong > risky)
  })

  test('对比结果返回指标差值、胜方和接近时的平局', () => {
    const left = { metrics: { averageQualityScore: 0.86, averageResponseTimeMs: 320, totalCostUsd: 0, averagePrivacyRiskScore: 0 } }
    const right = { metrics: { averageQualityScore: 0.74, averageResponseTimeMs: 410, totalCostUsd: 0, averagePrivacyRiskScore: 0 } }
    assert.equal(compareRuns(left, right).winner, 'left')
    assert.equal(compareRuns(left, { metrics: { ...left.metrics } }).winner, 'tie')
  })

  test('质量证据未知时不产生综合分、质量差或胜方', () => {
    const measurable = { metrics: { averageQualityScore: 0.86, averageResponseTimeMs: 320, totalCostUsd: 0, averagePrivacyRiskScore: 0 } }
    const unknown = { metrics: { averageQualityScore: null, averageResponseTimeMs: 180, totalCostUsd: 0, averagePrivacyRiskScore: 0 } }

    assert.equal(scoreRun(unknown.metrics), null)
    assert.deepEqual(compareRuns(measurable, unknown), {
      leftScore: null,
      rightScore: null,
      winner: 'incomparable',
      deltas: {
        quality: null,
        assertionPassRate: 0,
        latencyMs: 140,
        costUsd: 0,
        privacyRisk: 0,
      },
    })
  })

  test('公式所用任一证据未知时不能把它当零选出 weighted winner', () => {
    const complete = { metrics: { averageQualityScore: 0.9, averageResponseTimeMs: 100, totalCostUsd: 0, averagePrivacyRiskScore: 0 } }
    for (const field of ['averageResponseTimeMs', 'totalCostUsd', 'averagePrivacyRiskScore']) {
      const unknown = { metrics: { ...complete.metrics, [field]: null } }
      const result = compareRuns(complete, unknown)
      assert.equal(scoreRun(unknown.metrics), null)
      assert.equal(result.winner, 'incomparable')
      assert.equal(result.leftScore, null)
      assert.equal(result.rightScore, null)
      const delta = field === 'averageResponseTimeMs' ? 'latencyMs' : field === 'totalCostUsd' ? 'costUsd' : 'privacyRisk'
      assert.equal(result.deltas[delta], null)
    }
    assert.equal(compareRuns(complete, { metrics: { ...complete.metrics } }).deltas.costUsd, 0)
  })
}

// Source: tests/unit/comparisonAssertions.unit.test.mjs
{
  test('相同测试套件下，断言通过率是发布门禁而非装饰指标', () => {
    const shared = {
      averageQualityScore: 0.8,
      averageResponseTimeMs: 300,
      totalCostUsd: 0,
      averagePrivacyRiskScore: 0,
    }
    const passing = { ...shared, totalAssertions: 4, assertionPassRate: 1 }
    const failing = { ...shared, totalAssertions: 4, assertionPassRate: 0.5 }

    assert.ok(scoreRun(passing) > scoreRun(failing))
    const comparison = compareRuns({ metrics: passing }, { metrics: failing })
    assert.equal(comparison.winner, 'left')
    assert.equal(comparison.deltas.assertionPassRate, 0.5)
  })
}

// Source: tests/unit/regressionGate.unit.test.mjs
{
  const cases = [{
    name: '退款答复',
    variables: { customer: '林女士', topic: '退款' },
    assertions: [{ type: 'CONTAINS', value: '安全' }],
  }]

  const comparableRun = (id, overrides = {}) => ({
    id,
    promptVersionId: id,
    promptId: 7,
    status: 'COMPLETED',
    datasetFingerprint: fingerprintCaseMatrix(cases),
    results: [{
      caseName: '退款答复',
      status: 'COMPLETED',
      aiResponse: '安全答复',
      qualityScore: 0.9,
      costUsd: 0,
      responseTimeMs: 120,
    }],
    ...overrides,
  })

  test('相同完整矩阵产生稳定指纹，修改用例、变量、断言或顺序都不可比较', () => {
    const original = fingerprintCaseMatrix(cases)
    const changedVariable = fingerprintCaseMatrix([{ ...cases[0], variables: { customer: '周先生', topic: '退款' } }])
    const changedAssertion = fingerprintCaseMatrix([{ ...cases[0], assertions: [{ type: 'CONTAINS', value: '三步' }] }])
    const twoCases = [...cases, { ...cases[0], name: '第二例' }]
    const changedOrder = fingerprintCaseMatrix([...twoCases].reverse())

    assert.match(original, /^[0-9a-f]{64}$/)
    assert.equal(fingerprintCaseMatrix(cases), original)
    assert.notEqual(changedVariable, original)
    assert.notEqual(changedAssertion, original)
    assert.notEqual(changedOrder, fingerprintCaseMatrix(twoCases))

    const response = evaluateRegressionGate(comparableRun(1), comparableRun(2, { datasetFingerprint: changedVariable }))
    assert.equal(response.verdict, 'INCOMPARABLE')
    assert.deepEqual(response.reasons, ['DATASET_FINGERPRINT_MISMATCH'])
  })

  test('不同 Prompt lineage 即使用同一矩阵也不可比较', () => {
    const response = evaluateRegressionGate(comparableRun(1), comparableRun(2, { promptId: 8 }))
    assert.equal(response.verdict, 'INCOMPARABLE')
    assert.deepEqual(response.reasons, ['DIFFERENT_PROMPTS'])
  })

  test('同矩阵完整证据在默认阈值内通过，并返回五项门禁证据', () => {
    const response = evaluateRegressionGate(comparableRun(1), comparableRun(2, {
      results: [{
        caseName: '退款答复',
        status: 'COMPLETED',
        aiResponse: '安全答复',
        qualityScore: 0.88,
        costUsd: 0,
        responseTimeMs: 130,
      }],
    }))

    assert.equal(response.verdict, 'PASSED')
    assert.equal(response.passed, true)
    assert.deepEqual(response.metrics.map((metric) => metric.name), [
      'CASE_PASS_RATE', 'AVERAGE_QUALITY_SCORE', 'QUALITY_COVERAGE', 'TOTAL_COST_USD', 'AVERAGE_LATENCY_MS',
    ])
  })

  test('候选新增失败即使仍满足较低通过率阈值也必须回归', () => {
    const baseline = comparableRun(1, {
      results: [
        { caseName: '第一例', status: 'FAILED', aiResponse: '安全答复', qualityScore: 0.9, costUsd: 0, responseTimeMs: 120 },
        { caseName: '第二例', status: 'COMPLETED', aiResponse: '安全答复', qualityScore: 0.9, costUsd: 0, responseTimeMs: 120 },
      ],
    })
    const candidate = comparableRun(2, {
      results: [
        { caseName: '第一例', status: 'COMPLETED', aiResponse: '安全答复', qualityScore: 0.9, costUsd: 0, responseTimeMs: 120 },
        { caseName: '第二例', status: 'FAILED', errorCode: 'ASSERTION_FAILED', aiResponse: '安全答复', qualityScore: 0.9, costUsd: 0, responseTimeMs: 120 },
      ],
    })

    const response = evaluateRegressionGate(baseline, candidate, { minCasePassRate: 0.5 })

    assert.equal(response.verdict, 'REGRESSED')
    assert.equal(response.passed, false)
    assert.deepEqual(response.newFailures, [{ index: 1, caseName: '第二例', errorCode: 'ASSERTION_FAILED' }])
    assert.ok(response.reasons.includes('NEW_CASE_FAILURES'))
  })

  test('质量覆盖率低于基线使用后端同名原因，并把基线覆盖率作为阈值', () => {
    const baseline = comparableRun(1, {
      results: [
        { caseName: '第一例', status: 'COMPLETED', aiResponse: '已生成', qualityScore: 0.9, costUsd: 0, responseTimeMs: 100 },
        { caseName: '第二例', status: 'COMPLETED', aiResponse: '已生成', qualityScore: null, costUsd: 0, responseTimeMs: 100 },
      ],
    })
    const candidate = comparableRun(2, {
      results: [
        { caseName: '第一例', status: 'COMPLETED', aiResponse: '已生成', qualityScore: 0.9, costUsd: 0, responseTimeMs: 100 },
        { caseName: '第二例', status: 'COMPLETED', aiResponse: '已生成', qualityScore: null, costUsd: 0, responseTimeMs: 100 },
      ],
    })
    const lowerCoverage = comparableRun(3, {
      results: [
        { caseName: '第一例', status: 'COMPLETED', aiResponse: '已生成', qualityScore: null, costUsd: 0, responseTimeMs: 100 },
        { caseName: '第二例', status: 'COMPLETED', aiResponse: '已生成', qualityScore: null, costUsd: 0, responseTimeMs: 100 },
      ],
    })

    assert.equal(evaluateRegressionGate(baseline, candidate).metrics[2].limit, 0.5)
    const response = evaluateRegressionGate(baseline, lowerCoverage)
    assert.equal(response.verdict, 'REGRESSED')
    assert.ok(response.reasons.includes('QUALITY_COVERAGE_BELOW_BASELINE'))
  })

  test('缺失质量、成本或延迟证据不会被当作零，基线缺失不可比较、候选缺失为回归', () => {
    const baselineMissing = comparableRun(1, {
      results: [{ caseName: '退款答复', status: 'COMPLETED', aiResponse: '已生成', qualityScore: null, costUsd: null, responseTimeMs: null }],
    })
    const candidate = comparableRun(2)
    const candidateMissing = comparableRun(2, {
      results: [{ caseName: '退款答复', status: 'COMPLETED', aiResponse: '已生成', qualityScore: null, costUsd: null, responseTimeMs: null }],
    })

    assert.equal(evaluateRegressionGate(baselineMissing, candidate).verdict, 'INCOMPARABLE')
    assert.equal(evaluateRegressionGate(comparableRun(1), candidateMissing).verdict, 'REGRESSED')
  })
}

// Source: tests/unit/gatePresentation.unit.test.mjs
{
  test('门禁原因转为具体中文，未知原因不裸露下划线代码', () => {
    assert.deepEqual(presentGateReason('QUALITY_COVERAGE_BELOW_BASELINE'), {
      text: '候选版本的质量评分覆盖率低于基线',
      code: 'QUALITY_COVERAGE_BELOW_BASELINE',
    })
    assert.equal(presentGateReason('SOMETHING_NEW').text, '未知门禁原因')
  })

  test('结构与指标证据缺失原因均有具体中文说明', () => {
    for (const code of [
      'RUN_NOT_FOUND',
      'BASELINE_CASE_PASS_RATE_UNAVAILABLE',
      'CANDIDATE_CASE_PASS_RATE_UNAVAILABLE',
      'BASELINE_AVERAGE_QUALITY_SCORE_UNAVAILABLE',
      'CANDIDATE_AVERAGE_QUALITY_SCORE_UNAVAILABLE',
      'BASELINE_QUALITY_COVERAGE_UNAVAILABLE',
      'CANDIDATE_QUALITY_COVERAGE_UNAVAILABLE',
      'BASELINE_TOTAL_COST_USD_UNAVAILABLE',
      'CANDIDATE_TOTAL_COST_USD_UNAVAILABLE',
      'BASELINE_AVERAGE_LATENCY_MS_UNAVAILABLE',
      'CANDIDATE_AVERAGE_LATENCY_MS_UNAVAILABLE',
    ]) {
      assert.notEqual(presentGateReason(code).text, '未知门禁原因')
    }
  })

  test('门禁指标正确格式化零值、阈值与缺失证据', () => {
    assert.deepEqual(presentGateMetric({
      name: 'TOTAL_COST_USD', baseline: 0, candidate: null, limit: 20, available: false, passed: false,
    }), {
      label: '总成本',
      baseline: '$0.0000',
      candidate: '—',
      baselineLabel: 'A · $0.0000',
      candidateLabel: 'B · —',
      limit: '最多增长 20.0%',
      status: '证据缺失',
    })
    assert.deepEqual(presentGateMetric({
      name: 'QUALITY_COVERAGE', baseline: 0.5, candidate: 0.5, limit: 0.5, available: true, passed: true,
    }), {
      label: '质量评分覆盖率',
      baseline: '50%',
      candidate: '50%',
      baselineLabel: 'A · 50%',
      candidateLabel: 'B · 50%',
      limit: '不得低于 50%',
      status: '通过',
    })
  })
}
