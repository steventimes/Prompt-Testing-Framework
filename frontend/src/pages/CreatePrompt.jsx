import { useNavigate } from 'react-router-dom'

function CreatePrompt() {
    const navigate = useNavigate()

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => navigate('/')}
                    className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2"
                >
                    ← Back
                </button>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        Create New Prompt
                    </h1>
                    <p className="text-gray-500">Form coming soon...</p>
                </div>
            </div>
        </div>
    )
}

export default CreatePrompt