import { presentGateMetric, presentGateReason } from '../lib/gatePresentation.js'

export default function ReleaseGate({ verdict, snapshot }) {
  const labels = { PASSED: '可替代', REGRESSED: '不可替代', INCOMPARABLE: '证据不可比' }
  const metrics = (verdict.metrics || []).map(presentGateMetric)
  return (
    <section className={`release-gate release-${String(verdict.verdict || 'incomparable').toLowerCase()}`} aria-live="polite">
      <div className="release-summary">
        <span className="eyebrow">Release gate · A → B</span>
        <h2>{labels[verdict.verdict] || '门禁未知'}</h2>
        <p>基线 V{snapshot?.leftVersion?.versionNumber ?? '—'} → 候选 V{snapshot?.rightVersion?.versionNumber ?? '—'}。{description(verdict.verdict)}</p>
      </div>
      {metrics.length ? <div className="gate-metrics" aria-label="发布门禁指标">{metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><b>{metric.baselineLabel}</b><b>{metric.candidateLabel}</b><small>{metric.limit}</small><em className={`gate-status-${metric.status}`}>{metric.status}</em></div>)}</div> : null}
      {verdict.reasons?.length ? <ul aria-label="门禁原因">{verdict.reasons.map((reason) => { const item = presentGateReason(reason); return <li key={reason} title={item.code}>{item.text}</li> })}</ul> : null}
      {verdict.newFailures?.length ? <div className="gate-failures"><strong>新增失败</strong>{verdict.newFailures.map((failure) => <span key={`${failure.index}-${failure.caseName}`}>CASE {failure.index + 1} · {failure.caseName || '未命名'} · {failure.errorCode || '无错误码'}</span>)}</div> : null}
    </section>
  )
}

function description(verdict) {
  if (verdict === 'PASSED') return '候选版本满足当前发布门禁，可作为基线的替代版本。'
  if (verdict === 'REGRESSED') return '候选版本存在回归或证据缺失，不能替代基线。'
  return '运行矩阵或基线证据不满足可比条件，不能作发布判断。'
}
