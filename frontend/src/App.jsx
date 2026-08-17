import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AppShell from './components/AppShell.jsx'
import { PageLoader } from './components/Ui.jsx'

const Home = lazy(() => import('./pages/HomePage.jsx'))
const CreatePrompt = lazy(() => import('./pages/CreatePromptPage.jsx'))
const PromptDetail = lazy(() => import('./pages/PromptWorkbenchPage.jsx'))
const CompareVersions = lazy(() => import('./pages/ComparePage.jsx'))
const TestSuites = lazy(() => import('./pages/TestSuitesPage.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{ duration: 3600, className: 'app-toast' }}
      />
      <Suspense fallback={<PageLoader label="正在装配实验台" />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="create" element={<CreatePrompt />} />
            <Route path="test-suites" element={<TestSuites />} />
            <Route path="prompt/:id" element={<PromptDetail />} />
            <Route path="prompt/:id/compare" element={<CompareVersions />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
