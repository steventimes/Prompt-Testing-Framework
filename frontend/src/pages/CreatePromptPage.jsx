import { ArrowLeft, ArrowRight, Braces, CheckCircle2, LoaderCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { ApiError, errorMessage } from '../lib/apiContract.js'
import { extractVariables } from '../lib/promptTemplate.js'
import { FieldError } from '../components/Ui.jsx'

const initialForm = {
  name: '',
  description: '',
  initialContent: '你是 {{role}}。请根据以下输入完成任务：\n\n{{input}}\n\n输出要求：',
}

export default function CreatePromptPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const variables = useMemo(() => extractVariables(form.initialContent), [form.initialContent])

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setFieldErrors({})
    try {
      const created = await api.prompts.create(form)
      toast.success('Prompt 与 V1 已创建')
      navigate(`/prompt/${created.id}`)
    } catch (error) {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors)
      toast.error(errorMessage(error, '创建未完成'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-wrap create-page">
      <Link className="back-link" to="/"><ArrowLeft size={16} /> 返回工作区</Link>

      <header className="page-intro compact-intro">
        <span className="eyebrow">New experiment asset</span>
        <h1>定义一个可评测的 Prompt</h1>
        <p>名称负责识别，说明负责交接，模板负责运行。保存后自动生成第一版。</p>
      </header>

      <form className="create-layout" onSubmit={submit}>
        <section className="panel form-panel">
          <div className="form-step">
            <span>01</span>
            <div><h2>用途与上下文</h2><p>让评审者知道它解决什么问题。</p></div>
          </div>
          <label className="field-group">
            <span>Prompt 名称 <b>*</b></span>
            <input autoFocus maxLength="255" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="例如：退款申请分诊助手" />
            <FieldError>{fieldErrors.name}</FieldError>
          </label>
          <label className="field-group">
            <span>使用说明</span>
            <textarea maxLength="1000" rows="4" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="说明使用场景、输出消费者和边界条件" />
            <small>{form.description.length}/1000</small>
            <FieldError>{fieldErrors.description}</FieldError>
          </label>

          <div className="form-step second-step">
            <span>02</span>
            <div><h2>初始模板</h2><p>使用双花括号或单花括号声明变量。</p></div>
          </div>
          <label className="field-group code-field">
            <span>Prompt 内容 <b>*</b></span>
            <textarea rows="15" value={form.initialContent} onChange={(event) => update('initialContent', event.target.value)} spellCheck="false" />
            <FieldError>{fieldErrors.initialContent}</FieldError>
          </label>

          <div className="form-actions">
            <Link className="button button-ghost" to="/">取消</Link>
            <button className="button button-primary" disabled={saving} type="submit">
              {saving ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}
              {saving ? '正在创建' : '创建 Prompt 与 V1'}
            </button>
          </div>
        </section>

        <aside className="creation-guide">
          <section className="panel variable-preview">
            <header><Braces size={18} /><div><span className="eyebrow">Variable contract</span><h2>变量预览</h2></div></header>
            {variables.length > 0 ? (
              <div>{variables.map((variable) => <code key={variable}>{`{{${variable}}}`}</code>)}</div>
            ) : <p>当前是固定 Prompt。仍可运行，但无法用同一模板覆盖不同输入。</p>}
          </section>
          <section className="panel checklist-panel">
            <h3>创建前检查</h3>
            <p><CheckCircle2 size={15} /> 名称描述业务用途，不使用内部编号。</p>
            <p><CheckCircle2 size={15} /> 说明写清输出将由谁使用。</p>
            <p><CheckCircle2 size={15} /> 每个变量都能从测试用例提供。</p>
            <p><CheckCircle2 size={15} /> 输出格式与限制写在模板里。</p>
          </section>
        </aside>
      </form>
    </div>
  )
}
