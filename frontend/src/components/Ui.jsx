import { AlertCircle, ArrowRight, LoaderCircle, RotateCcw } from 'lucide-react'

export function PageLoader({ label = '正在加载' }) {
  return (
    <div className="page-state" role="status">
      <span className="loader-orbit"><LoaderCircle size={24} /></span>
      <strong>{label}</strong>
      <span>正在同步结构与运行证据</span>
    </div>
  )
}

export function InlineError({ title = '数据未能载入', message, onRetry }) {
  return (
    <section className="inline-error" role="alert">
      <AlertCircle size={22} />
      <div>
        <strong>{title}</strong>
        <p>{message || '检查服务状态后重试。'}</p>
      </div>
      {onRetry ? (
        <button className="button button-secondary button-compact" onClick={onRetry} type="button">
          <RotateCcw size={15} /> 重试
        </button>
      ) : null}
    </section>
  )
}

export function StatusBadge({ status, label }) {
  const normalized = String(status || 'UNKNOWN').toLowerCase()
  const display = label || ({
    completed: '已完成',
    partial: '部分完成',
    failed: '失败',
    running: '运行中',
    ready: '可实验',
    attention: '需关注',
    blocked: '阻塞',
    watch: '待复查',
  }[normalized] ?? status ?? '未知')
  return <span className={`status-badge status-${normalized}`}>{display}</span>
}

export function MetricTile({ label, value, detail, tone = 'default' }) {
  return (
    <article className={`metric-tile metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

export function EmptyState({ eyebrow = '暂无记录', title, detail, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {onAction ? (
        <button className="text-action" type="button" onClick={onAction}>
          {actionLabel}<ArrowRight size={15} />
        </button>
      ) : null}
    </div>
  )
}

export function FieldError({ children }) {
  return children ? <span className="field-error">{children}</span> : null
}
