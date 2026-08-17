import { AlertTriangle, ArrowRight, Gauge, Plus, Settings2, TestTubeDiagonal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { errorMessage } from '../lib/apiContract.js'
import { formatDate } from '../lib/format.js'
import QuickTestPanel from '../components/QuickTestPanel.jsx'
import RuntimeModal from '../components/RuntimeModal.jsx'
import { EmptyState, InlineError, MetricTile, PageLoader, StatusBadge } from '../components/Ui.jsx'

const emptySummary = {
  totalPrompts: 0,
  totalVersions: 0,
  averageVersions: 0,
  readyCount: 0,
  attentionCount: 0,
  readinessScore: 0,
  challengerCoverage: 0,
  releaseGovernance: { releaseDecision: 'blocked', publishableCount: 0, blockedCount: 0, blockers: [] },
  rows: [],
}

const readinessCopy = {
  ready: ['可实验', '已有说明、基线和挑战版本'],
  attention: ['需补充', '补齐上下文或挑战版本'],
  blocked: ['阻塞', '先创建可运行版本'],
  watch: ['待复查', '最近活动已超过复查窗口'],
}

const blockerCopy = {
  PROMPT_BLOCKED: '先创建一个可运行的 Prompt 版本。',
  PROMPT_NEEDS_REVIEW: '补齐用途说明或挑战版本后再评审。',
  PROMPT_REVIEW_STALE: '最近活动已超过 14 天，请重新验证。',
}

export default function HomePage() {
  const navigate = useNavigate()
  const [requestKey, setRequestKey] = useState(0)
  const [page, setPage] = useState({ status: 'loading', data: emptySummary, error: null })
  const [showQuickTest, setShowQuickTest] = useState(false)
  const [showRuntime, setShowRuntime] = useState(false)

  useEffect(() => {
    let active = true
    api.workspace.summary()
      .then((data) => {
        if (active) setPage({ status: 'ready', data: data?.rows ? data : emptySummary, error: null })
      })
      .catch((error) => {
        if (active) setPage({ status: 'error', data: emptySummary, error })
      })
    return () => { active = false }
  }, [requestKey])

  const retry = () => {
    setPage((current) => ({ ...current, status: 'loading' }))
    setRequestKey((value) => value + 1)
  }

  if (page.status === 'loading') return <PageLoader label="正在读取工作区" />

  const summary = page.data
  const blockers = summary.releaseGovernance?.blockers || []

  return (
    <div className="page-wrap home-page">
      {showRuntime ? <RuntimeModal onClose={() => setShowRuntime(false)} /> : null}

      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">Prompt operations / evidence first</span>
          <h1>让每次 Prompt 变更，<em>带着证据</em>离开实验台。</h1>
          <p>在一个工作流里管理版本、运行用例，比较质量、延迟、成本与隐私信号，再决定是否进入发布评审。</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/create"><Plus size={17} /> 新建 Prompt</Link>
            <button className="button button-secondary" onClick={() => setShowQuickTest((value) => !value)} type="button">
              <TestTubeDiagonal size={17} /> {showQuickTest ? '收起快速试验' : '打开快速试验'}
            </button>
            <button className="icon-button hero-settings" aria-label="查看运行环境" onClick={() => setShowRuntime(true)} type="button"><Settings2 size={18} /></button>
          </div>
        </div>

        <div className="signal-sequence" aria-label="Prompt 评测流程">
          <div><i>01</i><span>Draft</span><strong>模板与变量</strong></div>
          <div><i>02</i><span>Run</span><strong>逐用例执行</strong></div>
          <div><i>03</i><span>Evidence</span><strong>指标与隐私</strong></div>
          <div><i>04</i><span>Gate</span><strong>发布判断</strong></div>
        </div>
      </section>

      {page.status === 'error' ? <InlineError message={errorMessage(page.error)} onRetry={retry} /> : null}
      {showQuickTest ? <QuickTestPanel /> : null}

      <section className="metric-grid workspace-metrics" aria-label="工作区指标">
        <MetricTile label="Prompt" value={summary.totalPrompts} detail={`${summary.totalVersions} 个版本`} tone="blue" />
        <MetricTile label="就绪率" value={`${summary.readinessScore}%`} detail={`${summary.readyCount} 个可实验`} tone="cyan" />
        <MetricTile label="挑战版本覆盖" value={`${summary.challengerCoverage}%`} detail={`平均 ${summary.averageVersions} 版`} />
        <MetricTile
          label="发布门"
          value={summary.releaseGovernance?.releaseDecision === 'approved' ? '通过' : '阻塞'}
          detail={`${summary.releaseGovernance?.publishableCount || 0} 个可评审`}
          tone={summary.releaseGovernance?.releaseDecision === 'approved' ? 'cyan' : 'coral'}
        />
      </section>

      <div className="home-content-grid">
        <section className="panel portfolio-panel">
          <header className="section-heading">
            <div><span className="eyebrow">Portfolio</span><h2>Prompt 组合</h2><p>按最近活动排序，直接进入版本实验。</p></div>
            <span className="summary-label"><Gauge size={15} /> {summary.attentionCount} 项需关注</span>
          </header>

          {summary.rows.length === 0 ? (
            <EmptyState
              eyebrow="工作区为空"
              title="创建第一个 Prompt"
              detail="从一份模板和第一组用例开始建立评测基线。"
              actionLabel="开始创建"
              onAction={() => navigate('/create')}
            />
          ) : (
            <div className="portfolio-list">
              {summary.rows.map((row) => {
                const [label, detail] = readinessCopy[row.readiness?.level] || ['未知', '等待状态同步']
                return (
                  <Link className="portfolio-row" key={row.id} to={`/prompt/${row.id}`}>
                    <div className="portfolio-index">P-{String(row.id).padStart(3, '0')}</div>
                    <div className="portfolio-main">
                      <strong>{row.name}</strong>
                      <span>{row.description || '尚未补充使用场景与负责人上下文'}</span>
                    </div>
                    <div className="portfolio-version"><b>{row.versionCount}</b><span>versions</span></div>
                    <div className="portfolio-status"><StatusBadge status={row.readiness?.level} label={label} /><small>{detail}</small></div>
                    <time>{formatDate(row.latestActivityAt || row.createdAt)}</time>
                    <ArrowRight size={17} />
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <aside className="panel governance-panel">
          <header className="section-heading">
            <div><span className="eyebrow">Release gate</span><h2>治理队列</h2></div>
            <AlertTriangle size={19} />
          </header>
          {blockers.length === 0 ? (
            <div className="gate-clear"><strong>当前结构检查通过</strong><p>所有 Prompt 都具备说明、版本和近期活动。</p></div>
          ) : blockers.slice(0, 5).map((blocker) => (
            <button key={`${blocker.promptId}-${blocker.code}`} onClick={() => navigate(`/prompt/${blocker.promptId}`)} type="button">
              <span>{blocker.code}</span>
              <strong>{blocker.promptName}</strong>
              <p>{blockerCopy[blocker.code] || blocker.message}</p>
              <ArrowRight size={15} />
            </button>
          ))}
        </aside>
      </div>
    </div>
  )
}
