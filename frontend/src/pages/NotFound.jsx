import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page-wrap not-found-page">
      <span className="eyebrow">404 / signal lost</span>
      <h1>这条运行轨迹不存在。</h1>
      <p>地址可能已变更，或对应 Prompt 已被删除。</p>
      <Link className="button button-primary" to="/"><ArrowLeft size={16} /> 返回工作区</Link>
    </div>
  )
}
