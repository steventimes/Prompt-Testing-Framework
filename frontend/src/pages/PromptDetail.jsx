import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { 
  ArrowLeft, Save, Play, Clock, 
  BarChart3, Database, Split, Download 
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

function PromptDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [testInputs, setTestInputs] = useState([{ question: '' }])
  const [modelName, setModelName] = useState('gpt-3.5-turbo')
  const [testing, setTesting] = useState(false)
  const [currentResult, setCurrentResult] = useState(null)
  const [testHistory, setTestHistory] = useState([])
  const [newVersionContent, setNewVersionContent] = useState('')
  const [isCreatingVersion, setIsCreatingVersion] = useState(false)

  const fetchPrompt = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/prompts/${id}`)
      if (!response.ok) throw new Error('Failed to load prompt')
      const data = await response.json()
      setPrompt(data)
      
      if (!selectedVersionId && data.versions && data.versions.length > 0) {
        const latest = data.versions[data.versions.length - 1]
        setSelectedVersionId(latest.id)
        setNewVersionContent(latest.content)
      }
      setLoading(false)
    } catch (error) {
      console.error(error)
      toast.error('Failed to load prompt')
      setLoading(false)
    }
  }, [id, selectedVersionId])

  const fetchHistory = useCallback(async (versionId) => {
    if (!versionId) return
    try {
      const response = await fetch(`${API_BASE}/test-runs/version/${versionId}`)
      if (response.ok) {
        const data = await response.json()
        setTestHistory(data)
      }
    } catch (error) {
      console.error('Failed to load history', error)
    }
  }, [])

  useEffect(() => {
    fetchPrompt()
  }, [fetchPrompt])

  useEffect(() => {
    if (selectedVersionId) {
      fetchHistory(selectedVersionId)
      const version = prompt?.versions?.find(v => v.id == selectedVersionId)
      if (version) setNewVersionContent(version.content)
    }
  }, [selectedVersionId, prompt, fetchHistory])

  const downloadCSV = () => {
    if (!currentResult || !currentResult.results) {
        toast.error("No results to export")
        return
    }
   
    let csvContent = "data:text/csv;charset=utf-8,Input,Output,Latency(ms),Cost($),Quality(0-1)\n"

    currentResult.results.forEach(row => {
        const inputStr = JSON.stringify(row.inputVariables).replace(/"/g, '""')
        const outputStr = row.aiResponse ? row.aiResponse.replace(/"/g, '""').replace(/(\r\n|\n|\r)/gm, " ") : ""
        
        csvContent += `"${inputStr}","${outputStr}",${row.responseTimeMs},${row.costUsd},${row.qualityScore}\n`
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `test_run_${currentResult.id}_v${selectedVersionId}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("CSV Downloaded")
  }

  const handleCreateVersion = async () => {
    if (!newVersionContent.trim()) return
    setIsCreatingVersion(true)
    try {
      const response = await fetch(`${API_BASE}/prompts/${id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newVersionContent })
      })
      if (response.ok) {
        toast.success('New version saved!')
        const updatedPromptRes = await fetch(`${API_BASE}/prompts/${id}`)
        const updatedPrompt = await updatedPromptRes.json()
        setPrompt(updatedPrompt)
        
        const latest = updatedPrompt.versions[updatedPrompt.versions.length - 1]
        setSelectedVersionId(latest.id)
      } else {
        toast.error('Failed to save version')
      }
    } finally {
      setIsCreatingVersion(false)
    }
  }

  const runTest = async () => {
    if (!selectedVersionId) return
    setTesting(true)
    setCurrentResult(null)

    const apiKey = localStorage.getItem('openai_api_key') || ''
    
    try {
        const formattedInputs = testInputs.map(input => ({ question: input.question }))
        
        const response = await fetch(`${API_BASE}/test-runs`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey 
            },
            body: JSON.stringify({
                promptVersionId: selectedVersionId,
                aiProvider: 'openai',
                modelName: modelName,
                testInputs: formattedInputs
            })
        })
        
        const data = await response.json()
        setCurrentResult(data)
        toast.success('Test run completed')
        fetchHistory(selectedVersionId)
    } catch (e) {
        toast.error('Test failed')
        console.error(e)
    } finally {
        setTesting(false)
    }
  }

  if (loading) return <div className="p-10 text-center text-gray-500">Loading workspace...</div>

  const currentVersion = prompt?.versions?.find(v => v.id == selectedVersionId)
  const isModified = currentVersion && currentVersion.content !== newVersionContent

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
        {/* Navbar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">{prompt?.name}</h1>
                    <p className="text-xs text-gray-500">{prompt?.description || 'No description'}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                 <button 
                    onClick={() => navigate(`/prompt/${id}/compare`)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm"
                 >
                    <Split className="w-4 h-4 text-purple-600" />
                    Compare
                 </button>

                 <div className="h-6 w-px bg-gray-300 mx-1"></div>

                 <select 
                    value={selectedVersionId || ''} 
                    onChange={(e) => setSelectedVersionId(e.target.value)}
                    className="bg-gray-100 border-none text-sm font-medium py-2 px-4 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                 >
                    {prompt?.versions?.map(v => (
                        <option key={v.id} value={v.id}>Version {v.versionNumber}</option>
                    ))}
                 </select>

                 <button 
                    onClick={handleCreateVersion}
                    disabled={isCreatingVersion || !isModified}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm
                        ${isModified 
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                 >
                    <Save className="w-4 h-4" />
                    {isCreatingVersion ? 'Saving...' : `Save as V${(prompt?.versions?.length || 0) + 1}`}
                 </button>
            </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-12 gap-6">
            
            {/* Left Col: Editor & Inputs (7 cols) */}
            <div className="col-span-12 lg:col-span-7 space-y-6">
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[400px]">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide flex justify-between">
                        <span>Prompt Template</span>
                        {isModified && <span className="text-amber-600">Unsaved Changes</span>}
                    </div>
                    <textarea 
                        value={newVersionContent}
                        onChange={(e) => setNewVersionContent(e.target.value)}
                        className="flex-1 w-full p-6 outline-none font-mono text-sm leading-relaxed text-gray-800 resize-none"
                        placeholder="Write your prompt here. Use {{variable}} for inputs."
                    />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Database className="w-4 h-4 text-blue-500" />
                            Test Inputs
                        </h3>
                        <div className="flex gap-2">
                             <select 
                                value={modelName}
                                onChange={(e) => setModelName(e.target.value)}
                                className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none"
                             >
                                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                <option value="gpt-4">GPT-4</option>
                             </select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {testInputs.map((input, idx) => (
                            <div key={idx} className="flex gap-3">
                                <input 
                                    type="text" 
                                    value={input.question}
                                    onChange={(e) => {
                                        const newInputs = [...testInputs]
                                        newInputs[idx].question = e.target.value
                                        setTestInputs(newInputs)
                                    }}
                                    className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Value for {{question}}..."
                                />
                                {idx === testInputs.length - 1 && (
                                    <button 
                                        onClick={() => setTestInputs([...testInputs, { question: '' }])}
                                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 text-sm"
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={runTest}
                        disabled={testing}
                        className="mt-6 w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        {testing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        Run Full Test
                    </button>
                </div>
            </div>

            {/* Right Col: Analytics & Results (5 cols) */}
            <div className="col-span-12 lg:col-span-5 space-y-6">
                
                {/* Active Result */}
                {currentResult && (
                    <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden animate-fadeIn">
                        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                            <span className="text-sm font-bold text-blue-800">Latest Run Results</span>
                            
                            {/* 3. DOWNLOAD BUTTON */}
                            <div className="flex gap-2">
                                <button 
                                    onClick={downloadCSV}
                                    className="flex items-center gap-1 bg-white px-2 py-1 rounded text-xs border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
                                    title="Download CSV"
                                >
                                    <Download className="w-3 h-3" />
                                    CSV
                                </button>
                                <span className="bg-white px-2 py-1 rounded border border-blue-100 text-blue-600 text-xs flex items-center">
                                    Score: {currentResult.metrics.averageQualityScore?.toFixed(2) || 'N/A'}
                                </span>
                            </div>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
                            {currentResult.results.map((res, i) => (
                                <div key={i} className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
                                    <div className="font-mono text-xs text-gray-500 mb-1">
                                        Input: {JSON.stringify(res.inputVariables)}
                                    </div>
                                    <p className="text-gray-800 whitespace-pre-wrap">{res.aiResponse}</p>
                                    <div className="mt-2 flex gap-3 text-xs text-gray-400 border-t border-gray-200 pt-2">
                                        <span>Cost: ${res.costUsd}</span>
                                        <span className={res.qualityScore >= 0.7 ? "text-green-600 font-bold" : "text-amber-600"}>
                                            Quality: {res.qualityScore}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Analytics Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                     <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-purple-500" />
                        Latency History (Last 10 Runs)
                     </h3>
                     <div className="h-[200px] w-full">
                         {testHistory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={[...testHistory].reverse().slice(0, 10)}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="id" hide />
                                    <YAxis width={30} fontSize={10} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Line type="monotone" dataKey="metrics.averageResponseTimeMs" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                         ) : (
                             <div className="h-full flex items-center justify-center text-gray-400 text-xs">No history data</div>
                         )}
                     </div>
                </div>

                {/* History List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[400px]">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-sm font-bold text-gray-800">Run History</h3>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {testHistory.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-sm">No runs recorded</div>
                        ) : (
                            testHistory.map(run => (
                                <div key={run.id} className="p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex justify-between items-center cursor-pointer group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${run.status === 'COMPLETED' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                        <div>
                                            <div className="text-xs font-medium text-gray-900 group-hover:text-blue-600">Run #{run.id}</div>
                                            <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(run.startedAt).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-gray-700">{Math.round(run.metrics?.averageResponseTimeMs || 0)}ms</div>
                                        <div className="text-[10px] text-gray-400 flex items-center gap-1 justify-end">
                                            {run.metrics?.averageQualityScore > 0 && (
                                                <span className="text-purple-500 font-medium">Q: {run.metrics.averageQualityScore.toFixed(2)}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  )
}

export default PromptDetail