import { useState } from 'react'
import { X, Key, Save, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

function SettingsModal({ onClose }) {
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('openai_api_key') || ''
  })
  
  const [provider, setProvider] = useState('openai')

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('openai_api_key', apiKey.trim())
      toast.success('API Key saved securely to browser storage')
    } else {
      localStorage.removeItem('openai_api_key')
      toast.success('API Key removed')
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            AI Settings
          </h3>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
            <select 
              value={provider} 
              onChange={(e) => setProvider(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="openai">OpenAI (GPT-4 / GPT-3.5)</option>
            </select>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">OpenAI API Key</label>
            <div className="relative">
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-proj-..."
                className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
              />
              <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
            </div>
            
            <div className="mt-3 flex gap-2 items-start p-3 bg-blue-50 text-blue-800 rounded-lg text-xs">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Your key is stored <strong>locally in your browser</strong>. 
                It is sent securely to your backend only when running tests.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm transition-colors font-medium"
          >
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal