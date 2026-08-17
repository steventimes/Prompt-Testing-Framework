export const ASSERTION_TYPES = Object.freeze([
  { value: 'CONTAINS', label: '包含文本', valueKind: 'text', placeholder: '必须出现的文本' },
  { value: 'NOT_CONTAINS', label: '不包含文本', valueKind: 'text', placeholder: '禁止出现的文本' },
  { value: 'REGEX', label: '匹配正则', valueKind: 'text', placeholder: '例如 ^结论：' },
  { value: 'JSON_VALID', label: '有效 JSON', valueKind: 'none' },
  { value: 'MAX_LATENCY_MS', label: '最大延迟', valueKind: 'number', placeholder: '毫秒' },
  { value: 'MAX_COST_USD', label: '最大成本', valueKind: 'number', placeholder: '美元' },
  { value: 'MIN_QUALITY_SCORE', label: '最低质量', valueKind: 'number', placeholder: '0–1' },
])

const textValue = (value) => String(value ?? '')
const displayActual = (value) => {
  const text = textValue(value)
  return text.length > 500 ? `${text.slice(0, 497)}...` : text
}

export function createEvaluationCase(variables = [], index = 0) {
  return {
    name: `用例 ${String(index + 1).padStart(2, '0')}`,
    variables: Object.fromEntries(variables.map((variable) => [variable, ''])),
    assertions: [],
  }
}

export function normalizeEvaluationCases(cases = [], variables = []) {
  return (Array.isArray(cases) ? cases : []).map((item, index) => {
    const advanced = item && (
      Object.hasOwn(item, 'variables')
      || Object.hasOwn(item, 'assertions')
      || Object.hasOwn(item, 'name')
    )
    const sourceVariables = advanced ? item.variables : item
    return {
      name: textValue(advanced ? item.name : '').trim() || `用例 ${String(index + 1).padStart(2, '0')}`,
      variables: {
        ...Object.fromEntries(variables.map((variable) => [variable, ''])),
        ...(sourceVariables || {}),
      },
      assertions: advanced && Array.isArray(item.assertions) ? item.assertions.map((rule) => ({ ...rule })) : [],
    }
  })
}

function evidence(type, passed, expected, actual, message) {
  return { type, passed, expected: textValue(expected), actual: displayActual(actual), message }
}

const hasTextValue = (value) => typeof value === 'string' && value.trim().length > 0
const hasMetricValue = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value))
const hasThreshold = (rule, threshold) => rule?.threshold !== null
  && rule?.threshold !== undefined
  && rule?.threshold !== ''
  && Number.isFinite(threshold)
  && threshold >= 0

export function evaluateAssertions({
  output,
  responseTimeMs,
  costUsd,
  qualityScore,
  assertions = [],
}) {
  const response = textValue(output)
  const results = (Array.isArray(assertions) ? assertions : []).map((rule) => {
    const type = rule?.type
    const threshold = Number(rule?.threshold)

    switch (type) {
      case 'CONTAINS': {
        if (!hasTextValue(rule?.value)) {
          return evidence(type, false, '非空文本', response, '文本断言缺少 value')
        }
        const passed = response.includes(rule.value)
        return evidence(type, passed, rule.value, response, passed ? '输出包含目标文本' : '输出缺少目标文本')
      }
      case 'NOT_CONTAINS': {
        if (!hasTextValue(rule?.value)) {
          return evidence(type, false, '非空文本', response, '文本断言缺少 value')
        }
        const passed = !response.includes(rule.value)
        return evidence(type, passed, rule.value, response, passed ? '输出未包含禁止文本' : '输出包含禁止文本')
      }
      case 'REGEX': {
        if (!hasTextValue(rule?.value)) {
          return evidence(type, false, '非空正则', response, '正则断言缺少 value')
        }
        try {
          const passed = new RegExp(rule.value).test(response)
          return evidence(type, passed, rule.value, response, passed ? '输出匹配正则表达式' : '输出未匹配正则表达式')
        } catch {
          return evidence(type, false, rule.value, response, '正则表达式无效')
        }
      }
      case 'JSON_VALID': {
        try {
          JSON.parse(response)
          return evidence(type, true, '有效 JSON', response, '输出是有效 JSON')
        } catch {
          return evidence(type, false, '有效 JSON', response, '输出不是有效 JSON')
        }
      }
      case 'MAX_LATENCY_MS': {
        const passed = hasThreshold(rule, threshold) && hasMetricValue(responseTimeMs)
          && Number(responseTimeMs) <= threshold
        return evidence(type, passed, threshold, responseTimeMs, passed ? '延迟在上限内' : '延迟超过上限或阈值无效')
      }
      case 'MAX_COST_USD': {
        const passed = hasThreshold(rule, threshold) && hasMetricValue(costUsd)
          && Number(costUsd) <= threshold
        return evidence(type, passed, threshold, costUsd, passed ? '成本在上限内' : '成本超过上限或阈值无效')
      }
      case 'MIN_QUALITY_SCORE': {
        const passed = hasThreshold(rule, threshold) && hasMetricValue(qualityScore)
          && Number(qualityScore) >= threshold
        return evidence(type, passed, threshold, qualityScore, passed ? '质量达到下限' : '质量低于下限或阈值无效')
      }
      default:
        return evidence(type || 'UNKNOWN', false, '', response, '不支持的断言类型')
    }
  })

  return {
    passed: results.every((result) => result.passed),
    results,
  }
}
