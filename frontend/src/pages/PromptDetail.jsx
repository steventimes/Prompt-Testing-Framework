import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

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
  const [testingStage, setTestingStage] = useState('')
  
  const [testHistory, setTestHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  
  const [showCreateVersion, setShowCreateVersion] = useState(false)
  const [newVersionContent, setNewVersionContent] = useState('')
  const [creatingVersion, setCreatingVersion] = useState(false)

  const fetchPrompt = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:8080/api/prompts/${id}`)
      const data = await response.json()
      setPrompt(data)
      setLoading(false)
      
      if (data.versions && data.versions.length > 0) {
        const latest = data.versions[data.versions.length - 1]
        setSelectedVersionId(latest.id)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to load prompt')
      setLoading(false)
    }
  }, [id])

  const fetchTestHistory = useCallback(async (versionId) => {
    setLoadingHistory(true)
    try {
      const response = await fetch(`http://localhost:8080/api/test-runs/version/${versionId}`)
      const data = await response.json()
      setTestHistory(data)
    } catch (error) {
      console.error('Error loading history:', error)
    }
    setLoadingHistory(false)
  }, [])

  useEffect(() => {
    fetchPrompt()
  }, [fetchPrompt])

  useEffect(() => {
    if (selectedVersionId) {
      fetchTestHistory(selectedVersionId)
    }
  }, [selectedVersionId, fetchTestHistory])

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

  const loadInputsFromHistory = (testRun) => {
    const inputs = testRun.results.map(result => ({
      question: result.inputVariables?.question || ''
    }))
    setTestInputs(inputs)
    setAiProvider(testRun.aiProvider)
    setModelName(testRun.modelName)
    toast.success(`Loaded ${inputs.length} test inputs from history`)
    
    document.getElementById('test-interface')?.scrollIntoView({ behavior: 'smooth' })
  }

  const runTest = async () => {
    if (!selectedVersionId) {
      toast.error('Please select a version to test')
      return
    }

    const filledInputs = testInputs.filter(input => input.question.trim())
    if (filledInputs.length === 0) {
      toast.error('Please add at least one test input')
      return
    }

    setTesting(true)
    
    const stages = [
      'Preparing test request...',
      'Sending to AI provider...',
      'Processing response...',
      'Calculating metrics...'
    ]
    
    let stageIndex = 0
    setTestingStage(stages[0])
    
    const stageInterval = setInterval(() => {
      stageIndex = (stageIndex + 1) % stages.length
      setTestingStage(stages[stageIndex])
    }, 800)

    try {
      const response = await fetch('http://localhost:8080/api/test-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptVersionId: selectedVersionId,
          aiProvider,
          modelName,
          testInputs: filledInputs
        })
      })
      
      clearInterval(stageInterval)
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }
      
      const data = await response.json()
      setTestResults(data)
      toast.success(`✓ Test completed! ${data.results.length} results generated`)
      
      fetchTestHistory(selectedVersionId)
    } catch (error) {
      clearInterval(stageInterval)
      console.error('Error running test:', error)
      toast.error('Failed to run test. Check if backend is running.')
    }
    setTesting(false)
    setTestingStage('')
  }

  const createNewVersion = async () => {
    if (!newVersionContent.trim()) {
      toast.error('Version content cannot be empty')
      return
    }

    setCreatingVersion(true)
    try {
      const response = await fetch(`http://localhost:8080/api/prompts/${id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newVersionContent })
      })
      
      if (!response.ok) {
        throw new Error('Failed to create version')
      }
      
      toast.success('✓ New version created!')
      setShowCreateVersion(false)
      setNewVersionContent('')
      
      fetchPrompt()
    } catch (error) {
      console.error('Error creating version:', error)
      toast.error('Failed to create version')
    }
    setCreatingVersion(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-600">Loading prompt details...</div>
        </div>
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

  if (testResults) {
    return (
      <div className="min-h-screen bg-transparent py-8 px-4">
        <Toaster position="top-right" />
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
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <div className="text-sm text-gray-600">Avg Response Time</div>
                <div className="text-2xl font-bold text-blue-600">
                  {testResults.metrics.averageResponseTimeMs.toFixed(0)}ms
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                <div className="text-sm text-gray-600">Avg Quality Score</div>
                <div className="text-2xl font-bold text-green-600">
                  {testResults.metrics.averageQualityScore.toFixed(2)}
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                <div className="text-sm text-gray-600">Total Tokens</div>
                <div className="text-2xl font-bold text-purple-600">
                  {testResults.metrics.totalTokens}
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
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
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent py-8 px-4">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <button 
          onClick={() => navigate('/')}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2 text-lg font-medium"
        >
          ← Back to all prompts
        </button>

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

        <div className="bg-white rounded-lg shadow-md border-2 border-gray-100 p-8 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">
              Prompt Versions ({prompt.versions?.length || 0})
            </h2>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  const latest = prompt.versions[prompt.versions.length - 1]
                  setSelectedVersionId(latest.id)
                  document.getElementById('test-interface')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Load Latest
              </button>
              <button 
                onClick={() => setShowCreateVersion(!showCreateVersion)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                + New Version
              </button>
            </div>
          </div>

          {showCreateVersion && (
            <div className="mb-6 p-6 bg-green-50 rounded-lg border-2 border-green-200 animate-fadeIn">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Create New Version
              </h3>
              <textarea
                value={newVersionContent}
                onChange={(e) => setNewVersionContent(e.target.value)}
                placeholder="Enter the new prompt content here...
Example: You are an expert assistant. Answer this question professionally: {question}"
                rows={6}
                className="w-full px-4 py-3 border-2 border-green-300 rounded-lg text-base focus:border-green-500 focus:outline-none resize-y font-mono mb-3"
              />
              <div className="flex gap-3">
                <button 
                  onClick={createNewVersion}
                  disabled={creatingVersion}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    creatingVersion 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {creatingVersion ? 'Creating...' : 'Create Version'}
                </button>
                <button 
                  onClick={() => {
                    setShowCreateVersion(false)
                    setNewVersionContent('')
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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

        {selectedVersionId && (
          <div className="bg-white rounded-lg shadow-md border-2 border-gray-100 p-8 mb-6">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex justify-between items-center mb-4"
            >
              <h2 className="text-2xl font-semibold text-gray-900">
                Test History ({testHistory.length})
              </h2>
              <span className="text-blue-600 text-lg">
                {showHistory ? '▼ Hide' : '▶ Show'}
              </span>
            </button>

            {showHistory && (
              <div className="space-y-4 animate-fadeIn">
                {loadingHistory ? (
                  <div className="text-center text-gray-500 py-8">
                    Loading history...
                  </div>
                ) : testHistory.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No test history yet. Run a test to see results here!
                  </div>
                ) : (
                  testHistory.map(testRun => (
                    <div key={testRun.id} className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-gray-900 text-lg">
                            Test Run #{testRun.id}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(testRun.startedAt).toLocaleString()} • {testRun.aiProvider} • {testRun.modelName}
                          </div>
                        </div>
                        <button
                          onClick={() => loadInputsFromHistory(testRun)}
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                        >
                          📋 Load Inputs
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-3 mb-3">
                        <div className="bg-blue-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Avg Time</div>
                          <div className="text-sm font-bold text-blue-600">
                            {testRun.metrics.averageResponseTimeMs.toFixed(0)}ms
                          </div>
                        </div>
                        <div className="bg-green-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Avg Quality</div>
                          <div className="text-sm font-bold text-green-600">
                            {testRun.metrics.averageQualityScore.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-purple-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Tokens</div>
                          <div className="text-sm font-bold text-purple-600">
                            {testRun.metrics.totalTokens}
                          </div>
                        </div>
                        <div className="bg-orange-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Cost</div>
                          <div className="text-sm font-bold text-orange-600">
                            ${testRun.metrics.totalCostUsd.toFixed(4)}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Test Inputs:</span>
                        <div className="mt-1 space-y-1">
                          {testRun.results.map((result, idx) => (
                            <div key={idx} className="pl-3 border-l-2 border-gray-300">
                              {result.inputVariables?.question}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div id="test-interface" className="bg-white rounded-lg shadow-md border-2 border-gray-100 p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Run Test
          </h2>

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

          <button 
            onClick={runTest}
            disabled={testing || !selectedVersionId}
            className={`px-8 py-4 rounded-lg text-lg font-medium transition-colors
              ${testing || !selectedVersionId
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            {testing ? (
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{testingStage}</span>
              </div>
            ) : (
              'Run Test'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PromptDetail