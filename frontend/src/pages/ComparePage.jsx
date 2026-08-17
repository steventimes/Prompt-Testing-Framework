import { ArrowLeft, GitCompareArrows, LoaderCircle, Play, Scale } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import SuiteSourcePicker from '../components/SuiteSourcePicker.jsx'
import TestCaseEditor from '../components/TestCaseEditor.jsx'
import ReleaseGate from '../components/ReleaseGate.jsx'
import { EmptyState, InlineError, PageLoader, StatusBadge } from '../components/Ui.jsx'
import { useTestSuites } from '../hooks/useTestSuites.js'
import { api } from '../lib/api.js'
import { errorMessage } from '../lib/apiContract.js'
import { createEvaluationCase } from '../lib/assertions.js'
import { compareRuns } from '../lib/comparison.js'
import { createComparisonPlan } from '../lib/comparisonPlan.js'
import { formatCost, formatDuration, formatNumber } from '../lib/format.js'
import { extractVariables } from '../lib/promptTemplate.js'

const byVersion = (left, right) => Number(left.versionNumber) - Number(right.versionNumber)

export default function ComparePage() {
  const { id } = useParams()
  const [page, setPage] = useState({ status: 'loading', prompt: null, error: null })
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [testCases, setTestCases] = useState([createEvaluationCase([])])
  const [selectedSuiteId, setSelectedSuiteId] = useState('')
  const [provider, setProvider] = useState('openai')
  const [modelName, setModelName] = useState('gpt-4o-mini')
  const [running, setRunning] = useState(false)
  const [runs, setRuns] = useState(null)
  const { suites } = useTestSuites()

  useEffect(() => {
    let active = true
    api.prompts.get(id)
      .then((prompt) => {
        if (!active) return
        const versions = [...(prompt.versions || [])].sort(byVersion)
        setPage({ status: 'ready', prompt: { ...prompt, versions }, error: null })
        setLeftId(versions.at(-2)?.id ?? versions[0]?.id ?? '')
        setRightId(versions.at(-1)?.id ?? '')
      })
      .catch((error) => active && setPage({ status: 'error', prompt: null, error }))
    return () => { active = false }
  }, [id])

  const leftVersion = page.prompt?.versions?.find((version) => Number(version.id) === Number(leftId))
  const rightVersion = page.prompt?.versions?.find((version) => Number(version.id) === Number(rightId))
  const variables = useMemo(() => {
    const names = [...extractVariables(leftVersion?.content), ...extractVariables(rightVersion?.content)]
    return [...new Set(names)]
  }, [leftVersion?.content, rightVersion?.content])
  const selectedSuite = suites.find((suite) => Number(suite.id) === Number(selectedSuiteId))

  const chooseSuite = (suiteId) => {
    setSelectedSuiteId(suiteId)
    const suite = suites.find((item) => Number(item.id) === Number(suiteId))
    if (suite) setTestCases(suite.cases)
    setRuns(null)
  }

  const updateCases = (cases) => {
    setSelectedSuiteId('')
    setTestCases(cases)
    setRuns(null)
  }

  const runComparison = async () => {
    if (!leftId || !rightId || Number(leftId) === Number(rightId)) {
      toast.error('请选择两个不同版本')
      return
    }
    setRunning(true)
    try {
      const plan = createComparisonPlan({ leftVersion, rightVersion, provider, modelName, selectedSuiteId, testCases })
      const request = (input) => api.tests.run(input)
      const leftRequest = plan.leftRequest
      const rightRequest = plan.rightRequest
      const [left, right] = await Promise.all([request(leftRequest), request(rightRequest)])
      const gate = await api.tests.regressionGate(right.id, { baselineRunId: left.id })
      setRuns({ left, right, gate, comparison: compareRuns(left, right), snapshot: plan.snapshot })
      toast.success('同矩阵版本对比完成')
    } catch (error) {
      toast.error(errorMessage(error, '版本对比失败'))
    } finally {
      setRunning(false)
    }
  }

  if (page.status === 'loading') return <PageLoader label="正在准备版本对比" />
  if (page.status === 'error') return <div className="page-wrap"><InlineError message={errorMessage(page.error)} /></div>

  if (page.prompt.versions.length < 2) {
    return (
      <div className="page-wrap narrow-page">
        <EmptyState eyebrow="缺少挑战版本" title="至少需要两个版本" detail="返回工作台修改模板并保存为 V2，之后即可使用相同用例并行对比。" actionLabel="返回 Prompt" onAction={() => history.back()} />
      </div>
    )
  }

  const verdict = runs?.comparison
  const gate = runs?.gate
  const resultSnapshot = runs?.snapshot
  const winnerLabel = verdict?.winner === 'incomparable' ? '质量证据不足' : verdict?.winner === 'tie' ? '两版接近' : verdict?.winner === 'left' ? `V${resultSnapshot?.leftVersion?.versionNumber ?? leftVersion.versionNumber} 更优` : `V${resultSnapshot?.rightVersion?.versionNumber ?? rightVersion.versionNumber} 更优`

  return (
    <div className="page-wrap compare-page">
      <Link className="back-link" to={`/prompt/${id}`}><ArrowLeft size={16} /> 返回 {page.prompt.name}</Link>
      <header className="page-intro compare-intro">
        <span className="eyebrow">Controlled comparison</span>
        <h1>版本对比实验</h1>
        <p>固定模型、测试套件与通过条件，只改变 Prompt 版本。</p>
      </header>

      <section className="version-pair">
        <VersionCard disabled={running} side="A" version={leftVersion} versions={page.prompt.versions} value={leftId} onChange={(value) => { setLeftId(value); setRuns(null) }} />
        <div className="versus-mark"><GitCompareArrows size={22} /><span>same evidence</span></div>
        <VersionCard disabled={running} side="B" version={rightVersion} versions={page.prompt.versions} value={rightId} onChange={(value) => { setRightId(value); setRuns(null) }} />
      </section>

      <section className="panel compare-config">
        <header className="section-heading">
          <div><span className="eyebrow">Shared matrix</span><h2>共同测试矩阵</h2><p>{selectedSuite ? `套件「${selectedSuite.name}」` : '临时矩阵'} · {variables.length} 个变量 · {testCases.length} 个用例</p></div>
          <div className="model-row compact-model-row">
            <label><span>供应商</span><select disabled={running} value={provider} onChange={(event) => setProvider(event.target.value)}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select></label>
            <label><span>模型</span><input disabled={running} value={modelName} onChange={(event) => setModelName(event.target.value)} /></label>
          </div>
        </header>
        <fieldset className="compare-matrix-controls" disabled={running}>
        <SuiteSourcePicker suites={suites} value={selectedSuiteId} onChange={chooseSuite} />
        <TestCaseEditor variables={variables} cases={testCases} onChange={updateCases} />
        </fieldset>
        <button className="button button-primary run-button" disabled={running || Number(leftId) === Number(rightId)} onClick={runComparison} type="button">
          {running ? <LoaderCircle className="spin" size={17} /> : <Play size={17} />}
          {running ? '正在并行运行两版' : `运行 ${testCases.length * 2} 次生成`}
        </button>
      </section>

      {runs ? (
        <section className="comparison-results">
          <header className="comparison-verdict">
            {gate ? <ReleaseGate verdict={gate} snapshot={resultSnapshot} /> : null}
            <div><span className="eyebrow"><Scale size={13} /> Weighted decision</span><h2>{winnerLabel}</h2><p>{verdict.winner === "incomparable" ? "至少一侧运行没有可用质量评分，无法计算综合分或选出赢家。" : "综合分 = 质量 + 断言通过率 − 延迟、成本与隐私风险；分差小于 1 判为接近。"}</p></div>
            <div><span>V{resultSnapshot?.leftVersion?.versionNumber ?? leftVersion.versionNumber}<strong>{formatNumber(verdict.leftScore, 1)}</strong></span><i>vs</i><span>V{resultSnapshot?.rightVersion?.versionNumber ?? rightVersion.versionNumber}<strong>{formatNumber(verdict.rightScore, 1)}</strong></span></div>
          </header>

          <div className="comparison-table">
            <div className="comparison-row comparison-head"><span>指标</span><b>V{resultSnapshot?.leftVersion?.versionNumber ?? leftVersion.versionNumber}</b><b>V{resultSnapshot?.rightVersion?.versionNumber ?? rightVersion.versionNumber}</b><span>Δ A−B</span></div>
            <MetricRow label="断言通过率" left={asPercent(runs.left.metrics.assertionPassRate)} right={asPercent(runs.right.metrics.assertionPassRate)} delta={signed(verdict.deltas.assertionPassRate * 100, 0, '%')} />
            <MetricRow label="平均质量" left={formatNumber(runs.left.metrics.averageQualityScore, 2)} right={formatNumber(runs.right.metrics.averageQualityScore, 2)} delta={signed(verdict.deltas.quality, 2)} />
            <MetricRow label="平均延迟" left={formatMilliseconds(runs.left.metrics.averageResponseTimeMs)} right={formatMilliseconds(runs.right.metrics.averageResponseTimeMs)} delta={signed(verdict.deltas.latencyMs, 0, ' ms')} lowerBetter />
            <MetricRow label="总成本" left={formatCost(runs.left.metrics.totalCostUsd)} right={formatCost(runs.right.metrics.totalCostUsd)} delta={signed(verdict.deltas.costUsd, 4)} lowerBetter />
            <MetricRow label="隐私风险" left={formatNumber(runs.left.metrics.averagePrivacyRiskScore, 2)} right={formatNumber(runs.right.metrics.averagePrivacyRiskScore, 2)} delta={signed(verdict.deltas.privacyRisk, 2)} lowerBetter />
          </div>

          <div className="paired-results">
            {runs.left.results.map((leftResult, index) => {
              const rightResult = runs.right.results[index]
              return (
                <article key={`pair-${index}`}>
                  <header><span>{leftResult.caseName || `CASE ${String(index + 1).padStart(2, '0')}`}</span><code>{JSON.stringify(leftResult.inputVariables)}</code></header>
                  <div>
                    <ResultSide version={resultSnapshot?.leftVersion ?? leftVersion} result={leftResult} />
                    <ResultSide version={resultSnapshot?.rightVersion ?? rightVersion} result={rightResult} />
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}



function formatMilliseconds(value) {
  return formatDuration(value)
}

function VersionCard({ side, version, versions, value, onChange, disabled }) {
  return (
    <article className="version-card">
      <header><span>Variant {side}</span><select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>{versions.map((item) => <option key={item.id} value={item.id}>V{item.versionNumber}</option>)}</select></header>
      <strong>V{version?.versionNumber}</strong>
      <pre>{version?.content}</pre>
    </article>
  )
}

function MetricRow({ label, left, right, delta, lowerBetter = false }) {
  return <div className="comparison-row"><span>{label}<small>{lowerBetter ? '低为优' : '高为优'}</small></span><b>{left}</b><b>{right}</b><span>{delta}</span></div>
}

function ResultSide({ version, result }) {
  return (
    <section>
      <header><b>V{version.versionNumber}</b><StatusBadge status={result.status} /></header>
      {result.status === 'FAILED' ? <p className="case-failure">{result.errorMessage}</p> : null}
      {result.aiResponse ? <pre>{result.aiResponse}</pre> : null}
      <footer><span>A {result.assertionResults?.filter((item) => item.passed).length || 0}/{result.assertionResults?.length || 0}</span><span>Q {formatNumber(result.qualityScore, 2)}</span><span>{formatMilliseconds(result.responseTimeMs)}</span></footer>
    </section>
  )
}

function signed(value, digits, suffix = '') {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—'
  const number = Number(value)
  return `${number > 0 ? '+' : ''}${number.toFixed(digits)}${suffix}`
}

function asPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`
}
