import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Home from './pages/Home'
import PromptDetail from './pages/PromptDetail'
import CreatePrompt from './pages/CreatePrompt'
import CompareVersions from './pages/CompareVersions'

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/prompt/:id" element={<PromptDetail />} />
        <Route path="/prompt/:id/compare" element={<CompareVersions />} /> {/* New Route */}
        <Route path="/create" element={<CreatePrompt />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App