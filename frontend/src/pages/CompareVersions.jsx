import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Split, Zap, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

function CompareVersions() {
  const { id } = useParams() 
  const navigate = useNavigate()

  const [prompt, setPrompt] = useState(null)
  const [verA, setVerA] = useState('')
  const [verB, setVerB] = useState('')
  const [inputVal, setInputVal] = useState('Explain quantum computing')

  const [loading, setLoading] = useState(false)
  const [resultA, setResultA] = useState(null)
  const [resultB, setResultB] = useState(null)

  useEffect(() => {
    fetch(`http://localhost:8080/api/prompts/${id}`)
      .then(r => r.json())
      .then(data => {
        setPrompt(data)
        if (data.versions?.length >= 2) {
            setVerA(data.versions[data.versions.length - 1].id)
            setVerB(data.versions[data.versions.length - 2].id)
        } else if (data.versions?.length === 1) {
            setVerA(data.versions[0].id)
            setVerB(data.versions[0].id)
        }
      })
  }, [id])

  const runComparison = async () => {
    if (!verA || !verB) return toast.error("Select two versions")
    setLoading(true)
    setResultA(null) 
    setResultB(null)
    
    const apiKey = localStorage.getItem('openai_api_key')

    const runOne = async (versionId) => {
        const res = await fetch('http://localhost:8080/api/test-runs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey || '' },
            body: JSON.stringify({
                promptVersionId: versionId,
                aiProvider: 'openai',
                modelName: 'gpt-3.5-turbo',
                testInputs: [{ question: inputVal }]
            })
        })
        return res.json()
    }

    try {
        const [resA, resB] = await Promise.all([runOne(verA), runOne(verB)])
        setResultA(resA.results[0])
        setResultB(resB.results[0])
        toast.success("Comparison complete")
    } catch {
        toast.error("Failed to run comparison")
    } finally {
        setLoading(false)
    }
  }

  if (!prompt) return <div className="p-10">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/prompt/${id}`)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Split className="w-5 h-5 text-blue-600" />
                Compare Versions: {prompt.name}
            </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Controls */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
            <div className="flex gap-4 mb-4">
                <input 
                    type="text" 
                    value={inputVal} 
                    onChange={e => setInputVal(e.target.value)}
                    className="flex-1 border p-3 rounded-lg font-mono text-sm"
                    placeholder="Enter test input value (e.g. for {{question}})..."
                />
                <button 
                    onClick={runComparison}
                    disabled={loading}
                    className="px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? 'Running...' : 'Run Comparison'}
                </button>
            </div>
            
            <div className="grid grid-cols-2 gap-8 text-sm text-gray-500 font-medium">
                <div>
                    Select Left Version:
                    <select 
                        value={verA} onChange={e => setVerA(e.target.value)}
                        className="ml-2 border rounded p-1 text-gray-900"
                    >
                        {prompt.versions.map(v => <option key={v.id} value={v.id}>V{v.versionNumber}</option>)}
                    </select>
                </div>
                <div>
                    Select Right Version:
                    <select 
                        value={verB} onChange={e => setVerB(e.target.value)}
                        className="ml-2 border rounded p-1 text-gray-900"
                    >
                        {prompt.versions.map(v => <option key={v.id} value={v.id}>V{v.versionNumber}</option>)}
                    </select>
                </div>
            </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-2 gap-8">
            <ResultCard versionId={verA} result={resultA} prompt={prompt} />
            <ResultCard versionId={verB} result={resultB} prompt={prompt} />
        </div>
      </div>
    </div>
  )
}

function ResultCard({ versionId, result, prompt }) {
    const version = prompt.versions.find(v => v.id == versionId)
    if (!version) return null

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
            <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                <span className="font-bold text-gray-800">Version {version.versionNumber}</span>
                <div className="text-xs text-gray-400 font-mono mt-2 truncate">{version.content}</div>
            </div>
            
            <div className="p-6 flex-1">
                {result ? (
                    <>
                        <div className="prose prose-sm max-w-none mb-6">
                            <p className="whitespace-pre-wrap text-gray-800">{result.aiResponse}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs border-t pt-4">
                            <div className="p-2 bg-blue-50 rounded text-blue-700">
                                <div className="font-bold">{result.qualityScore ? result.qualityScore.toFixed(2) : 'N/A'}</div>
                                <div>Quality</div>
                            </div>
                            <div className="p-2 bg-gray-50 rounded text-gray-600">
                                <div className="font-bold">{result.responseTimeMs}ms</div>
                                <div>Latency</div>
                            </div>
                            <div className="p-2 bg-gray-50 rounded text-gray-600">
                                <div className="font-bold">${result.costUsd}</div>
                                <div>Cost</div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                        Waiting for run...
                    </div>
                )}
            </div>
        </div>
    )
}

export default CompareVersions