import { FileStack, FlaskConical, Plus, RadioTower } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { isMockMode } from '../lib/api.js'

export default function AppShell() {
  const mockMode = isMockMode()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Prompt Signal Lab 首页">
          <span className="brand-signal" aria-hidden="true"><i /><i /><i /></span>
          <span>
            <strong>Prompt Signal Lab</strong>
            <small>评测与发布证据工作台</small>
          </span>
        </Link>

        <nav className="topnav" aria-label="主导航">
          <NavLink to="/" end><FlaskConical size={16} /> 工作区</NavLink>
          <NavLink to="/test-suites"><FileStack size={16} /> 测试套件</NavLink>
          <span className={`runtime-chip ${mockMode ? 'is-mock' : 'is-live'}`}>
            <RadioTower size={14} /> {mockMode ? '确定性 Mock' : '实时后端'}
          </span>
          <Link className="button button-primary button-compact" to="/create">
            <Plus size={16} /> 新建 Prompt
          </Link>
        </nav>
      </header>
      <main id="main-content" className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>Prompt Signal Lab</span>
        <span>模板 · 套件 · 断言 · 运行证据</span>
      </footer>
    </div>
  )
}
