import { Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { isMockMode } from '../lib/api.js'
import RuntimeModal from './RuntimeModal.jsx'

export default function AppShell() {
  const mockMode = isMockMode()
  const [showRuntime, setShowRuntime] = useState(false)
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="topbar">
        <Link className="brand" to="/">Prompt Testing Framework</Link>
        <nav className="topnav" aria-label="主导航">
          <NavLink to="/" end>Prompts</NavLink>
          <NavLink to="/test-suites">测试套件</NavLink>
        </nav>
        <button className="button button-secondary runtime-button" onClick={() => setShowRuntime(true)} type="button">
          <Settings2 size={15} /> {mockMode ? '演示模式' : '后端模式'}
        </button>
      </header>
      {showRuntime ? <RuntimeModal onClose={() => setShowRuntime(false)} /> : null}
      {mockMode ? <div className="mode-notice">演示数据保存在当前浏览器，测试使用模拟响应，不调用真实模型。</div> : null}
      <main id="main-content" className="app-main" tabIndex={-1}><Outlet /></main>
    </div>
  )
}
