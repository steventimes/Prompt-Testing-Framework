import { CheckCircle2, Download, ShieldAlert, Wrench, XCircle } from 'lucide-react'
import { formatCost, formatDuration, formatNumber } from '../lib/format.js'
import { MetricTile, StatusBadge } from './Ui.jsx'

function privacyOf(result) {
  if (result.privacySummary) return result.privacySummary
  return { riskScore: result.privacyRiskScore ?? 0, flags: result.privacyFlags ?? [] }
}

function qualityEvidenceDetail(run, metrics) {
  const results = run.results || []
  const executedCases = results.filter((result) => result.aiResponse != null || result.status === "COMPLETED")
  const fallbackScoredCases = executedCases.filter((result) => result.qualityScore != null && result.qualityScore !== "" && Number.isFinite(Number(result.qualityScore))).length
  const scoredCases = Number.isInteger(metrics.qualityScoredCases) ? metrics.qualityScoredCases : fallbackScoredCases
  return `已评分 ${scoredCases}/${executedCases.length}`
}

export default function ResultPanel({ run, onExport, title = '运行结果' }) {
  if (!run) return null
  const metrics = run.metrics || {}
  const assertionDetail = metrics.totalAssertions
    ? `${metrics.passedAssertions || 0}/${metrics.totalAssertions} 通过`
    : '未设置自动判定'
  const qualityDetail = qualityEvidenceDetail(run, metrics)

  return (
    <section className="result-panel run-trace">
      <header className="section-heading result-heading">
        <div>
          <span className="eyebrow">Evidence / {run.id}</span>
          <h2>{title}</h2>
        </div>
        <div className="heading-actions">
          <StatusBadge status={run.status} />
          {onExport ? (
            <button className="button button-secondary button-compact" onClick={onExport} type="button">
              <Download size={15} /> 导出 CSV
            </button>
          ) : null}
        </div>
      </header>

      <div className="metric-grid metric-grid-results">
        <MetricTile label="断言通过率" value={`${Math.round((metrics.assertionPassRate || 0) * 100)}%`} detail={assertionDetail} tone={metrics.failedAssertions ? 'coral' : 'cyan'} />
        <MetricTile label="平均质量" value={formatNumber(metrics.averageQualityScore, 2)} detail={qualityDetail} tone="blue" />
        <MetricTile label="平均延迟" value={formatDuration(metrics.averageResponseTimeMs)} detail="完成用例" />
        <MetricTile label="总 Tokens" value={formatNumber(metrics.totalTokens, 0)} detail={formatCost(metrics.totalCostUsd)} />
        <MetricTile label="隐私发现" value={metrics.totalPrivacyFindings || 0} detail={`风险 ${formatNumber(metrics.averagePrivacyRiskScore, 2)}`} tone={metrics.totalPrivacyFindings ? 'coral' : 'cyan'} />
      </div>

      <div className="result-list">
        {(run.results || []).map((result, index) => {
          const privacy = privacyOf(result)
          return (
            <article className="result-case" key={result.id ?? `${run.id}-${index}`}>
              <div className="trace-node" aria-hidden="true" />
              <header>
                <span>{result.caseName || `CASE ${String(index + 1).padStart(2, '0')}`}</span>
                <StatusBadge status={result.status} />
              </header>
              <div className="result-inputs">
                {Object.entries(result.inputVariables || {}).map(([key, value]) => (
                  <span key={key}><b>{key}</b>{value || '—'}</span>
                ))}
              </div>
              {result.status === 'FAILED' ? (
                <div className="case-failure">
                  <strong>{result.errorCode}</strong>
                  <p>{result.errorMessage}</p>
                </div>
              ) : null}
              {result.aiResponse ? (
                <>
                  <pre>{result.aiResponse}</pre>
                  <div className="result-meta">
                    <span>{formatDuration(result.responseTimeMs)}</span>
                    <span>Q {formatNumber(result.qualityScore, 2)}</span>
                    <span>{formatNumber(result.tokenCount, 0)} tokens</span>
                    <span>{formatCost(result.costUsd)}</span>
                  </div>
                </>
              ) : null}
              {result.assertionResults?.length > 0 ? (
                <div className="assertion-evidence">
                  {result.assertionResults.map((assertion, assertionIndex) => (
                    <div className={assertion.passed ? 'is-passed' : 'is-failed'} key={`${assertion.type}-${assertionIndex}`}>
                      {assertion.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      <span><strong>{assertion.type}</strong><small>{assertion.message}</small></span>
                      <code>{assertion.expected || '—'}</code>
                    </div>
                  ))}
                </div>
              ) : null}
              {privacy.flags?.length > 0 ? (
                <div className="privacy-alert"><ShieldAlert size={15} /> 隐私信号：{privacy.flags.join('、')}</div>
              ) : null}
              {result.mcpCalls?.length > 0 ? (
                <details className="tool-evidence">
                  <summary><Wrench size={14} /> {result.mcpCalls.length} 条工具证据</summary>
                  {result.mcpCalls.map((call, callIndex) => (
                    <div key={`${call.toolName}-${callIndex}`}>
                      <code>{call.toolName}</code><span>{call.status} · {call.durationMs} ms · {call.dataAccess}</span>
                    </div>
                  ))}
                </details>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
