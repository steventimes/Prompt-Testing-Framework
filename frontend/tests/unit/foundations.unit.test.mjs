import test from 'node:test'
import assert from 'node:assert/strict'

import { api } from '../../src/lib/api.js'
import { ApiError, createApiError } from '../../src/lib/apiContract.js'
import { createEvaluationCase, evaluateAssertions, normalizeEvaluationCases } from '../../src/lib/assertions.js'
import { createComparisonPlan } from '../../src/lib/comparisonPlan.js'
import { formatCost, formatDuration, formatNumber } from '../../src/lib/format.js'
import { average, clamp, ensureLeadingSlash } from '../../src/lib/mockMath.js'
import { analyzeTemplate, renderTemplate } from '../../src/lib/promptTemplate.js'

// Source: tests/unit/mockMath.unit.test.mjs
{
  test('unit: average returns 0 for non-array and empty inputs', () => {
    assert.equal(average(), 0)
    assert.equal(average(null), 0)
    assert.equal(average([]), 0)
  })

  test('unit: average coerces values using Number(value || 0)', () => {
    assert.equal(average([1, '2', 3]), 2)
    assert.equal(average(['', false, 3]), 1)
  })

  test('unit: clamp bounds values and returns min for NaN-like values', () => {
    assert.equal(clamp(5, 0, 10), 5)
    assert.equal(clamp(-5, 0, 10), 0)
    assert.equal(clamp(99, 0, 10), 10)
    assert.equal(clamp('not-a-number', -2, 2), -2)
  })

  test('unit: ensureLeadingSlash adds slash exactly when needed', () => {
    assert.equal(ensureLeadingSlash('abc'), '/abc')
    assert.equal(ensureLeadingSlash('/abc'), '/abc')
    assert.equal(ensureLeadingSlash(''), '/')
  })
}

// Source: tests/unit/format.unit.test.mjs
{
  test('未知数值显示占位符，合法零值仍保留为零', () => {
    assert.equal(formatNumber(null, 2), '—')
    assert.equal(formatNumber(undefined, 2), '—')
    assert.equal(formatNumber('', 2), '—')
    assert.equal(formatNumber(0, 2), '0.00')

    assert.equal(formatCost(null), '—')
    assert.equal(formatCost(undefined), '—')
    assert.equal(formatCost(''), '—')
    assert.equal(formatCost(0), '$0.0000')
  })

  test('未知时长保持未知，合法零毫秒不会伪装成缺失', () => {
    assert.equal(formatDuration(null), '—')
    assert.equal(formatDuration(undefined), '—')
    assert.equal(formatDuration(''), '—')
    assert.equal(formatDuration(0), '0 ms')
    assert.equal(formatDuration(125.6), '126 ms')
  })
}

// Source: tests/unit/promptTemplate.unit.test.mjs
{
  test('模板变量按首次出现顺序去重，并支持两种语法', () => {
    const analysis = analyzeTemplate(
      '为 {{ customer }} 回复 {topic}，再次引用 {{customer}} 与 {tone}',
      { customer: '林女士', topic: '退款' },
    )

    assert.deepEqual(analysis.variables, ['customer', 'topic', 'tone'])
    assert.deepEqual(analysis.missingVariables, ['tone'])
  })

  test('模板渲染保留缺失变量，并安全处理替换值中的美元符号', () => {
    const rendered = renderTemplate('账单 {{amount}}，备注 {note}，缺少 {{missing}}', {
      amount: '$12.00',
      note: '$& should stay literal',
    })

    assert.equal(rendered, '账单 $12.00，备注 $& should stay literal，缺少 {{missing}}')
  })
}

// Source: tests/unit/assertions.unit.test.mjs
{
  test('创建用例时保留命名、变量和默认断言结构', () => {
    assert.deepEqual(createEvaluationCase(['topic', 'tone'], 2), {
      name: '用例 03',
      variables: { topic: '', tone: '' },
      assertions: [],
    })
  })

  test('旧变量 Map 会被标准化为高级用例且不会丢字段', () => {
    assert.deepEqual(normalizeEvaluationCases([{ topic: '退款' }], ['topic']), [{
      name: '用例 01',
      variables: { topic: '退款' },
      assertions: [],
    }])
  })

  test('声明式断言返回逐条证据并且不短路', () => {
    const evaluation = evaluateAssertions({
      output: '{"answer":"三步方案"}',
      responseTimeMs: 240,
      costUsd: 0.001,
      qualityScore: 0.82,
      assertions: [
        { type: 'CONTAINS', value: '三步' },
        { type: 'REGEX', value: '^never$' },
        { type: 'JSON_VALID' },
        { type: 'MAX_LATENCY_MS', threshold: 300 },
        { type: 'MIN_QUALITY_SCORE', threshold: 0.9 },
      ],
    })

    assert.equal(evaluation.passed, false)
    assert.equal(evaluation.results.length, 5)
    assert.deepEqual(evaluation.results.map((result) => result.passed), [true, false, true, true, false])
    assert.match(evaluation.results[4].message, /质量/)
  })

  test('空文本、空指标和负阈值与真实 API 一样返回失败证据', () => {
    const evaluation = evaluateAssertions({
      output: 'response',
      responseTimeMs: null,
      costUsd: null,
      qualityScore: null,
      assertions: [
        { type: 'CONTAINS', value: '' },
        { type: 'NOT_CONTAINS', value: '  ' },
        { type: 'REGEX', value: '' },
        { type: 'MAX_LATENCY_MS', threshold: null },
        { type: 'MAX_COST_USD', threshold: -1 },
        { type: 'MIN_QUALITY_SCORE' },
      ],
    })

    assert.equal(evaluation.passed, false)
    assert.deepEqual(evaluation.results.map((result) => result.passed), [false, false, false, false, false, false])
  })
}

// Source: tests/unit/comparisonPlan.unit.test.mjs
{
  test('对比计划冻结版本、模型和完整用例矩阵，避免异步完成后标签漂移', () => {
    const cases = [{ name: '退款', variables: { topic: '退款' }, assertions: [{ type: 'CONTAINS', value: '三步' }] }]
    const plan = createComparisonPlan({
      leftVersion: { id: 11, versionNumber: 1 },
      rightVersion: { id: 12, versionNumber: 2 },
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      testCases: cases,
    })
    cases[0].variables.topic = '被外部修改'

    assert.deepEqual(plan.leftRequest, {
      promptVersionId: 11,
      aiProvider: 'openai',
      modelName: 'gpt-4o-mini',
      testCases: [{ name: '退款', variables: { topic: '退款' }, assertions: [{ type: 'CONTAINS', value: '三步' }] }],
    })
    assert.deepEqual(plan.rightRequest, { ...plan.leftRequest, promptVersionId: 12 })
    assert.deepEqual(plan.snapshot, {
      leftVersion: { id: 11, versionNumber: 1 },
      rightVersion: { id: 12, versionNumber: 2 },
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      testCaseCount: 1,
    })
  })
}

// Source: tests/unit/apiContract.unit.test.mjs
{
  test('后端错误响应保留状态、代码和字段级提示', () => {
    const error = createApiError(400, {
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed',
      path: '/api/prompts',
      fieldErrors: { name: 'Prompt title is required' },
    })

    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 400)
    assert.equal(error.code, 'VALIDATION_FAILED')
    assert.equal(error.fieldErrors.name, 'Prompt title is required')
  })

  test('非结构化失败不会向界面泄漏对象内容', () => {
    const error = createApiError(502, '<html>proxy detail</html>', '/quick-test')

    assert.equal(error.code, 'HTTP_502')
    assert.equal(error.message, '请求失败（502）')
    assert.equal(error.path, '/quick-test')
  })

  test('门禁客户端以候选运行 ID 路由，并发送 baseline 请求体', async () => {
    await assert.rejects(
      api.tests.regressionGate(998, { baselineRunId: 997 }),
      (error) => error.path === '/test-runs/998/regression-gate' && error.code === 'RESOURCE_NOT_FOUND',
    )
  })
}
