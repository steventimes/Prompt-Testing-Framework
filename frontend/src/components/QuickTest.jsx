import { useState } from 'react'
import { Play, Loader2, Plus, Trash2, Zap, X } from 'lucide-react'
import toast from 'react-hot-toast'

function QuickTest({ onClose }) {
  const [promptContent, setPromptContent] = useState('')
  const [testInputs, setTestInputs] = useState([{ question: '' }])
  const [aiProvider] = useState('openai')
  const [modelName, setModelName] = useState('gpt-3.5-turbo')
  const [results, setResults] = useState(null)
  const [testing, setTesting] = useState(false)

  const addTestInput = () => {
    setTestInputs([...testInputs, { question: '' }])
  }

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
      const formattedInputs = testInputs.map(input => ({ question: input.question }))

      const response = await fetch('http://localhost:8080/api/quick-test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey
        },
        body: JSON.stringify({
          promptContent,
          aiProvider,
          modelName,
          testInputs: formattedInputs
        })
      })

      if (!response.ok) throw new Error('Test failed')
      
      const data = await response.json()
      setResults(data)
      toast.success('Quick test completed!')
    } catch (error) {
      console.error(error)
      toast.error('Failed to run test. Check backend connection.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Quick Playground
        </h2>
        
        <div className="flex items-center gap-3">
           {/* Model Selector */}
           <select 
             value={modelName}
             onChange={(e) => setModelName(e.target.value)}
             className="text-sm border border-gray-300 rounded-lg px-3 py-1 bg-gray-50 outline-none focus:border-blue-500"
           >
             <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
             <option value="gpt-4">GPT-4</option>
             <option value="gpt-4o">GPT-4o</option>
           </select>

           {/* FIXED: Added Close Button using onClose */}
           <button 
             onClick={onClose}
             className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
           >
             <X className="w-5 h-5" />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Inputs */}
        <div className="space-y-6">
          
          {/* Prompt Editor */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Prompt Template</label>
            <textarea
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              placeholder="You are a helpful assistant. Answer this question: {{question}}"
              className="w-full h-40 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-gray-50 resize-none outline-none"
            />
            {/* FIXED: Passed '{{variable}}' as a string literal */}
            <p className="text-xs text-gray-500 mt-2">
              Use <code className="bg-gray-100 px-1 rounded text-gray-700">{'{{variable}}'}</code> for dynamic inputs.
            </p>
          </div>

          {/* Test Inputs */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">Test Cases</label>
              <button onClick={addTestInput} className="text-blue-600 text-sm hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Case
              </button>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {testInputs.map((input, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <span className="text-xs text-gray-400 mt-3 w-4">{index + 1}.</span>
                  <input
                    type="text"
                    value={input.question}
                    onChange={(e) => updateTestInput(index, e.target.value)}
                    placeholder={`Value for {{question}}`}
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
            className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all
              ${testing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-200'}`}
          >
            {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {testing ? 'Running...' : 'Run Quick Test'}
          </button>
        </div>

        {/* Right Column: Results */}
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 h-full min-h-[500px] flex flex-col">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">Results</h3>
          
          {!results ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <Zap className="w-12 h-12 mb-3 opacity-20" />
              <p>Run a test to see results here</p>
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
              {/* Metrics Header */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                 <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <div className="text-xs text-gray-500">Latency</div>
                    <div className="font-mono font-bold text-gray-800">
                        {Math.round(results.metrics.averageResponseTimeMs)}ms
                    </div>
                 </div>
                 <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <div className="text-xs text-gray-500">Cost (Est)</div>
                    <div className="font-mono font-bold text-gray-800">
                        ${results.metrics.totalCostUsd.toFixed(5)}
                    </div>
                 </div>
                 <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <div className="text-xs text-gray-500">Tokens</div>
                    <div className="font-mono font-bold text-gray-800">
                        {results.metrics.totalTokens}
                    </div>
                 </div>
              </div>

              {results.results.map((res, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="mb-2 text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded">
                    Input: {JSON.stringify(res.inputVariables)}
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100 font-mono text-xs whitespace-pre-wrap">
                    {res.aiResponse}
                  </div>
                  <div className="mt-2 flex justify-end gap-3 text-xs text-gray-400 font-mono">
                    <span>{res.responseTimeMs}ms</span>
                    <span>|</span>
                    <span>{res.tokenCount} tokens</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default QuickTest