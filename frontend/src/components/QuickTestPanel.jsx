import { History, LoaderCircle, Play, RotateCcw, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../lib/api.js'
import { errorMessage } from '../lib/apiContract.js'
import { createEvaluationCase } from '../lib/assertions.js'
import { formatDateTime, formatDuration, formatNumber } from '../lib/format.js'
import { extractVariables } from '../lib/promptTemplate.js'
import ResultPanel from './ResultPanel.jsx'
import TestCaseEditor from './TestCaseEditor.jsx'

const HISTORY_KEY = 'ptf:quick-history:v2'
const DEFAULT_PROMPT = '你是客服质检员。针对 {{question}} 给出清晰答复，并标注下一步。'

function loadHistory() {
  try {
    const value = sessionStorage.getItem(HISTORY_KEY)
    return value ? JSON.parse(value) : []
  } catch {
    return []
  }
}

function saveHistory(history) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 6)))
  } catch {
    // 会话存储不可用不影响当前快速试验。
  }
}

export default function QuickTestPanel() {
  const [promptContent, setPromptContent] = useState(DEFAULT_PROMPT)
  const [testCases, setTestCases] = useState([{
    ...createEvaluationCase(['question']),
    name: '退款等待',
    variables: { question: '客户已经等待退款五天，应该如何回复？' },
    assertions: [{ type: 'CONTAINS', value: '[MOCK]' }],
  }])
  const [provider, setProvider] = useState('openai')
  const [modelName, setModelName] = useState('gpt-4o-mini')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState(loadHistory)
  const variables = useMemo(() => extractVariables(promptContent), [promptContent])

  const run = async () => {
    if (!promptContent.trim()) {
      toast.error('先填写 Prompt 内容')
      return
    }
    setRunning(true)
    try {
      const nextResult = await api.tests.quick({
        promptContent,
        aiProvider: provider,
        modelName,
        testCases,
      })
      setResult(nextResult)
      const summary = {
        id: nextResult.id,
        status: nextResult.status,
        executedAt: nextResult.executedAt,
        metrics: nextResult.metrics,
      }
      const nextHistory = [summary, ...history].slice(0, 6)
      setHistory(nextHistory)
      saveHistory(nextHistory)
      toast.success('快速试验完成')
    } catch (error) {
      toast.error(errorMessage(error, '快速试验未完成'))
    } finally {
      setRunning(false)
    }
  }

  const reset = () => {
    setPromptContent(DEFAULT_PROMPT)
    setTestCases([createEvaluationCase(['question'])])
    setResult(null)
  }

  return (
    <section className="quick-lab">
      <header className="section-heading">
        <div>
          <span className="eyebrow"><Sparkles size={13} /> Scratch run</span>
          <h2>快速试验台</h2>
          <p>不创建版本，先验证模板变量、输出形态与自动判定。</p>
        </div>
        <button className="button button-ghost button-compact" onClick={reset} type="button">
          <RotateCcw size={15} /> 重置
        </button>
      </header>

      <div className="quick-grid">
        <div className="editor-stack">
          <label className="field-group">
            <span>Prompt 草稿</span>
            <textarea rows="8" value={promptContent} onChange={(event) => setPromptContent(event.target.value)} />
          </label>
          <div className="model-row">
            <label><span>供应商</span><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select></label>
            <label><span>模型</span><input value={modelName} onChange={(event) => setModelName(event.target.value)} /></label>
          </div>
          <TestCaseEditor variables={variables} cases={testCases} onChange={setTestCases} maxCases={6} />
          <button className="button button-primary" disabled={running} onClick={run} type="button">
            {running ? <LoaderCircle className="spin" size={17} /> : <Play size={17} />}
            {running ? '运行中' : `运行 ${testCases.length} 个用例`}
          </button>
        </div>

        <aside className="quick-history">
          <h3><History size={16} /> 当前会话</h3>
          {history.length === 0 ? <p>第一次运行后，这里会保留最小指标摘要。</p> : history.map((item) => (
            <article key={item.id}>
              <span>{formatDateTime(item.executedAt)}</span>
              <strong>Q {formatNumber(item.metrics?.averageQualityScore, 2)}</strong>
              <small>{formatDuration(item.metrics?.averageResponseTimeMs)} · {item.status}</small>
            </article>
          ))}
        </aside>
      </div>
      <ResultPanel run={result} title="快速试验结果" />
    </section>
  )
}
