import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

function PromptDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [prompt, setPrompt] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [testInputs, setTestInputs] = useState([{ question: '' }])
  const [aiProvider, setAiProvider] = useState('openai')
  const [modelName, setModelName] = useState('gpt-4')
  const [testResults, setTestResults] = useState(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetch(`http://localhost:8080/api/prompts/${id}`)
      .then(response => response.json())
      .then(data => {
        setPrompt(data)
        setLoading(false)
        if (data.versions && data.versions.length > 0) {
          const latest = data.versions[data.versions.length - 1]
          setSelectedVersionId(latest.id)
        }
      })
      .catch(error => {
        console.error('Error:', error)
        setLoading(false)
      })
  }, [id])

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

  const runTest = async () => {
    if (!selectedVersionId) {
      alert('Please select a version to test')
      return
    }

    setTesting(true)
    try {
      const response = await fetch('http://localhost:8080/api/test-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptVersionId: selectedVersionId,
          aiProvider,
          modelName,
          testInputs
        })
      })
      const data = await response.json()
      setTestResults(data)
    } catch (error) {
      console.error('Error running test:', error)
      alert('Failed to run test')
    }
    setTesting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading prompt details...</div>
      </div>
    )
  }

  if (!prompt) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-xl text-red-600">Prompt not found</div>
      </div>
    )
  }

  //results view
  if (testResults) {
    return (
      <div className="min-h-screen bg-transparent py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <button 
            onClick={() => setTestResults(null)}
            className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2 text-lg font-medium"
          >
            ← Back to test interface
          </button>

          <div className="bg-white rounded-lg shadow-md border-2 border-gray-100 p-8 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Test Results
            </h1>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Avg Response Time</div>
                <div className="text-2xl font-bold text-blue-600">
                  {testResults.metrics.averageResponseTimeMs.toFixed(0)}ms
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Avg Quality Score</div>
                <div className="text-2xl font-bold text-green-600">
                  {testResults.metrics.averageQualityScore.toFixed(2)}
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Total Tokens</div>
                <div className="text-2xl font-bold text-purple-600">
                  {testResults.metrics.totalTokens}
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Total Cost</div>
                <div className="text-2xl font-bold text-orange-600">
                  ${testResults.metrics.totalCostUsd.toFixed(4)}
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Individual Results ({testResults.results.length})
            </h2>
            <div className="space-y-4">
              {testResults.results.map((result, idx) => (
                <div key={result.id} className="border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-semibold text-gray-900 text-lg">Test #{idx + 1}</span>
                    <div className="flex gap-4 text-sm">
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
                  <div className="bg-gray-50 p-3 rounded text-base">
                    <span className="text-sm font-medium text-gray-600">Response: </span>
                    <p className="text-gray-800 mt-1">{result.aiResponse}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-6">
              <button 
                onClick={() => setTestResults(null)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium"
              >
                Run Again
              </button>
              <button 
                onClick={() => alert('Save functionality coming soon!')}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-medium"
              >
                Save Results
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // test interface
  return (
    <div className="min-h-screen bg-transparent py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <button 
          onClick={() => navigate('/')}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2 text-lg font-medium"
        >
          ← Back to all prompts
        </button>

        {/* Prompt Header */}
        <div className="bg-white rounded-lg shadow-md border-2 border-gray-100 p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {prompt.name}
          </h1>
          <p className="text-gray-700 mb-4 text-base">
            {prompt.description}
          </p>
          <div className="text-base text-gray-500">
            Created: {new Date(prompt.createdAt).toLocaleDateString()}
          </div>
        </div>

        {/* Version Selection */}
        <div className="bg-white rounded-lg shadow-md border-2 border-gray-100 p-8 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">
              Select Version ({prompt.versions?.length || 0})
            </h2>
            <button 
              onClick={() => {
                const latest = prompt.versions[prompt.versions.length - 1]
                setSelectedVersionId(latest.id)
                document.getElementById('test-interface').scrollIntoView({ behavior: 'smooth' })
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Load Latest Version
            </button>
          </div>
          <div className="space-y-4">
            {prompt.versions?.map(version => (
              <div 
                key={version.id}
                onClick={() => setSelectedVersionId(version.id)}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all
                  ${selectedVersionId === version.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`font-semibold text-lg ${
                    selectedVersionId === version.id ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    Version {version.versionNumber}
                    {selectedVersionId === version.id && ' ✓'}
                  </span>
                  <span className="text-base text-gray-500">
                    {new Date(version.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <pre className="bg-white p-4 rounded text-base overflow-x-auto whitespace-pre-wrap font-mono border border-gray-200">
                  {version.content}
                </pre>
              </div>
            ))}
          </div>
        </div>

        {/* Test Interface */}
        <div id="test-interface" className="bg-white rounded-lg shadow-md border-2 border-gray-100 p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Run Test
          </h2>

          {/* AI Provider Selection */}
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
            onClick={runTest}
            disabled={testing || !selectedVersionId}
            className={`px-8 py-4 rounded-lg text-lg font-medium transition-colors
              ${testing || !selectedVersionId
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            {testing ? 'Running Test...' : 'Run Test'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PromptDetail