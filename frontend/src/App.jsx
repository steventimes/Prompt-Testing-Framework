import { useState, useEffect } from 'react'

function App() {
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(true)

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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Prompt Testing Framework
          </h1>
          <p className="text-gray-600">
            Test and compare AI prompt performance
          </p>
        </div>

        {/* Prompts List */}
        <div className="space-y-4">
          {prompts.map(prompt => (
            <div 
              key={prompt.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-xl hover:scale-105 hover:border-blue-300 transition-all duration-200 cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {prompt.name}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {prompt.description}
                  </p>
                  <div className="text-sm text-gray-500">
                    Created: {new Date(prompt.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App