import { FileStack } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function SuiteSourcePicker({ suites, value, onChange }) {
  return (
    <div className="suite-source-picker">
      <label>
        <span><FileStack size={13} /> 用例来源</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">当前临时矩阵</option>
          {suites.map((suite) => (
            <option key={suite.id} value={suite.id}>{suite.name} · {suite.cases.length} cases</option>
          ))}
        </select>
      </label>
      <Link to="/test-suites">管理套件</Link>
    </div>
  )
}
