export function formatDate(value, options = {}) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: '2-digit',
    ...options,
  }).format(date)
}

export function formatDateTime(value) {
  return formatDate(value, { hour: '2-digit', minute: '2-digit' })
}

export function formatNumber(value, digits = 1) {
  if (value == null || value === '') return '—'
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(digits) : '—'
}

export function formatDuration(value) {
  if (value == null || value === "") return "—"
  const number = Number(value)
  return Number.isFinite(number) ? `${Math.round(number)} ms` : "—"
}

export function formatCost(value) {
  if (value == null || value === '') return '—'
  const number = Number(value)
  return Number.isFinite(number) ? `$${number.toFixed(4)}` : '—'
}

export function createCsvDownload(run) {
  const headers = ['case', 'status', 'input', 'output', 'latency_ms', 'tokens', 'cost_usd', 'quality', 'error_code']
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""').replaceAll(/\r?\n/g, ' ')}"`
  const rows = (run.results || []).map((result, index) => [
    index + 1,
    result.status,
    JSON.stringify(result.inputVariables || {}),
    result.aiResponse,
    result.responseTimeMs,
    result.tokenCount,
    result.costUsd,
    result.qualityScore,
    result.errorCode,
  ].map(escape).join(','))
  return `\uFEFF${headers.join(',')}\n${rows.join('\n')}`
}
