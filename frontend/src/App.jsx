import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import PromptDetail from './pages/PromptDetail'
import CreatePrompt from './pages/CreatePrompt'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/prompt/:id" element={<PromptDetail />} />
        <Route path="/create" element={<CreatePrompt />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App