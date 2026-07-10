import { X, Key, ShieldAlert } from 'lucide-react'

function SettingsModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
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

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
            <div className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
              Server-managed OpenAI-compatible model
            </div>
          </div>

          <div className="flex gap-2 items-start p-3 bg-blue-50 text-blue-800 rounded-lg text-xs">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              API keys are no longer stored in the browser. Configure model credentials on the backend with environment variables.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
