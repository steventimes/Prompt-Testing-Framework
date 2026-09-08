import { ArrowLeft, LoaderCircle } from 'lucide-react'
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
  initialContent: '',
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
    if (saving) return
    if (!form.name.trim() || !form.initialContent.trim()) {
      setFieldErrors({ name: form.name.trim() ? undefined : '请填写名称', initialContent: form.initialContent.trim() ? undefined : '请填写模板内容' })
      return
    }
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
        <h1>新建 Prompt</h1>
        <p>填写用途和模板，保存后自动创建 V1。</p>
      </header>

      <form className="create-layout" onSubmit={submit}>
        <fieldset className="panel form-panel" disabled={saving}>
          <label className="field-group">
            <span>Prompt 名称 <b>*</b></span>
            <input required aria-invalid={Boolean(fieldErrors.name)} autoFocus maxLength="255" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="例如：退款申请分诊助手" />
            <FieldError>{fieldErrors.name}</FieldError>
          </label>
          <label className="field-group">
            <span>使用说明</span>
            <textarea maxLength="1000" rows="4" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="说明使用场景、输出消费者和边界条件" />
            <small>{form.description.length}/1000</small>
            <FieldError>{fieldErrors.description}</FieldError>
          </label>

          <label className="field-group code-field">
            <span>Prompt 内容 <b>*</b></span>
            <textarea required aria-invalid={Boolean(fieldErrors.initialContent)} placeholder="例如：请用简洁的语言回答 {{question}}。" rows="10" value={form.initialContent} onChange={(event) => update('initialContent', event.target.value)} spellCheck="false" />
            <FieldError>{fieldErrors.initialContent}</FieldError>
            <span className="variable-strip">变量：{variables.length ? variables.map((variable) => <code key={variable}>{`{{${variable}}}`}</code>) : '无'}。使用双花括号或单花括号声明变量。</span>
          </label>

          <div className="form-actions">
            <Link className="button button-ghost" to="/">取消</Link>
            <button className="button button-primary" disabled={saving} type="submit">
              {saving ? <LoaderCircle className="spin" size={17} /> : null}
              {saving ? '正在创建' : '创建 Prompt'}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  )
}
