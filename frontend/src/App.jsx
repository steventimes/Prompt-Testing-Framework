import { useState, useEffect } from 'react'

function App() {
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch prompts from backend
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
  }, [])  // Empty array means "run once when component loads"

  if (loading) {
    return <div>Loading prompts...</div>
  }

  return (
    <div>
      <h1>Prompt Testing Framework</h1>
      <p>Total Prompts: {prompts.length}</p>
      
      {/* This is where we'll map through prompts */}
      <div>
        {prompts.map(prompt => (
          <div key={prompt.id}>
            <h3>{prompt.name}</h3>
            <p>{prompt.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App