import { useState } from 'react'

function QuickTest({ onClose }) {
  const [promptContent, setPromptContent] = useState('')
  const [testInputs, setTestInputs] = useState([{ question: '' }])
  const [aiProvider, setAiProvider] = useState('openai')
  const [modelName, setModelName] = useState('gpt-4')
  const [results, setResults] = useState(null)
  const [testing, setTesting] = useState(false)
  const [history, setHistory] = useState([])

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
      alert('Please enter a prompt')
      return
    }

    setTesting(true)
    try {
      const response = await fetch('http://localhost:8080/api/quick-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptContent,
          aiProvider,
          modelName,
          testInputs: testInputs.filter(input => input.question.trim())
        })
      })
      
      if (!response.ok) {
        throw new Error('Test failed')
      }
      
      const data = await response.json()
      setResults(data)
      
      // Add to history
      setHistory([{
        id: Date.now(),
        timestamp: new Date(),
        promptContent,
        aiProvider,
        modelName,
        testInputs,
        results: data
      }, ...history])
      
    } catch (error) {
      console.error('Error running quick test:', error)
      alert('Failed to run test. Make sure your backend is running.')
    }
    setTesting(false)
  }

  const loadFromHistory = (item) => {
    setPromptContent(item.promptContent)
    setAiProvider(item.aiProvider)
    setModelName(item.modelName)
    setTestInputs(item.testInputs)
    setResults(null)
  }

  const resetTest = () => {
    setResults(null)
  }

  // Results View
  if (results) {
    return (
      <div className="bg-white rounded-lg shadow-xl border-2 border-blue-500 p-8 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Quick Test Results</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <div className="text-sm text-gray-600 mb-1">Avg Response Time</div>
            <div className="text-2xl font-bold text-blue-600">
              {results.metrics.averageResponseTimeMs.toFixed(0)}ms
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <div className="text-sm text-gray-600 mb-1">Avg Quality</div>
            <div className="text-2xl font-bold text-green-600">
              {results.metrics.averageQualityScore.toFixed(2)}
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
            <div className="text-sm text-gray-600 mb-1">Total Tokens</div>
            <div className="text-2xl font-bold text-purple-600">
              {results.metrics.totalTokens}
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
            <div className="text-sm text-gray-600 mb-1">Total Cost</div>
            <div className="text-2xl font-bold text-orange-600">
              ${results.metrics.totalCostUsd.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Results ({results.results.length})
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {results.results.map((result, idx) => (
              <div key={idx} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-900">Test #{idx + 1}</span>
                  <div className="flex gap-3 text-sm">
                    <span className="text-gray-600">{result.responseTimeMs}ms</span>
                    <span className="text-green-600 font-medium">
                      Score: {result.qualityScore.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-600">Input: </span>
                  <span className="text-base text-gray-800">
                    {result.inputVariables?.question}
                  </span>
                </div>
                <div className="bg-white p-3 rounded border border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Response: </span>
                  <p className="text-gray-800 mt-1">{result.aiResponse}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button 
            onClick={resetTest}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium"
          >
            Test Again
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  // Form View
  return (
    <div className="bg-white rounded-lg shadow-xl border-2 border-blue-500 p-8 animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Quick Test</h2>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-2xl"
        >
          ×
        </button>
      </div>

      {/* History Dropdown */}
      {history.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <label className="block text-base font-medium text-gray-700 mb-2">
            📋 Load from History ({history.length} tests)
          </label>
          <select 
            onChange={(e) => {
              if (e.target.value) {
                const item = history.find(h => h.id === parseInt(e.target.value))
                if (item) loadFromHistory(item)
              }
            }}
            className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select a previous test...</option>
            {history.map(item => (
              <option key={item.id} value={item.id}>
                {item.timestamp.toLocaleString()} - {item.promptContent.substring(0, 50)}...
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Prompt Content */}
      <div className="mb-6">
        <label className="block text-base font-medium text-gray-700 mb-2">
          Prompt Content
        </label>
        <textarea
          value={promptContent}
          onChange={(e) => setPromptContent(e.target.value)}
          placeholder="Enter your prompt here, e.g., 'You are a helpful assistant. Answer this question: {question}'"
          rows={4}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none resize-y"
        />
        <p className="text-sm text-gray-500 mt-1">
          💡 Use {'{question}'} as a placeholder for test inputs
        </p>
      </div>

      {/* AI Provider */}
      <div className="mb-6">
        <label className="block text-base font-medium text-gray-700 mb-2">
          AI Provider & Model
        </label>
        <div className="flex gap-4">
          <select 
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value)}
            className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
          <input 
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="e.g., gpt-4, claude-3-opus"
            className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Test Inputs */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-base font-medium text-gray-700">
            Test Inputs ({testInputs.length})
          </label>
          <button 
            onClick={addTestInput}
            className="text-blue-600 hover:text-blue-800 text-base font-medium"
          >
            + Add Input
          </button>
        </div>
        <div className="space-y-3">
          {testInputs.map((input, index) => (
            <div key={index} className="flex gap-2">
              <textarea
                value={input.question}
                onChange={(e) => updateTestInput(index, e.target.value)}
                placeholder={`Test input #${index + 1}: e.g., "How do I reset my password?"`}
                rows={2}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none resize-y"
              />
              {testInputs.length > 1 && (
                <button 
                  onClick={() => removeTestInput(index)}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Run Button */}
      <button 
        onClick={runQuickTest}
        disabled={testing}
        className={`w-full px-8 py-4 rounded-lg text-lg font-medium transition-colors
          ${testing
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
      >
        {testing ? 'Running Test...' : 'Run Quick Test'}
      </button>
    </div>
  )
}

export default QuickTest