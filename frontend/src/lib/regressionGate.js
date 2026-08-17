const DEFAULT_GATES = Object.freeze({
  minCasePassRate: 1,
  maxQualityScoreDrop: 0.03,
  maxCostIncreasePercent: 20,
  maxLatencyIncreasePercent: 25,
})

const TERMINAL_STATUSES = new Set(['COMPLETED', 'PARTIAL', 'FAILED'])
const isMeasuredNumber = (value) => value != null && value !== '' && Number.isFinite(Number(value))

function hashText(value, seed = 2166136261) {
  let hash = seed
  for (const char of value) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function normalizeCase(testCase) {
  if (testCase == null) return null
  const variables = Object.entries(testCase.variables || {})
    .map(([key, value]) => [key, value ?? null])
    .sort(([left], [right]) => left.localeCompare(right))
  const assertions = (testCase.assertions || []).map((assertion) => assertion == null ? null : {
    type: assertion.type ?? null,
    value: assertion.value ?? null,
    threshold: assertion.threshold ?? null,
  })
  return { name: testCase.name ?? null, variables, assertions }
}

/**
 * Mock 与后端均以有序用例矩阵作为比较凭据：变量键排序，断言和用例顺序保持原样。
 */
export function fingerprintCaseMatrix(cases) {
  const canonical = JSON.stringify((cases || []).map(normalizeCase))
  return Array.from({ length: 8 }, (_, index) => hashText(`dataset:v1:${index}:${canonical}`, 2166136261 + index * 101))
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('')
}

function rounded(value) {
  return Number(Number(value).toFixed(12))
}

function executedResults(run) {
  return (run?.results || []).filter((result) => result?.aiResponse != null)
}

function measuredResults(run, field) {
  return executedResults(run).filter((result) => isMeasuredNumber(result[field]))
}

function average(run, field) {
  const measured = measuredResults(run, field)
  if (measured.length === 0) return null
  return measured.reduce((total, result) => total + Number(result[field]), 0) / measured.length
}

function completeEvidence(run, field, aggregate) {
  const executed = executedResults(run)
  if (executed.length === 0 || measuredResults(run, field).length !== executed.length) return null
  return aggregate(executed)
}

function passRate(run) {
  const results = run?.results || []
  return results.length ? results.filter((result) => result?.status === 'COMPLETED').length / results.length : null
}

function qualityCoverage(run) {
  const executed = executedResults(run)
  return executed.length ? measuredResults(run, 'qualityScore').length / executed.length : null
}

function totalCost(run) {
  return completeEvidence(run, 'costUsd', (results) => results.reduce((total, result) => total + Number(result.costUsd), 0))
}

function averageLatency(run) {
  return completeEvidence(run, 'responseTimeMs', (results) => results.reduce((total, result) => total + Number(result.responseTimeMs), 0) / results.length)
}

function percentageDelta(baseline, candidate) {
  if (baseline === 0) return candidate === 0 ? 0 : null
  return rounded(((candidate - baseline) / baseline) * 100)
}

function percentageWithin(baseline, candidate, limit) {
  if (baseline === 0) return candidate === 0
  return ((candidate - baseline) / baseline) * 100 <= limit
}

function failureList(baseline, candidate) {
  return baseline.results.flatMap((baselineResult, index) => {
    const candidateResult = candidate.results[index]
    if (baselineResult?.status !== 'COMPLETED' || candidateResult?.status === 'COMPLETED') return []
    return [{
      index,
      caseName: candidateResult?.caseName ?? baselineResult?.caseName ?? `CASE ${index + 1}`,
      errorCode: candidateResult?.errorCode ?? null,
    }]
  })
}

function incomparable(baseline, candidate, reasons) {
  return {
    baselineRunId: baseline?.id ?? null,
    candidateRunId: candidate?.id ?? null,
    verdict: 'INCOMPARABLE',
    passed: false,
    reasons,
    metrics: [],
    newFailures: [],
  }
}

function evidenceMetric(name, baseline, candidate, limit, rule, reasons, failureReason) {
  if (baseline == null) {
    reasons.push(`BASELINE_${name}_UNAVAILABLE`)
    return { name, baseline: null, candidate: candidate == null ? null : rounded(candidate), delta: null, deltaPercent: null, limit, available: false, passed: false }
  }
  if (candidate == null) {
    reasons.push(`CANDIDATE_${name}_UNAVAILABLE`)
    return { name, baseline: rounded(baseline), candidate: null, delta: null, deltaPercent: null, limit, available: false, passed: false }
  }
  const passed = rule(baseline, candidate)
  if (!passed) reasons.push(failureReason)
  return {
    name,
    baseline: rounded(baseline),
    candidate: rounded(candidate),
    delta: rounded(candidate - baseline),
    deltaPercent: percentageDelta(baseline, candidate),
    limit,
    available: true,
    passed,
  }
}

/**
 * 证据缺失不是零：基线缺失不可比，候选缺失或新增失败则阻止替换。
 */
export function evaluateRegressionGate(baseline, candidate, requestedGates = {}) {
  const structuralReasons = []
  if (!baseline || !candidate) structuralReasons.push('RUN_NOT_FOUND')
  if (baseline?.id === candidate?.id) structuralReasons.push('SAME_RUN')
  if (baseline && !TERMINAL_STATUSES.has(baseline.status)) structuralReasons.push('BASELINE_RUN_NOT_TERMINAL')
  if (candidate && !TERMINAL_STATUSES.has(candidate.status)) structuralReasons.push('CANDIDATE_RUN_NOT_TERMINAL')
  if (baseline?.promptId !== candidate?.promptId) structuralReasons.push('DIFFERENT_PROMPTS')
  if (!baseline?.datasetFingerprint || !candidate?.datasetFingerprint) structuralReasons.push('DATASET_FINGERPRINT_MISSING')
  else if (baseline.datasetFingerprint !== candidate.datasetFingerprint) structuralReasons.push('DATASET_FINGERPRINT_MISMATCH')
  if (!Array.isArray(baseline?.results) || baseline.results.length === 0) structuralReasons.push('BASELINE_RESULTS_EMPTY')
  if (!Array.isArray(candidate?.results) || candidate.results.length === 0) structuralReasons.push('CANDIDATE_RESULTS_EMPTY')
  if (Array.isArray(baseline?.results) && Array.isArray(candidate?.results) && baseline.results.length !== candidate.results.length) structuralReasons.push('RESULT_COUNT_MISMATCH')
  if (structuralReasons.length > 0) return incomparable(baseline, candidate, structuralReasons)

  const gates = { ...DEFAULT_GATES, ...requestedGates }
  const reasons = []
  const baselinePassRate = passRate(baseline)
  const candidatePassRate = passRate(candidate)
  const baselineQualityCoverage = qualityCoverage(baseline)
  const candidateQualityCoverage = qualityCoverage(candidate)
  const metrics = [
    evidenceMetric('CASE_PASS_RATE', baselinePassRate, candidatePassRate, gates.minCasePassRate,
      (_, candidateValue) => candidateValue >= gates.minCasePassRate, reasons, 'CASE_PASS_RATE_BELOW_LIMIT'),
    evidenceMetric('AVERAGE_QUALITY_SCORE', average(baseline, 'qualityScore'), average(candidate, 'qualityScore'), gates.maxQualityScoreDrop,
      (baselineValue, candidateValue) => baselineValue - candidateValue <= gates.maxQualityScoreDrop, reasons, 'AVERAGE_QUALITY_SCORE_DROP_EXCEEDED'),
    evidenceMetric('QUALITY_COVERAGE', baselineQualityCoverage, candidateQualityCoverage, baselineQualityCoverage ?? 0,
      (baselineValue, candidateValue) => candidateValue >= baselineValue, reasons, 'QUALITY_COVERAGE_BELOW_BASELINE'),
    evidenceMetric('TOTAL_COST_USD', totalCost(baseline), totalCost(candidate), gates.maxCostIncreasePercent,
      (baselineValue, candidateValue) => percentageWithin(baselineValue, candidateValue, gates.maxCostIncreasePercent), reasons, 'TOTAL_COST_INCREASE_EXCEEDED'),
    evidenceMetric('AVERAGE_LATENCY_MS', averageLatency(baseline), averageLatency(candidate), gates.maxLatencyIncreasePercent,
      (baselineValue, candidateValue) => percentageWithin(baselineValue, candidateValue, gates.maxLatencyIncreasePercent), reasons, 'AVERAGE_LATENCY_INCREASE_EXCEEDED'),
  ]
  const newFailures = failureList(baseline, candidate)
  if (newFailures.length > 0) reasons.push('NEW_CASE_FAILURES')
  const baselineEvidenceMissing = metrics.some((metric) => metric.baseline == null)
  const verdict = baselineEvidenceMissing
    ? 'INCOMPARABLE'
    : metrics.every((metric) => metric.passed) && newFailures.length === 0 ? 'PASSED' : 'REGRESSED'
  return {
    baselineRunId: baseline.id,
    candidateRunId: candidate.id,
    verdict,
    passed: verdict === 'PASSED',
    reasons,
    metrics,
    newFailures,
  }
}
