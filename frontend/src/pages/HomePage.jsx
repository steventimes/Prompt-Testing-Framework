import { Plus, Search, TestTubeDiagonal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { errorMessage } from '../lib/apiContract.js'
import { formatDateTime } from '../lib/format.js'
import QuickTestPanel from '../components/QuickTestPanel.jsx'
import { EmptyState, InlineError, PageLoader } from '../components/Ui.jsx'

export default function HomePage() {
  const navigate = useNavigate()
  const [requestKey, setRequestKey] = useState(0)
  const [page, setPage] = useState({ status: 'loading', rows: [], error: null })
  const [query, setQuery] = useState('')
  const [showQuickTest, setShowQuickTest] = useState(false)

  useEffect(() => {
    let active = true
    api.prompts.list()
      .then((rows) => {
        if (active) setPage({ status: 'ready', rows, error: null })
      })
      .catch((error) => {
        if (active) setPage({ status: 'error', rows: [], error })
      })
    return () => { active = false }
  }, [requestKey])

  const rows = page.rows.filter((row) => `${row.name} ${row.description || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <div className="page-wrap home-page">
      <header className="workspace-header">
        <div><h1>Prompts</h1><p>管理模板和版本，运行测试用例。</p></div>
        <div className="heading-actions">
          <button className="button button-secondary" aria-expanded={showQuickTest} aria-controls="quick-test-panel" onClick={() => setShowQuickTest((value) => !value)} type="button">
            <TestTubeDiagonal size={16} /> {showQuickTest ? '收起快速测试' : '快速测试'}
          </button>
          <Link className="button button-primary" to="/create"><Plus size={16} /> 新建 Prompt</Link>
        </div>
      </header>
      <div hidden={!showQuickTest}><QuickTestPanel /></div>
      {page.status === 'loading' ? <PageLoader label="正在加载 Prompts" /> : page.status === 'error' ? (
        <InlineError message={errorMessage(page.error)} onRetry={() => { setPage((current) => ({ ...current, status: 'loading' })); setRequestKey((value) => value + 1) }} />
      ) : (
        <section className="panel prompt-library" aria-label="Prompt 列表">
          <div className="list-toolbar">
            <label className="search-field"><Search size={16} aria-hidden="true" /><input aria-label="搜索 Prompt" placeholder="搜索名称或说明" value={query} onChange={(event) => setQuery(event.target.value)} type="search" /></label>
            <span>{rows.length} 个 Prompt</span>
          </div>
          {page.rows.length === 0 ? (
            <EmptyState title="还没有 Prompt" detail="创建模板后即可保存版本、运行测试。" actionLabel="新建 Prompt" onAction={() => navigate('/create')} />
          ) : rows.length === 0 ? (
            <EmptyState title="没有匹配的 Prompt" detail="试试其他名称或清空搜索。" actionLabel="清空搜索" onAction={() => setQuery('')} />
          ) : (
            <div className="table-scroll"><table className="prompt-table">
              <thead><tr><th scope="col">名称与说明</th><th scope="col">版本</th><th scope="col">最近更新</th><th scope="col"><span className="sr-only">操作</span></th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.id}>
                  <td><Link className="prompt-name" to={`/prompt/${row.id}`}>{row.name}</Link><p>{row.description || '暂无说明'}</p></td>
                  <td>{row.versions?.length ?? row.versionCount ?? 0}</td>
                  <td><time>{formatDateTime(row.updatedAt || row.createdAt)}</time></td>
                  <td><Link className="text-action" to={`/prompt/${row.id}`} aria-label={`打开 ${row.name}`}>打开</Link></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      )}
    </div>
  )
}
