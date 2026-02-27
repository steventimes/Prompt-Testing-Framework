import { useEffect, useState } from 'react'
import { Play, Loader2, Plus, Trash2, Zap, X, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiFetch } from '../lib/api'

const QUICK_HISTORY_KEY = 'ptf_quick_test_history'

function QuickTest({ onClose }) {
  const [promptContent, setPromptContent] = useState('You are a helpful assistant. Answer this question: {{question}}')
  const [testInputs, setTestInputs] = useState([{ question: '' }])
  const [aiProvider] = useState('openai')
  const [modelName, setModelName] = useState('gpt-3.5-turbo')
  const [results, setResults] = useState(null)
  const [testing, setTesting] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    const existing = sessionStorage.getItem(QUICK_HISTORY_KEY)
    if (existing) {
      setHistory(JSON.parse(existing))
    }
  }, [])

  useEffect(() => {
    sessionStorage.setItem(QUICK_HISTORY_KEY, JSON.stringify(history))
  }, [history])

  const addTestInput = () => setTestInputs([...testInputs, { question: '' }])

  const removeTestInput = (index) => {
    if (testInputs.length > 1) {
      setTestInputs(testInputs.filter((_, i) => i !== index))
    }
  }

  const updateTestInput = (index, value) => {
    const updated = [...testInputs]
    updated[index] = { question: value }
    setTestInputs(updated)
  }

  const runQuickTest = async () => {
    if (!promptContent.trim()) {
      toast.error('Please enter a prompt template')
      return
    }

    setTesting(true)
    setResults(null)

    const apiKey = localStorage.getItem('openai_api_key') || ''

    try {
      const formattedInputs = testInputs.map((input) => ({ question: input.question }))

      const response = await apiFetch('/quick-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({
          promptContent,
          aiProvider,
          modelName,
          testInputs: formattedInputs,
        }),
      })

      if (!response.ok) throw new Error('Test failed')

      const data = await response.json()
      setResults(data)
      setHistory((prev) => [
        {
          id: data.id,
          executedAt: new Date().toISOString(),
          modelName,
          inputs: formattedInputs.length,
          avgLatency: data.metrics?.averageResponseTimeMs,
          avgQuality: data.metrics?.averageQualityScore,
        },
        ...prev,
      ].slice(0, 12))
      toast.success('Quick test completed!')
    } catch (error) {
      console.error(error)
      toast.error('Failed to run test. Check backend connection.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Quick Playground
        </h2>

        <div className="flex items-center gap-3">
          <select
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1 bg-gray-50 outline-none focus:border-blue-500"
          >
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-4o">GPT-4o</option>
          </select>

          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Prompt Template</label>
            <textarea
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              className="w-full h-40 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-gray-50 resize-none outline-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              Use <code className="bg-gray-100 px-1 rounded text-gray-700">{'{{variable}}'}</code> for dynamic inputs.
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">Test Cases</label>
              <button onClick={addTestInput} className="text-blue-600 text-sm hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Case
              </button>
            </div>
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
              {testInputs.map((input, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <span className="text-xs text-gray-400 mt-3 w-4">{index + 1}.</span>
                  <input
                    type="text"
                    value={input.question}
                    onChange={(e) => updateTestInput(index, e.target.value)}
                    placeholder="Value for {{question}}"
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  {testInputs.length > 1 && (
                    <button
                      onClick={() => removeTestInput(index)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={runQuickTest}
            disabled={testing}
            className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
              testing ? 'bg-blue-400 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {testing ? 'Running...' : 'Run Quick Test'}
          </button>

          <div className="bg-slate-50 rounded-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-700">Latest Result</div>
            <div className="p-4 max-h-[280px] overflow-auto">
              {!results ? (
                <p className="text-sm text-slate-400">Run a test to see results here.</p>
              ) : (
                <div className="space-y-3">
                  {results.results?.map((result, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 text-sm">
                      <div className="text-xs text-slate-500 mb-1">Input: {JSON.stringify(result.inputVariables)}</div>
                      <div className="whitespace-pre-wrap text-slate-800">{result.aiResponse}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="bg-gradient-to-b from-slate-50 to-white border border-slate-200 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-indigo-500" />
            Session History
          </h3>
          <p className="text-xs text-slate-500 mb-3">Saved for this tab until the site is closed.</p>
          <div className="space-y-2 max-h-[520px] overflow-auto">
            {history.length === 0 ? (
              <div className="text-xs text-slate-400">No quick tests yet.</div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="bg-white rounded-lg border border-slate-200 p-3 text-xs">
                  <div className="font-semibold text-slate-700">{item.modelName}</div>
                  <div className="text-slate-500">{new Date(item.executedAt).toLocaleTimeString()}</div>
                  <div className="mt-1 text-slate-600">{item.inputs} inputs • {item.avgLatency}ms • Q {item.avgQuality}</div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default QuickTest
