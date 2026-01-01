import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Settings, MessageSquare, Terminal } from 'lucide-react'
import QuickTest from '../components/QuickTest'
import SettingsModal from '../components/SettingsModal'

function Home() {
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showQuickTest, setShowQuickTest] = useState(false)
  const [showSettings, setShowSettings] = useState(false) // New State
  const navigate = useNavigate()

  useEffect(() => {
    fetch('http://localhost:8080/api/prompts')
      .then(response => response.json())
      .then(data => {
        setPrompts(data)
        setLoading(false)
      })
      .catch(error => {
        console.error('Error:', error)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl text-gray-600 font-medium">Loading workspace...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent py-8 px-4">
      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">
              Prompt Testing <span className="text-blue-600">Framework</span>
            </h1>
            <p className="text-gray-500 text-lg">Manage, version, and evaluate your AI prompts</p>
          </div>
          <div className="flex gap-3">
            {/* Settings Button */}
            <button 
               onClick={() => setShowSettings(true)}
               className="p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all text-gray-600 hover:text-blue-600"
               title="API Settings"
             >
               <Settings className="w-6 h-6" />
             </button>

            <button 
              onClick={() => setShowQuickTest(!showQuickTest)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all font-medium
                ${showQuickTest 
                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-inner' 
                  : 'bg-white border-gray-200 text-gray-700 hover:shadow-md'}`}
            >
              <Terminal className="w-5 h-5" />
              {showQuickTest ? 'Close Playground' : 'Quick Playground'}
            </button>
            <button 
              onClick={() => navigate('/create')}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg hover:shadow-blue-200 transition-all font-medium"
            >
              <Plus className="w-5 h-5" />
              New Prompt
            </button>
          </div>
        </div>

        {/* Quick Test Expandable Area */}
        <div className={`transition-all duration-500 ease-in-out overflow-hidden mb-8
          ${showQuickTest ? 'max-h-[800px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-4'}`}
        >
          <div className="bg-white rounded-2xl shadow-xl border border-blue-100 p-1">
            <QuickTest onClose={() => setShowQuickTest(false)} />
          </div>
        </div>

        {/* Prompts List */}
        <div className={`transition-all duration-500
          ${showQuickTest ? 'opacity-50 blur-[1px]' : 'opacity-100'}`}
        >
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            Your Prompt Library <span className="text-gray-400 font-normal">({prompts.length})</span>
          </h2>
          
          <div className="grid gap-5">
            {prompts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                <p className="text-gray-500 text-lg mb-4">No prompts created yet.</p>
                <button onClick={() => navigate('/create')} className="text-blue-600 font-medium hover:underline">
                  Create your first prompt
                </button>
              </div>
            ) : (
              prompts.map(prompt => (
                <div 
                  key={prompt.id}
                  onClick={() => navigate(`/prompt/${prompt.id}`)}
                  className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 
                             hover:shadow-md hover:border-blue-300 
                             transition-all duration-200 cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-semibold">
                      Open
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {prompt.name}
                  </h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {prompt.description || 'No description provided'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>Created: {new Date(prompt.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{prompt.versions ? prompt.versions.length : 0} Versions</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home