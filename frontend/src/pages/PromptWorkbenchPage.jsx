import ModelFields from '../components/ModelFields.jsx'
import {
  ArrowLeft,
  GitCompareArrows,
  LoaderCircle,
  Pencil,
  Play,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ResultPanel from '../components/ResultPanel.jsx'
import SuiteSourcePicker from '../components/SuiteSourcePicker.jsx'
import TestCaseEditor from '../components/TestCaseEditor.jsx'
import { InlineError, PageLoader, StatusBadge } from '../components/Ui.jsx'
import { useTestSuites } from '../hooks/useTestSuites.js'
import { api } from '../lib/api.js'
import { errorMessage } from '../lib/apiContract.js'
import { createEvaluationCase } from '../lib/assertions.js'
import { createCsvDownload, formatDateTime, formatDuration, formatNumber } from '../lib/format.js'
import { extractVariables } from '../lib/promptTemplate.js'

const byVersion = (left, right) => Number(left.versionNumber) - Number(right.versionNumber)

export default function PromptWorkbenchPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reloadKey, setReloadKey] = useState(0)
  const [view, setView] = useState({ status: 'loading', prompt: null, selectedVersionId: null, history: [], result: null, historyError: null, error: null })
  const [draft, setDraft] = useState('')
  const [testCases, setTestCases] = useState([createEvaluationCase([])])
  const [selectedSuiteId, setSelectedSuiteId] = useState('')
  const [provider, setProvider] = useState('openai')
  const [modelName, setModelName] = useState('gpt-4o-mini')
  const [action, setAction] = useState(null)
  const [editingMeta, setEditingMeta] = useState(false)
  const [meta, setMeta] = useState({ name: '', description: '' })
  const { suites, loading: suitesLoading, error: suitesError } = useTestSuites()

  useEffect(() => {
    let active = true
    api.prompts.get(id)
      .then(async (prompt) => {
        const versions = [...(prompt.versions || [])].sort(byVersion)
        const selected = versions.at(-1) || null
        let history = []
        let historyError = null
        if (selected) {
          try { history = await api.tests.history(selected.id) } catch (error) { historyError = error }
        }
        if (!active) return
        setView({ status: 'ready', prompt: { ...prompt, versions }, selectedVersionId: selected?.id ?? null, history, historyError, result: history[0] || null, error: null })
        setDraft(selected?.content || '')
        setMeta({ name: prompt.name, description: prompt.description || '' })
      })
      .catch((error) => {
        if (active) setView((current) => ({ ...current, status: 'error', error }))
      })
    return () => { active = false }
  }, [id, reloadKey])

  const selectedVersion = view.prompt?.versions?.find((version) => Number(version.id) === Number(view.selectedVersionId))
  const variables = useMemo(() => extractVariables(draft), [draft])
  const isDirty = draft !== (selectedVersion?.content || '')
  const selectedSuite = suites.find((suite) => Number(suite.id) === Number(selectedSuiteId))

  const chooseSuite = (suiteId) => {
    setSelectedSuiteId(suiteId)
    const suite = suites.find((item) => Number(item.id) === Number(suiteId))
    if (suite) setTestCases(suite.cases)
  }

  const updateCases = (cases) => {
    setSelectedSuiteId('')
    setTestCases(cases)
  }

  const selectVersion = async (versionId) => {
    if (action) return
    if (isDirty && !window.confirm('当前模板尚未保存，切换版本会丢弃修改。继续切换？')) return
    const numericId = Number(versionId)
    const version = view.prompt.versions.find((item) => Number(item.id) === numericId)
    setDraft(version?.content || '')
    setView((current) => ({ ...current, selectedVersionId: numericId, history: [], result: null, historyError: null }))
    try {
      const history = await api.tests.history(numericId)
      setView((current) => current.selectedVersionId === numericId
        ? { ...current, history, result: history[0] || null }
        : current)
    } catch (error) {
      setView((current) => current.selectedVersionId === numericId ? { ...current, historyError: error } : current)
    }
  }

  const createVersion = async () => {
    if (action || !draft.trim() || !isDirty) return
    setAction('saving-version')
    try {
      const version = await api.prompts.createVersion(id, draft)
      const versions = [...view.prompt.versions, version].sort(byVersion)
      setView((current) => ({ ...current, prompt: { ...current.prompt, versions }, selectedVersionId: version.id, history: [], result: null, historyError: null }))
      toast.success(`V${version.versionNumber} 已保存`)
    } catch (error) {
      toast.error(errorMessage(error, '版本保存失败'))
    } finally {
      setAction(null)
    }
  }

  const saveMetadata = async () => {
    if (action) return
    setAction('saving-meta')
    try {
      const updated = await api.prompts.update(id, meta)
      setView((current) => ({ ...current, prompt: { ...current.prompt, ...updated } }))
      setEditingMeta(false)
      toast.success('Prompt 信息已更新')
    } catch (error) {
      toast.error(errorMessage(error, '信息更新失败'))
    } finally {
      setAction(null)
    }
  }

  const removePrompt = async () => {
    if (!window.confirm(`删除「${view.prompt.name}」及其所有版本？此操作无法在界面撤销。`)) return
    setAction('deleting')
    try {
      await api.prompts.remove(id)
      toast.success('Prompt 已删除')
      navigate('/')
    } catch (error) {
      toast.error(errorMessage(error, '删除失败'))
      setAction(null)
    }
  }

  const runTest = async () => {
    if (isDirty) {
      toast.error('先把草稿保存为新版本，再运行测试')
      return
    }
    if (action || !view.selectedVersionId || !modelName.trim()) return
    const runningVersionId = Number(view.selectedVersionId)
    setAction('running')
    try {
      const result = await api.tests.run({
        promptVersionId: runningVersionId,
        aiProvider: provider,
        modelName,
        ...(selectedSuiteId
          ? { testSuiteId: Number(selectedSuiteId) }
          : { testCases }),
      })
      setView((current) => Number(current.selectedVersionId) === runningVersionId ? { ...current, result, history: [result, ...current.history.filter((item) => item.id !== result.id)] } : current)
      if (result.status === 'COMPLETED') toast.success('测试完成')
      else toast.error('部分或全部用例失败，请查看结果')
    } catch (error) {
      toast.error(errorMessage(error, '测试运行失败'))
    } finally {
      setAction(null)
    }
  }

  const exportCsv = () => {
    if (!view.result) return
    // Blob URL 在点击后立即撤销，避免把运行内容长期留在浏览器内存中。
    const url = URL.createObjectURL(new Blob([createCsvDownload(view.result)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `prompt-${id}-run-${view.result.id}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (view.status === 'loading') return <PageLoader label="正在打开 Prompt 工作台" />
  if (view.status === 'error') return (
    <div className="page-wrap"><InlineError message={errorMessage(view.error)} onRetry={() => { setView((current) => ({ ...current, status: 'loading' })); setReloadKey((value) => value + 1) }} /></div>
  )

  return (
    <div className="page-wrap workbench-page">
      <Link className="back-link" to="/"><ArrowLeft size={16} /> 返回工作区</Link>

      <header className="workbench-header">
        <div>
          <span className="eyebrow">Prompt / P-{String(view.prompt.id).padStart(3, '0')}</span>
          {editingMeta ? (
            <div className="meta-editor">
              <input aria-label="Prompt 名称" maxLength="255" disabled={Boolean(action)} value={meta.name} onChange={(event) => setMeta((current) => ({ ...current, name: event.target.value }))} />
              <textarea aria-label="使用说明" maxLength="1000" disabled={Boolean(action)} rows="2" value={meta.description} onChange={(event) => setMeta((current) => ({ ...current, description: event.target.value }))} />
              <div><button className="button button-primary button-compact" disabled={Boolean(action) || !meta.name.trim()} onClick={saveMetadata} type="button">保存信息</button><button className="button button-ghost button-compact" disabled={Boolean(action)} onClick={() => { setEditingMeta(false); setMeta({ name: view.prompt.name, description: view.prompt.description || '' }) }} type="button">取消</button></div>
            </div>
          ) : (
            <><h1>{view.prompt.name}</h1><p>{view.prompt.description || '尚未补充用途说明与交接上下文。'}</p></>
          )}
        </div>
        <div className="heading-actions">
          <button className="icon-button" aria-label="编辑 Prompt 信息" disabled={Boolean(action)} onClick={() => setEditingMeta(true)} type="button"><Pencil size={17} /></button>
          <Link className={`button button-secondary button-compact ${(view.prompt.versions.length < 2 || action) ? 'is-disabled' : ''}`} aria-disabled={view.prompt.versions.length < 2 || Boolean(action)} tabIndex={view.prompt.versions.length < 2 || action ? -1 : undefined} to={view.prompt.versions.length < 2 ? '#' : `/prompt/${id}/compare`}>
            <GitCompareArrows size={16} /> 对比版本
          </Link>
          <button className="button button-danger button-compact" disabled={Boolean(action)} onClick={removePrompt} type="button"><Trash2 size={15} /> 删除</button>
        </div>
      </header>

      <div className="workbench-grid">
        <div className="workbench-primary">
          <section className="panel template-panel">
            <header className="section-heading editor-heading">
              <div><h2>Prompt 模板</h2></div>
              <div className="heading-actions">
                <label className="select-label"><span>版本</span><select aria-label="版本" disabled={Boolean(action)} value={view.selectedVersionId || ''} onChange={(event) => selectVersion(event.target.value)}>{view.prompt.versions.map((version) => <option key={version.id} value={version.id}>V{version.versionNumber}</option>)}</select></label>
                <button className="button button-primary button-compact" disabled={!isDirty || !draft.trim() || Boolean(action)} onClick={createVersion} type="button">
                  {action === 'saving-version' ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}
                  保存为 V{view.prompt.versions.length + 1}
                </button>
              </div>
            </header>
            <textarea aria-label="Prompt 模板" disabled={Boolean(action)} className="prompt-editor" value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck="false" />
            <footer><span>{draft.length} 字符 · {variables.length} 个变量</span>{isDirty ? <strong>有未保存的修改，请先保存版本</strong> : <span>{selectedVersion ? `已保存为 V${selectedVersion.versionNumber}` : '填写模板并保存第一个版本'}</span>}</footer>
          </section>

          <section className="panel test-config-panel">
            <header className="section-heading">
              <div><h2>测试用例</h2><p>{selectedSuite ? `复用「${selectedSuite.name}」；修改后自动切换为临时用例。` : '设置变量和断言后运行当前版本。'}</p></div>
            </header>
            <fieldset disabled={Boolean(action)}>
              <ModelFields provider={provider} modelName={modelName} onProviderChange={setProvider} onModelChange={setModelName} disabled={Boolean(action)} />
              <SuiteSourcePicker loading={suitesLoading} error={suitesError} suites={suites} value={selectedSuiteId} onChange={chooseSuite} />
              <TestCaseEditor variables={variables} cases={testCases} onChange={updateCases} />
            </fieldset>
            <button className="button button-primary run-button" disabled={Boolean(action) || isDirty || !view.selectedVersionId || !modelName.trim()} onClick={runTest} type="button">
              {action === 'running' ? <LoaderCircle className="spin" size={17} /> : <Play size={17} />}
              {action === 'running' ? '正在执行用例' : selectedVersion ? `运行 V${selectedVersion.versionNumber} · ${testCases.length} 个用例` : '请先保存版本'}
            </button>
          </section>
        </div>

      </div>
      <ResultPanel run={view.result} onExport={exportCsv} title={`V${selectedVersion?.versionNumber} 测试结果`} />
      <aside className="workbench-aside">
        <details className="panel history-panel">
          <summary>运行历史（{view.historyError ? '加载失败' : view.history.length}）</summary>
          {view.historyError ? <InlineError title="运行历史加载失败" message={errorMessage(view.historyError)} onRetry={() => selectVersion(view.selectedVersionId)} /> : null}
          <div className="history-list">
            {view.history.length === 0 && !view.historyError ? <p>当前版本暂无运行记录。</p> : view.history.map((run) => (
              <button className={view.result?.id === run.id ? 'is-active' : ''} key={run.id} onClick={() => setView((current) => ({ ...current, result: run }))} type="button">
                <span><StatusBadge status={run.status} /><b>RUN {run.id}</b></span>
                <time>{formatDateTime(run.startedAt || run.executedAt)}</time>
                <strong>{formatDuration(run.metrics?.averageResponseTimeMs)}</strong>
                <small>A {Math.round((run.metrics?.assertionPassRate || 0) * 100)}% · Q {formatNumber(run.metrics?.averageQualityScore, 2)}</small>
              </button>
            ))}
          </div>
        </details>
      </aside>
    </div>
  )
}
