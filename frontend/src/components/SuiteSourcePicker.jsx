import { InlineError } from './Ui.jsx'
import { errorMessage } from '../lib/apiContract.js'
import { FileStack } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function SuiteSourcePicker({ suites, value, onChange, loading, error }) {
  return (
    <>
    {error ? <InlineError title="测试套件加载失败" message={errorMessage(error)} /> : null}
    <div className="suite-source-picker">
      <label>
        <span><FileStack size={13} /> 用例来源</span>
        <select aria-label="用例来源" disabled={loading || Boolean(error)} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{loading ? '正在加载套件…' : '临时用例'}</option>
          {suites.map((suite) => (
            <option key={suite.id} value={suite.id}>{suite.name} · {suite.cases.length} 个用例</option>
          ))}
        </select>
      </label>
      <Link to="/test-suites">管理套件</Link>
    </div>
    </>
  )
}
