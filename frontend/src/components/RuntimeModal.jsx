import { Server, ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { API_BASE, isMockMode } from '../lib/api.js'

export default function RuntimeModal({ onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); trigger?.focus() }
  }, [])

  const keepFocus = (event) => {
    if (event.key !== 'Tab') return
    const buttons = [...dialogRef.current.querySelectorAll('button')]
    const next = event.shiftKey ? buttons.at(-1) : buttons[0]
    const boundary = event.shiftKey ? buttons[0] : buttons.at(-1)
    if (document.activeElement === boundary) {
      event.preventDefault()
      next.focus()
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="runtime-title" className="modal-card" onKeyDown={keepFocus} onCancel={onClose}>
        <header>
          <div>
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
        <button className="button button-primary" onClick={onClose} type="button">关闭</button>
    </dialog>
  )
}
