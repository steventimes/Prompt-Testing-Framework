import { formatCost, formatDuration, formatNumber } from './format.js'

const REASONS = {
  RUN_NOT_FOUND: '找不到基线或候选运行',
  SAME_RUN: '基线和候选不能是同一次运行',
  BASELINE_RUN_NOT_TERMINAL: '基线运行尚未结束',
  CANDIDATE_RUN_NOT_TERMINAL: '候选运行尚未结束',
  DIFFERENT_PROMPTS: '基线与候选不属于同一个 Prompt',
  DATASET_FINGERPRINT_MISSING: '运行缺少测试矩阵指纹',
  DATASET_FINGERPRINT_MISMATCH: '两个运行使用的测试矩阵不同',
  BASELINE_RESULTS_EMPTY: '基线没有可比较的用例结果',
  CANDIDATE_RESULTS_EMPTY: '候选没有可比较的用例结果',
  RESULT_COUNT_MISMATCH: '两个运行的结果数量不一致',
  BASELINE_CASE_PASS_RATE_UNAVAILABLE: '基线缺少用例通过率证据',
  CANDIDATE_CASE_PASS_RATE_UNAVAILABLE: '候选缺少用例通过率证据',
  BASELINE_AVERAGE_QUALITY_SCORE_UNAVAILABLE: '基线缺少平均质量分证据',
  CANDIDATE_AVERAGE_QUALITY_SCORE_UNAVAILABLE: '候选缺少平均质量分证据',
  BASELINE_QUALITY_COVERAGE_UNAVAILABLE: '基线缺少质量评分覆盖率证据',
  CANDIDATE_QUALITY_COVERAGE_UNAVAILABLE: '候选缺少质量评分覆盖率证据',
  BASELINE_TOTAL_COST_USD_UNAVAILABLE: '基线缺少总成本证据',
  CANDIDATE_TOTAL_COST_USD_UNAVAILABLE: '候选缺少总成本证据',
  BASELINE_AVERAGE_LATENCY_MS_UNAVAILABLE: '基线缺少平均延迟证据',
  CANDIDATE_AVERAGE_LATENCY_MS_UNAVAILABLE: '候选缺少平均延迟证据',
  NEW_CASE_FAILURES: '候选版本出现了基线没有的新失败用例',
  CASE_PASS_RATE_BELOW_LIMIT: '候选用例通过率未达到门槛',
  AVERAGE_QUALITY_SCORE_DROP_EXCEEDED: '候选平均质量分下降超过允许范围',
  QUALITY_COVERAGE_BELOW_BASELINE: '候选版本的质量评分覆盖率低于基线',
  TOTAL_COST_INCREASE_EXCEEDED: '候选总成本增长超过允许范围',
  AVERAGE_LATENCY_INCREASE_EXCEEDED: '候选平均延迟增长超过允许范围',
}

const METRICS = {
  CASE_PASS_RATE: { label: '用例通过率', value: (value) => percent(value), limit: (value) => `至少 ${percent(value)}` },
  AVERAGE_QUALITY_SCORE: { label: '平均质量分', value: (value) => formatNumber(value, 2), limit: (value) => `最多下降 ${formatNumber(value, 2)}` },
  QUALITY_COVERAGE: { label: '质量评分覆盖率', value: (value) => percent(value), limit: (value) => `不得低于 ${percent(value)}` },
  TOTAL_COST_USD: { label: '总成本', value: formatCost, limit: (value) => `最多增长 ${formatNumber(value, 1)}%` },
  AVERAGE_LATENCY_MS: { label: '平均延迟', value: formatDuration, limit: (value) => `最多增长 ${formatNumber(value, 1)}%` },
}

function percent(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—'
  return `${formatNumber(Number(value) * 100, 0)}%`
}

export function presentGateReason(code) {
  return { text: REASONS[code] || '未知门禁原因', code }
}

export function presentGateMetric(metric) {
  const definition = METRICS[metric.name] || { label: '未知指标', value: (value) => formatNumber(value, 2), limit: () => '—' }
  const baseline = definition.value(metric.baseline)
  const candidate = definition.value(metric.candidate)
  return {
    label: definition.label,
    baseline,
    candidate,
    baselineLabel: "A · " + baseline,
    candidateLabel: "B · " + candidate,
    limit: definition.limit(metric.limit),
    status: !metric.available ? '证据缺失' : metric.passed ? '通过' : '超限',
  }
}
