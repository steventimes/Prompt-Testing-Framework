import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Home from './pages/Home'
import PromptDetail from './pages/PromptDetail'
import CreatePrompt from './pages/CreatePrompt'

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/prompt/:id" element={<PromptDetail />} />
        <Route path="/create" element={<CreatePrompt />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App