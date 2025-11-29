import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function Home() {
    const [prompts, setPrompts] = useState([])
    const [loading, setLoading] = useState(true)
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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-xl text-gray-600">Loading prompts...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-transparent py-8 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            Prompt Testing Framework
                        </h1>
                        <p className="text-gray-600">
                            Test and compare AI prompt performance
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/create')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        + New Prompt
                    </button>
                </div>

                <div className="space-y-4">
                    {prompts.map(prompt => (
                        <div
                            key={prompt.id}
                            onClick={() => navigate(`/prompt/${prompt.id}`)}
                            className="bg-white rounded-lg shadow-md border-2 border-gray-100 p-6 
                            hover:shadow-xl hover:scale-105 hover:border-blue-500 hover:bg-blue-50 
                            transition-all duration-200 cursor-pointer"
                        >
                            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                                {prompt.name}
                            </h3>
                            <p className="text-gray-700 mb-4 text-base">
                                {prompt.description || 'No description provided'}
                            </p>
                            <div className="text-base text-gray-500">
                                Created: {new Date(prompt.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Home