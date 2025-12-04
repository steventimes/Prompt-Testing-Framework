import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function CreatePrompt() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    initialContent: ''
  })
  const [errors, setErrors] = useState({})
  const [creating, setCreating] = useState(false)

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Prompt name is required'
    } else if (formData.name.length > 255) {
      newErrors.name = 'Name must be less than 255 characters'
    }
    
    if (formData.description.length > 1000) {
      newErrors.description = 'Description must be less than 1000 characters'
    }
    
    if (!formData.initialContent.trim()) {
      newErrors.initialContent = 'Prompt content is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (testImmediately = false) => {
    if (!validateForm()) {
      return
    }

    setCreating(true)
    try {
      const response = await fetch('http://localhost:8080/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        throw new Error('Failed to create prompt')
      }
      
      const data = await response.json()
      
      if (testImmediately) {
        // Redirect to detail page to run tests
        navigate(`/prompt/${data.id}`)
      } else {
        // Just go back to home
        navigate('/')
      }
      
    } catch (error) {
      console.error('Error creating prompt:', error)
      setErrors({ submit: 'Failed to create prompt. Please try again.' })
    }
    setCreating(false)
  }

  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value })
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: null })
    }
  }

  return (
    <div className="min-h-screen bg-transparent py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button 
          onClick={() => navigate('/')}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2 text-lg font-medium transition-colors"
        >
          ← Back to home
        </button>
        
        {/* Main Form Card */}
        <div className="bg-white rounded-lg shadow-xl border-2 border-gray-100 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create New Prompt
          </h1>
          <p className="text-gray-600 mb-8 text-base">
            Define your AI prompt and start testing different variations
          </p>

          {/* Error Banner */}
          {errors.submit && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-red-600 font-medium">{errors.submit}</p>
            </div>
          )}

          {/* Prompt Name */}
          <div className="mb-6">
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Prompt Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., Customer Support Bot, Code Reviewer, Email Writer"
              className={`w-full px-4 py-3 text-base rounded-lg transition-colors
                ${errors.name 
                  ? 'border-2 border-red-300 focus:border-red-500' 
                  : 'border-2 border-gray-300 focus:border-blue-500'
                } focus:outline-none`}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Description
              <span className="text-gray-500 font-normal ml-2">(optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe what this prompt does, when to use it, or any special considerations..."
              rows={3}
              className={`w-full px-4 py-3 text-base rounded-lg transition-colors resize-y
                ${errors.description 
                  ? 'border-2 border-red-300 focus:border-red-500' 
                  : 'border-2 border-gray-300 focus:border-blue-500'
                } focus:outline-none`}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              {formData.description.length}/1000 characters
            </p>
          </div>

          {/* Prompt Content */}
          <div className="mb-8">
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Initial Prompt Content *
            </label>
            <textarea
              value={formData.initialContent}
              onChange={(e) => updateField('initialContent', e.target.value)}
              placeholder="You are a helpful AI assistant. Your task is to...

Use {variable_name} for dynamic inputs, e.g.:
'Answer this question: {question}'
'Summarize this text: {text}'"
              rows={8}
              className={`w-full px-4 py-3 text-base rounded-lg font-mono transition-colors resize-y
                ${errors.initialContent 
                  ? 'border-2 border-red-300 focus:border-red-500' 
                  : 'border-2 border-gray-300 focus:border-blue-500'
                } focus:outline-none`}
            />
            {errors.initialContent && (
              <p className="mt-1 text-sm text-red-600">{errors.initialContent}</p>
            )}
            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>💡 Tip:</strong> Use curly braces like <code className="bg-blue-100 px-1 rounded">{'{variable}'}</code> for 
                dynamic inputs. You can test different values later without changing the prompt.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => handleSubmit(true)}
              disabled={creating}
              className={`flex-1 px-6 py-4 rounded-lg text-lg font-medium transition-all
                ${creating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
                }`}
            >
              {creating ? 'Creating...' : '🚀 Create & Test'}
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={creating}
              className={`flex-1 px-6 py-4 rounded-lg text-lg font-medium transition-all
                ${creating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 hover:scale-105'
                }`}
            >
              {creating ? 'Creating...' : '✓ Create & Save'}
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700 text-base"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Example Card */}
        <div className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            📚 Example Prompts
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => setFormData({
                name: 'Customer Support Assistant',
                description: 'Helps answer common customer questions with a friendly tone',
                initialContent: 'You are a friendly customer support agent. Answer this question professionally and helpfully: {question}'
              })}
              className="w-full text-left p-3 bg-white rounded-lg border border-purple-200 hover:border-purple-400 hover:shadow-md transition-all"
            >
              <div className="font-medium text-gray-900">Customer Support Assistant</div>
              <div className="text-sm text-gray-600">Answer customer questions with a helpful tone</div>
            </button>
            <button
              onClick={() => setFormData({
                name: 'Code Explainer',
                description: 'Explains code snippets in plain English',
                initialContent: 'You are a programming tutor. Explain this code in simple terms that a beginner can understand: {code}'
              })}
              className="w-full text-left p-3 bg-white rounded-lg border border-purple-200 hover:border-purple-400 hover:shadow-md transition-all"
            >
              <div className="font-medium text-gray-900">Code Explainer</div>
              <div className="text-sm text-gray-600">Break down code into simple explanations</div>
            </button>
            <button
              onClick={() => setFormData({
                name: 'Email Draft Writer',
                description: 'Creates professional email drafts',
                initialContent: 'Write a professional email with the following purpose: {purpose}. Keep it concise and friendly.'
              })}
              className="w-full text-left p-3 bg-white rounded-lg border border-purple-200 hover:border-purple-400 hover:shadow-md transition-all"
            >
              <div className="font-medium text-gray-900">Email Draft Writer</div>
              <div className="text-sm text-gray-600">Generate professional email drafts</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreatePrompt