import {
  CheckCircle2,
  FileStack,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import TestCaseEditor from '../components/TestCaseEditor.jsx'
import { EmptyState, InlineError, PageLoader } from '../components/Ui.jsx'
import { api } from '../lib/api.js'
import { errorMessage } from '../lib/apiContract.js'
import { createEvaluationCase, normalizeEvaluationCases } from '../lib/assertions.js'
import { formatDateTime } from '../lib/format.js'

const blankDraft = () => ({
  id: null,
  name: '',
  description: '',
  cases: [createEvaluationCase(['question'])],
})

const variableNamesOf = (suite) => [...new Set(
  (suite?.cases || []).flatMap((testCase) => Object.keys(testCase.variables || {})),
)]

export default function TestSuitesPage() {
  const [view, setView] = useState({ status: 'loading', suites: [], error: null })
  const [draft, setDraft] = useState(blankDraft)
  const [variableText, setVariableText] = useState('question')
  const [action, setAction] = useState(null)

  const load = async () => {
    setView((current) => ({ ...current, status: 'loading', error: null }))
    try {
      const suites = await api.suites.list()
      setView({ status: 'ready', suites, error: null })
      if (suites.length > 0) selectSuite(suites[0])
      else startNew()
    } catch (error) {
      setView({ status: 'error', suites: [], error })
    }
  }

  useEffect(() => {
    let active = true
    api.suites.list()
      .then((suites) => {
        if (!active) return
        setView({ status: 'ready', suites, error: null })
        if (suites.length > 0) selectSuite(suites[0])
        else startNew()
      })
      .catch((error) => {
        if (active) setView({ status: 'error', suites: [], error })
      })
    return () => { active = false }
  }, [])

  const variables = useMemo(() => [...new Set(
    variableText.split(',').map((value) => value.trim()).filter(Boolean),
  )], [variableText])
  const assertionCount = draft.cases.reduce((total, testCase) => total + (testCase.assertions?.length || 0), 0)

  function selectSuite(suite) {
    const names = variableNamesOf(suite)
    setDraft({ ...suite, cases: normalizeEvaluationCases(suite.cases, names) })
    setVariableText(names.join(', '))
  }

  function startNew() {
    setDraft(blankDraft())
    setVariableText('question')
  }

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error('先填写套件名称')
      return
    }
    setAction('saving')
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        cases: normalizeEvaluationCases(draft.cases, variables),
      }
      const saved = draft.id
        ? await api.suites.update(draft.id, payload)
        : await api.suites.create(payload)
      const suites = draft.id
        ? view.suites.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...view.suites]
      setView((current) => ({ ...current, suites }))
      selectSuite(saved)
      toast.success(draft.id ? '测试套件已更新' : '测试套件已创建')
    } catch (error) {
      toast.error(errorMessage(error, '测试套件保存失败'))
    } finally {
      setAction(null)
    }
  }

  const remove = async () => {
    if (!draft.id || !window.confirm(`删除「${draft.name}」？历史运行会保留，但不再关联此套件。`)) return
    setAction('deleting')
    try {
      await api.suites.remove(draft.id)
      const suites = view.suites.filter((item) => item.id !== draft.id)
      setView((current) => ({ ...current, suites }))
      if (suites.length > 0) selectSuite(suites[0])
      else startNew()
      toast.success('测试套件已删除')
    } catch (error) {
      toast.error(errorMessage(error, '测试套件删除失败'))
    } finally {
      setAction(null)
    }
  }

  if (view.status === 'loading') return <PageLoader label="正在载入测试套件" />
  if (view.status === 'error') return <div className="page-wrap"><InlineError message={errorMessage(view.error)} onRetry={load} /></div>

  return (
    <div className="page-wrap suite-page">
      <header className="page-intro suite-intro">
        <div>
          <span className="eyebrow"><FileStack size={13} /> Regression library</span>
          <h1>测试套件</h1>
          <p>把变量、挑战样本与通过条件固定下来，让不同版本面对同一组证据。</p>
        </div>
        <button className="button button-primary" onClick={startNew} type="button">
          <Plus size={16} /> 新建套件
        </button>
      </header>

      <div className="suite-layout">
        <aside className="panel suite-library">
          <header>
            <div><span>LIBRARY</span><strong>{view.suites.length} 个套件</strong></div>
            <CheckCircle2 size={18} />
          </header>
          {view.suites.length === 0 ? (
            <EmptyState
              eyebrow="尚未建库"
              title="创建第一组回归用例"
              detail="先定义变量，再为输出增加可自动判定的断言。"
              actionLabel="开始编辑"
              onAction={startNew}
            />
          ) : (
            <div className="suite-list">
              {view.suites.map((suite) => {
                const assertions = suite.cases.reduce((total, testCase) => total + (testCase.assertions?.length || 0), 0)
                return (
                  <button className={draft.id === suite.id ? 'is-active' : ''} key={suite.id} onClick={() => selectSuite(suite)} type="button">
                    <span>SUITE {String(suite.id).padStart(3, '0')}</span>
                    <strong>{suite.name}</strong>
                    <p>{suite.description || '未填写用途说明'}</p>
                    <footer><b>{suite.cases.length} cases</b><b>{assertions} assertions</b><time>{formatDateTime(suite.updatedAt)}</time></footer>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <section className="panel suite-editor-panel">
          <header className="section-heading">
            <div>
              <span className="eyebrow">{draft.id ? `Suite / ${draft.id}` : 'New suite'}</span>
              <h2>{draft.id ? '编辑回归档案' : '定义回归档案'}</h2>
              <p>{draft.cases.length} 个用例 · {assertionCount} 条自动判定信号</p>
            </div>
            <div className="heading-actions">
              {draft.id ? <button className="button button-danger button-compact" disabled={action === 'deleting'} onClick={remove} type="button"><Trash2 size={15} /> 删除</button> : null}
              <button className="button button-primary button-compact" disabled={action === 'saving'} onClick={save} type="button">
                {action === 'saving' ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}
                {draft.id ? '保存更改' : '创建套件'}
              </button>
            </div>
          </header>

          <div className="suite-meta-grid">
            <label className="field-group"><span>套件名称</span><input maxLength="200" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="例如：客服发布门禁" /></label>
            <label className="field-group"><span>模板变量（逗号分隔）</span><input value={variableText} onChange={(event) => setVariableText(event.target.value)} placeholder="question, locale" /></label>
            <label className="field-group suite-description"><span>用途说明</span><textarea rows="2" maxLength="2000" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="说明这组挑战样本用于哪一道发布门禁" /></label>
          </div>

          <div className="suite-matrix-heading">
            <div><span className="eyebrow">Reusable matrix</span><h3>用例与断言</h3></div>
            <p>保存后可在 Prompt 工作台和版本对比中直接复用。</p>
          </div>
          <TestCaseEditor variables={variables} cases={draft.cases} onChange={(cases) => setDraft((current) => ({ ...current, cases }))} maxCases={100} />
        </section>
      </div>
    </div>
  )
}
