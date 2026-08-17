import { createApiError } from './apiContract.js'
import { evaluateAssertions, normalizeEvaluationCases } from './assertions.js'
import { analyzeTemplate, renderTemplate } from './promptTemplate.js'
import { summarizeWorkspace } from './workspaceAnalytics.js'
import { evaluateRegressionGate, fingerprintCaseMatrix } from './regressionGate.js'

const PROMPTS_KEY = 'ptf:mock:prompts:v2'
const RUNS_KEY = 'ptf:mock:test-runs:v2'
const SUITES_KEY = 'ptf:mock:test-suites:v1'
const LEGACY_PROMPTS_KEY = 'ptf_mock_prompts'
const LEGACY_RUNS_KEY = 'ptf_mock_test_runs'

const clone = (value) => JSON.parse(JSON.stringify(value))
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function readStorage(storage, key, fallback) {
  try {
    const raw = storage?.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // 私密浏览或容量不足时继续本次请求，页面仍可展示返回结果。
  }
}

function seedPrompts(now) {
  const iso = (daysAgo) => new Date(now() - daysAgo * 86_400_000).toISOString()
  return [
    {
      id: 1,
      name: '客服退款答复',
      description: '为一线客服生成可审查、克制且包含下一步的答复。',
      createdAt: iso(8),
      updatedAt: iso(1),
      versions: [
        { id: 11, promptId: 1, versionNumber: 1, createdAt: iso(8), content: '请回答客户的 {{question}}。' },
        { id: 12, promptId: 1, versionNumber: 2, createdAt: iso(1), content: '客户问题：{{question}}\n先确认诉求，再给出三步解决方案。' },
      ],
    },
    {
      id: 2,
      name: '发票异常分诊',
      description: '识别财务异常风险并给出处理责任人。',
      createdAt: iso(18),
      updatedAt: iso(4),
      versions: [
        { id: 21, promptId: 2, versionNumber: 1, createdAt: iso(18), content: '分析发票异常：{{case}}' },
        { id: 22, promptId: 2, versionNumber: 2, createdAt: iso(4), content: '按风险、原因、责任人分析：{{case}}' },
      ],
    },
    {
      id: 3,
      name: '销售通话摘要',
      description: '',
      createdAt: iso(3),
      updatedAt: iso(3),
      versions: [
        { id: 31, promptId: 3, versionNumber: 1, createdAt: iso(3), content: '提取痛点、异议和下一步：{{transcript}}' },
      ],
    },
  ]
}

function seedSuites(now) {
  const timestamp = new Date(now() - 2 * 86_400_000).toISOString()
  return [{
    id: 1,
    name: '客服发布门禁',
    description: '固定核心场景，在版本对比与发布前重复使用。',
    cases: [
      {
        name: '退款路径完整',
        variables: { question: '订单已取消，怎样申请退款？' },
        assertions: [
          { type: 'CONTAINS', value: '三步' },
          { type: 'MAX_LATENCY_MS', threshold: 500 },
          { type: 'MIN_QUALITY_SCORE', threshold: 0.7 },
        ],
      },
      {
        name: '敏感信息提醒',
        variables: { question: '请把结果发到 owner@example.com' },
        assertions: [{ type: 'NOT_CONTAINS', value: 'sk-' }],
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  }]
}

function hashText(value) {
  let hash = 2166136261
  for (const char of String(value)) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function inspectPrivacy(text) {
  const flags = []
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) flags.push('email')
  if (/\b(?:\d[ -]*?){13,16}\b/.test(text)) flags.push('credit-card')
  if (/\b(?:\+?\d{1,2}[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text)) flags.push('phone')
  if (/\bsk-[A-Za-z0-9]{10,}\b/.test(text)) flags.push('api-key')
  return { riskScore: Math.min(1, flags.length * 0.25), flags }
}

function evaluateCase(promptContent, testCase, provider, modelName) {
  const normalizedCase = normalizeEvaluationCases([testCase])[0]
  const input = normalizedCase.variables
  const analysis = analyzeTemplate(promptContent, input)
  if (analysis.missingVariables.length > 0) {
    return {
      caseName: normalizedCase.name,
      inputVariables: input,
      status: 'FAILED',
      errorCode: 'PROMPT_VARIABLES_MISSING',
      errorMessage: `缺少 Prompt 变量: ${analysis.missingVariables.join(', ')}`,
      aiResponse: null,
      responseTimeMs: null,
      tokenCount: null,
      costUsd: null,
      qualityScore: null,
      assertionPassed: null,
      assertionResults: [],
      privacyRiskScore: null,
      privacyFlags: [],
      mcpCalls: [],
    }
  }

  const rendered = renderTemplate(promptContent, input)
  const fingerprint = hashText(`${rendered}|${provider}|${modelName}`)
  const aiResponse = `[MOCK] 模板渲染与执行已完成。\n\n${rendered}`
  const privacy = inspectPrivacy(`${rendered} ${aiResponse}`)
  const responseTimeMs = 180 + (fingerprint % 241)
  const qualityScore = Number((0.7 + (fingerprint % 21) / 100).toFixed(2))
  const assertionEvaluation = evaluateAssertions({
    output: aiResponse,
    responseTimeMs,
    costUsd: 0,
    qualityScore,
    assertions: normalizedCase.assertions,
  })

  return {
    caseName: normalizedCase.name,
    inputVariables: input,
    status: assertionEvaluation.passed ? 'COMPLETED' : 'FAILED',
    errorCode: assertionEvaluation.passed ? null : 'ASSERTION_FAILED',
    errorMessage: assertionEvaluation.passed ? null : '输出未通过全部声明式断言',
    aiResponse,
    responseTimeMs,
    tokenCount: Math.max(1, Math.floor((rendered.length + aiResponse.length) / 4)),
    costUsd: 0,
    qualityScore,
    assertionPassed: assertionEvaluation.passed,
    assertionResults: assertionEvaluation.results,
    privacyRiskScore: privacy.riskScore,
    privacyFlags: privacy.flags,
    mcpCalls: [
      { toolName: 'mcp.prompt.resolve', durationMs: 12, status: 'ok', dataAccess: 'prompt-template' },
      { toolName: 'mcp.variable.expand', durationMs: 9, status: 'ok', dataAccess: 'inputs' },
    ],
  }
}

function hasMeasuredNumber(value) {
  return value != null && value !== '' && Number.isFinite(Number(value))
}

export function calculateMetrics(results) {
  const completed = results.filter((result) => result.status === 'COMPLETED')
  const executed = results.filter((result) => result.aiResponse != null || result.status === 'COMPLETED')
  const sum = (field) => executed.reduce((total, result) => total + Number(result[field] || 0), 0)
  const average = (field) => executed.length ? sum(field) / executed.length : 0
  const scoredQuality = executed.filter((result) => hasMeasuredNumber(result.qualityScore))
  const assertionResults = results.flatMap((result) => result.assertionResults || [])
  const passedAssertions = assertionResults.filter((result) => result.passed).length
  return {
    averageResponseTimeMs: average('responseTimeMs'),
    averageQualityScore: scoredQuality.length
      ? scoredQuality.reduce((total, result) => total + Number(result.qualityScore), 0) / scoredQuality.length
      : null,
    qualityScoredCases: scoredQuality.length,
    qualityCoverage: executed.length ? scoredQuality.length / executed.length : 0,
    totalTokens: sum('tokenCount'),
    totalCostUsd: sum('costUsd'),
    completedCases: completed.length,
    failedCases: results.length - completed.length,
    averagePrivacyRiskScore: average('privacyRiskScore'),
    totalPrivacyFindings: executed.reduce((total, result) => total + result.privacyFlags.length, 0),
    totalAssertions: assertionResults.length,
    passedAssertions,
    failedAssertions: assertionResults.length - passedAssertions,
    assertionPassRate: assertionResults.length ? passedAssertions / assertionResults.length : 0,
  }
}

function resolveRunStatus(results) {
  const completed = results.filter((result) => result.status === 'COMPLETED').length
  if (completed === results.length) return 'COMPLETED'
  return completed === 0 ? 'FAILED' : 'PARTIAL'
}

function asQuickResult(result) {
  const { privacyRiskScore, privacyFlags, ...quickResult } = result
  return {
    ...quickResult,
    privacySummary: privacyRiskScore === null ? null : { riskScore: privacyRiskScore, flags: privacyFlags },
  }
}

function requestCases(body, suites, fail, path) {
  if (body.testSuiteId != null) {
    const suite = suites.find((item) => Number(item.id) === Number(body.testSuiteId))
    if (!suite) fail(404, 'RESOURCE_NOT_FOUND', `TestSuite not found: ${body.testSuiteId}`, path)
    return suite.cases
  }
  return normalizeEvaluationCases(body.testCases || body.testInputs || [])
}

export function createMockApi({
  persistentStorage,
  sessionStorage,
  now = Date.now,
  latencyMs = 120,
} = {}) {
  function migrateAndSeed() {
    let prompts = readStorage(persistentStorage, PROMPTS_KEY, null)
    if (!Array.isArray(prompts)) {
      prompts = readStorage(persistentStorage, LEGACY_PROMPTS_KEY, null)
      if (!Array.isArray(prompts) || prompts.length === 0) prompts = seedPrompts(now)
      writeStorage(persistentStorage, PROMPTS_KEY, prompts)
      try { persistentStorage?.removeItem(LEGACY_PROMPTS_KEY) } catch { /* 保留当前会话可用性。 */ }
    }

    let runs = readStorage(sessionStorage, RUNS_KEY, null)
    if (!Array.isArray(runs)) {
      runs = readStorage(sessionStorage, LEGACY_RUNS_KEY, [])
      writeStorage(sessionStorage, RUNS_KEY, Array.isArray(runs) ? runs : [])
      try { sessionStorage?.removeItem(LEGACY_RUNS_KEY) } catch { /* 保留当前会话可用性。 */ }
    }

    const suites = readStorage(persistentStorage, SUITES_KEY, null)
    if (!Array.isArray(suites)) writeStorage(persistentStorage, SUITES_KEY, seedSuites(now))
  }

  function fail(status, code, message, path, fieldErrors = {}) {
    throw createApiError(status, { code, message, path, fieldErrors }, path)
  }

  function findVersion(prompts, versionId) {
    return prompts.flatMap((prompt) => prompt.versions || [])
      .find((version) => Number(version.id) === Number(versionId))
  }

  async function request(rawPath, options = {}) {
    migrateAndSeed()
    if (latencyMs > 0) await wait(latencyMs)

    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
    const method = (options.method || 'GET').toUpperCase()
    const body = options.body || {}
    const prompts = readStorage(persistentStorage, PROMPTS_KEY, [])
    const suites = readStorage(persistentStorage, SUITES_KEY, [])
    const runs = readStorage(sessionStorage, RUNS_KEY, [])

    if (path === '/workspace/summary' && method === 'GET') return clone(summarizeWorkspace(prompts, now()))
    if (path === '/prompts' && method === 'GET') return clone(prompts)

    if (path === '/prompts' && method === 'POST') {
      if (!String(body.name || '').trim()) fail(400, 'VALIDATION_FAILED', 'Request validation failed', path, { name: 'Prompt title is required' })
      if (!String(body.initialContent || '').trim()) fail(400, 'VALIDATION_FAILED', 'Request validation failed', path, { initialContent: 'Initial prompt is required' })
      const id = Math.max(0, ...prompts.map((prompt) => Number(prompt.id))) + 1
      const createdAt = new Date(now()).toISOString()
      const prompt = {
        id,
        name: String(body.name).trim(),
        description: String(body.description || '').trim(),
        createdAt,
        updatedAt: createdAt,
        versions: [{ id: id * 100 + 1, promptId: id, versionNumber: 1, content: String(body.initialContent).trim(), createdAt }],
      }
      writeStorage(persistentStorage, PROMPTS_KEY, [prompt, ...prompts])
      return clone(prompt)
    }

    const versionMatch = path.match(/^\/prompts\/(\d+)\/versions$/)
    if (versionMatch && method === 'POST') {
      const promptId = Number(versionMatch[1])
      const prompt = prompts.find((item) => Number(item.id) === promptId)
      if (!prompt) fail(404, 'RESOURCE_NOT_FOUND', `Prompt not found: ${promptId}`, path)
      if (!String(body.content || '').trim()) fail(400, 'VALIDATION_FAILED', 'Request validation failed', path, { content: 'Version content is required' })
      const versionNumber = Math.max(0, ...prompt.versions.map((version) => Number(version.versionNumber))) + 1
      const version = {
        id: promptId * 100 + versionNumber,
        promptId,
        versionNumber,
        content: String(body.content).trim(),
        createdAt: new Date(now()).toISOString(),
      }
      const nextPrompts = prompts.map((item) => item.id === promptId
        ? { ...item, updatedAt: version.createdAt, versions: [...item.versions, version] }
        : item)
      writeStorage(persistentStorage, PROMPTS_KEY, nextPrompts)
      return clone(version)
    }

    const promptMatch = path.match(/^\/prompts\/(\d+)$/)
    if (promptMatch) {
      const promptId = Number(promptMatch[1])
      const prompt = prompts.find((item) => Number(item.id) === promptId)
      if (!prompt) fail(404, 'RESOURCE_NOT_FOUND', `Prompt not found: ${promptId}`, path)
      if (method === 'GET') return clone(prompt)
      if (method === 'PUT') {
        const nextPrompt = {
          ...prompt,
          name: String(body.name || '').trim(),
          description: String(body.description || '').trim(),
          updatedAt: new Date(now()).toISOString(),
        }
        if (!nextPrompt.name) fail(400, 'VALIDATION_FAILED', 'Request validation failed', path, { name: 'Prompt title is required' })
        writeStorage(persistentStorage, PROMPTS_KEY, prompts.map((item) => item.id === promptId ? nextPrompt : item))
        return clone(nextPrompt)
      }
      if (method === 'DELETE') {
        const versionIds = new Set((prompt.versions || []).map((version) => Number(version.id)))
        writeStorage(persistentStorage, PROMPTS_KEY, prompts.filter((item) => item.id !== promptId))
        writeStorage(sessionStorage, RUNS_KEY, runs.filter((run) => !versionIds.has(Number(run.promptVersionId))))
        return null
      }
    }

    if (path === '/test-suites' && method === 'GET') {
      return clone([...suites].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt)))
    }

    if (path === '/test-suites' && method === 'POST') {
      const name = String(body.name || '').trim()
      if (!name) fail(400, 'VALIDATION_FAILED', 'Request validation failed', path, { name: 'Test suite name is required' })
      if (!Array.isArray(body.cases) || body.cases.length === 0) fail(400, 'VALIDATION_FAILED', 'Request validation failed', path, { cases: 'At least one test case is required' })
      const timestamp = new Date(now()).toISOString()
      const suite = {
        id: Math.max(0, ...suites.map((item) => Number(item.id))) + 1,
        name,
        description: String(body.description || '').trim(),
        cases: normalizeEvaluationCases(body.cases),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      writeStorage(persistentStorage, SUITES_KEY, [suite, ...suites])
      return clone(suite)
    }

    const suiteMatch = path.match(/^\/test-suites\/(\d+)$/)
    if (suiteMatch) {
      const suiteId = Number(suiteMatch[1])
      const suite = suites.find((item) => Number(item.id) === suiteId)
      if (!suite) fail(404, 'RESOURCE_NOT_FOUND', `TestSuite not found: ${suiteId}`, path)
      if (method === 'GET') return clone(suite)
      if (method === 'PUT') {
        const nextSuite = {
          ...suite,
          name: String(body.name || '').trim(),
          description: String(body.description || '').trim(),
          cases: normalizeEvaluationCases(body.cases),
          updatedAt: new Date(now()).toISOString(),
        }
        if (!nextSuite.name) fail(400, 'VALIDATION_FAILED', 'Request validation failed', path, { name: 'Test suite name is required' })
        if (!nextSuite.cases.length) fail(400, 'VALIDATION_FAILED', 'Request validation failed', path, { cases: 'At least one test case is required' })
        writeStorage(persistentStorage, SUITES_KEY, suites.map((item) => item.id === suiteId ? nextSuite : item))
        return clone(nextSuite)
      }
      if (method === 'DELETE') {
        writeStorage(persistentStorage, SUITES_KEY, suites.filter((item) => item.id !== suiteId))
        writeStorage(sessionStorage, RUNS_KEY, runs.map((run) => Number(run.testSuiteId) === suiteId ? { ...run, testSuiteId: null } : run))
        return null
      }
    }

    if (path === '/quick-test' && method === 'POST') {
      const cases = requestCases(body, suites, fail, path)
      const results = cases.map((testCase) =>
        evaluateCase(body.promptContent, testCase, body.aiProvider, body.modelName))
      return {
        id: `quick-${now()}`,
        status: resolveRunStatus(results),
        executedAt: new Date(now()).toISOString(),
        promptContent: body.promptContent,
        aiProvider: body.aiProvider,
        modelName: body.modelName,
        results: results.map(asQuickResult),
        metrics: calculateMetrics(results),
      }
    }

    if (path === '/test-runs' && method === 'POST') {
      const version = findVersion(prompts, body.promptVersionId)
      if (!version) fail(404, 'RESOURCE_NOT_FOUND', `PromptVersion not found: ${body.promptVersionId}`, path)
      const id = Math.max(1000, ...runs.map((run) => Number(run.id) || 0)) + 1
      const cases = requestCases(body, suites, fail, path)
      const results = cases.map((testCase, index) => ({
        id: id * 100 + index + 1,
        testRunId: id,
        ...evaluateCase(version.content, testCase, body.aiProvider, body.modelName),
        createdAt: new Date(now()).toISOString(),
      }))
      const run = {
        id,
        promptVersionId: Number(body.promptVersionId),
        promptId: version.promptId,
        testSuiteId: body.testSuiteId == null ? null : Number(body.testSuiteId),
        datasetFingerprint: fingerprintCaseMatrix(cases),
        aiProvider: body.aiProvider,
        modelName: body.modelName,
        startedAt: new Date(now()).toISOString(),
        completedAt: new Date(now()).toISOString(),
        status: resolveRunStatus(results),
        results,
        metrics: calculateMetrics(results),
      }
      writeStorage(sessionStorage, RUNS_KEY, [run, ...runs])
      return clone(run)
    }

    const regressionGateMatch = path.match(/^\/test-runs\/(\d+)\/regression-gate$/)
    if (regressionGateMatch && method === "POST") {
      const candidateRunId = Number(regressionGateMatch[1])
      const candidate = runs.find((run) => Number(run.id) === candidateRunId)
      const baseline = runs.find((run) => Number(run.id) === Number(body.baselineRunId))
      if (!candidate) fail(404, "RESOURCE_NOT_FOUND", `TestRun not found: ${candidateRunId}`, path)
      if (!baseline) fail(404, "RESOURCE_NOT_FOUND", `TestRun not found: ${body.baselineRunId}`, path)
      const candidateVersion = findVersion(prompts, candidate.promptVersionId)
      const baselineVersion = findVersion(prompts, baseline.promptVersionId)
      return clone(evaluateRegressionGate(
        { ...baseline, promptId: baselineVersion?.promptId },
        { ...candidate, promptId: candidateVersion?.promptId },
        body.gates,
      ))
    }

    const historyMatch = path.match(/^\/test-runs\/version\/(\d+)$/)
    if (historyMatch && method === 'GET') {
      return clone(runs.filter((run) => Number(run.promptVersionId) === Number(historyMatch[1])))
    }

    const runMatch = path.match(/^\/test-runs\/(\d+)$/)
    if (runMatch && method === 'GET') {
      const run = runs.find((item) => Number(item.id) === Number(runMatch[1]))
      if (!run) fail(404, 'RESOURCE_NOT_FOUND', `TestRun not found: ${runMatch[1]}`, path)
      return clone(run)
    }

    fail(404, 'MOCK_ENDPOINT_NOT_FOUND', `Mock endpoint not implemented: ${method} ${path}`, path)
  }

  return { request }
}
