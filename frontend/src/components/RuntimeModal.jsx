import { Server, ShieldCheck, X } from 'lucide-react'
import { useEffect } from 'react'
import { API_BASE, isMockMode } from '../lib/api.js'

export default function RuntimeModal({ onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="runtime-title" aria-modal="true" className="modal-card" role="dialog">
        <header>
          <div>
            <span className="eyebrow">Runtime</span>
            <h2 id="runtime-title">运行环境</h2>
          </div>
          <button aria-label="关闭" className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="runtime-row">
          <Server size={19} />
          <div><span>数据来源</span><strong>{isMockMode() ? '浏览器内确定性 Mock' : 'Spring Boot 实时 API'}</strong></div>
        </div>
        <div className="runtime-row">
          <ShieldCheck size={19} />
          <div><span>API 地址</span><code>{API_BASE}</code></div>
        </div>
        <p className="modal-note">
          模型凭据只在后端环境变量中配置，前端不会读取或保存 API Key。Mock 模式的 Prompt 保存在浏览器本地，运行历史仅保留在当前会话。
        </p>
        <button className="button button-primary" onClick={onClose} type="button">了解</button>
      </section>
    </div>
  )
}
