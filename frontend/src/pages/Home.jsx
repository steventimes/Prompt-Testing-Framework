import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Gauge,
  Layers3,
  MessageSquare,
  Plus,
  Settings,
  Rocket,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import QuickTest from '../components/QuickTest'
import SettingsModal from '../components/SettingsModal'
import { apiFetch, isMockMode } from '../lib/api'

const emptySummary = {
  totalPrompts: 0,
  totalVersions: 0,
  averageVersions: 0,
  readyCount: 0,
  attentionCount: 0,
  readinessScore: 0,
  challengerCoverage: 0,
  releaseGovernance: {
    schema: 'PromptOps.ReleaseGovernance.v1',
    releaseDecision: 'blocked',
    publishableCount: 0,
    blockedCount: 0,
    blockers: [],
    requiredChecks: [],
    verificationCommands: [],
    riskDisclosure: '',
  },
  rows: [],
}

function Home() {
  const [summary, setSummary] = useState(emptySummary)
  const [loading, setLoading] = useState(true)
  const [showQuickTest, setShowQuickTest] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    apiFetch('/workspace/summary')
      .then((response) => response.json())
      .then((data) => {
        setSummary(data && Array.isArray(data.rows) ? data : emptySummary)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error:', error)
        setLoading(false)
      })
  }, [])

  const attentionRows = summary.rows.filter((row) => row.readiness.level !== 'ready').slice(0, 4)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-lg text-slate-600 font-medium">Loading workspace...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">PromptOps Workspace</div>
            <h1 className="text-2xl font-bold text-slate-950">Experiment control center</h1>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              onClick={() => setShowSettings(true)}
              className="h-10 w-10 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              title="API settings"
              aria-label="API settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowQuickTest(!showQuickTest)}
              className={`h-10 px-4 inline-flex items-center gap-2 rounded-md border text-sm font-semibold ${
                showQuickTest
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Terminal className="w-4 h-4" />
              {showQuickTest ? 'Close playground' : 'Quick playground'}
            </button>
            <button
              onClick={() => navigate('/create')}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-md bg-slate-950 text-white text-sm font-semibold hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" />
              New prompt
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<MessageSquare />} label="Prompts" value={summary.totalPrompts} detail={`${summary.totalVersions} versions`} />
          <MetricCard icon={<Layers3 />} label="Avg versions" value={summary.averageVersions} detail="per prompt" />
          <MetricCard icon={<Gauge />} label="Readiness" value={`${summary.readinessScore}%`} detail={`${summary.readyCount} ready`} />
          <MetricCard icon={<Rocket />} label="Release gate" value={summary.releaseGovernance.releaseDecision === 'approved' ? 'Approved' : 'Blocked'} detail={`${summary.releaseGovernance.publishableCount} publishable`} />
          <MetricCard icon={<ShieldCheck />} label="Runtime" value={isMockMode() ? 'Mock' : 'Live'} detail="provider mode" />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-950">Prompt portfolio</h2>
                <p className="text-sm text-slate-500 mt-1">Production readiness, challenger coverage, and latest activity.</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
                <FlaskConical className="w-4 h-4 text-indigo-600" />
                {summary.challengerCoverage}% challenger coverage
              </div>
            </div>

            {summary.rows.length === 0 ? (
              <EmptyState onCreate={() => navigate('/create')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Prompt</th>
                      <th className="px-5 py-3 font-semibold">Versions</th>
                      <th className="px-5 py-3 font-semibold">Readiness</th>
                      <th className="px-5 py-3 font-semibold">Created</th>
                      <th className="px-5 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 min-w-[260px]">
                          <div className="font-semibold text-slate-950">{row.name}</div>
                          <div className="text-slate-500 line-clamp-1">{row.description || 'No description provided'}</div>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-700">{row.versionCount}</td>
                        <td className="px-5 py-4">
                          <ReadinessBadge readiness={row.readiness} />
                        </td>
                        <td className="px-5 py-4 text-slate-600">{formatDate(row.createdAt)}</td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => navigate(`/prompt/${row.id}`)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                          >
                            Open
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Governance queue
                </h2>
                <p className="text-sm text-slate-500 mt-1">Items that need review before rollout.</p>
              </div>
              <div className="p-5 space-y-3">
                {attentionRows.length === 0 ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    All prompts meet the current readiness policy.
                  </div>
                ) : (
                  attentionRows.map((row) => (
                    <button
                      key={row.id}
                      onClick={() => navigate(`/prompt/${row.id}`)}
                      className="w-full text-left rounded-md border border-slate-200 p-4 hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-900">{row.name}</div>
                        <ReadinessBadge readiness={row.readiness} compact />
                      </div>
                      <p className="text-sm text-slate-500 mt-2">{row.readiness.reason}</p>
                    </button>
                  ))
                )}
              </div>
            </section>


            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-indigo-600" />
                  Release governance
                </h2>
                <p className="text-sm text-slate-500 mt-1">Production publish gate for prompt rollout.</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <PostureRow label="Decision" value={summary.releaseGovernance.releaseDecision === 'approved' ? 'Approved' : 'Blocked'} />
                  <PostureRow label="Blocked" value={summary.releaseGovernance.blockedCount} />
                </div>
                {summary.releaseGovernance.blockers.length === 0 ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    All prompts are structurally ready for controlled rollout.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {summary.releaseGovernance.blockers.slice(0, 4).map((blocker) => (
                      <button
                        key={`${blocker.promptId}-${blocker.code}`}
                        onClick={() => navigate(`/prompt/${blocker.promptId}`)}
                        className="w-full text-left rounded-md border border-slate-200 p-4 hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-slate-900">{blocker.promptName}</div>
                          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">{blocker.code}</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-2">{blocker.message}</p>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs leading-5 text-slate-500">{summary.releaseGovernance.riskDisclosure}</p>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                Operating posture
              </h2>
              <div className="mt-4 space-y-3 text-sm">
                <PostureRow label="Version challengers" value={`${summary.challengerCoverage}%`} />
                <PostureRow label="Prompts needing review" value={summary.attentionCount} />
                <PostureRow label="Publishable prompts" value={summary.releaseGovernance.publishableCount} />
                <PostureRow label="Provider mode" value={isMockMode() ? 'Mock demo' : 'Live backend'} />
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Audit evidence
              </h2>
              <div className="mt-4 space-y-3 text-sm">
                <PostureRow label="Artifact" value={summary.auditEvidence.artifactId || 'Pending'} />
                <PostureRow label="Evidence items" value={summary.auditEvidence.evidenceItemCount} />
                <PostureRow label="Governed prompts" value={summary.auditEvidence.governedPromptCount} />
                <PostureRow label="Retention" value="180 days" />
              </div>
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Export package</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {summary.auditEvidence.exportFormats.map((format) => (
                    <span key={format} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {format}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">{summary.auditEvidence.riskDisclosure}</p>
            </section>
          </aside>
        </div>

        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            showQuickTest ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="bg-white rounded-lg border border-slate-200">
            <QuickTest onClose={() => setShowQuickTest(false)} />
          </div>
        </div>
      </main>
    </div>
  )
}

function MetricCard({ icon, label, value, detail }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-500">{label}</div>
        <div className="h-9 w-9 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">
          {icon}
        </div>
      </div>
      <div className="mt-4 text-3xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{detail}</div>
    </div>
  )
}

function ReadinessBadge({ readiness, compact = false }) {
  const palette = {
    ready: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    attention: 'border-amber-200 bg-amber-50 text-amber-700',
    blocked: 'border-red-200 bg-red-50 text-red-700',
    watch: 'border-sky-200 bg-sky-50 text-sky-700',
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${palette[readiness.level] || palette.watch}`}>
      {compact ? readiness.label.split(' ')[0] : readiness.label}
    </span>
  )
}

function PostureRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function EmptyState({ onCreate }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
        <MessageSquare className="w-6 h-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">No prompts yet</h3>
      <p className="mt-1 text-sm text-slate-500">Create the first prompt to start building an experiment portfolio.</p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        <Plus className="w-4 h-4" />
        New prompt
      </button>
    </div>
  )
}

function formatDate(value) {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return 'Unknown'
  return new Date(parsed).toLocaleDateString()
}

export default Home
