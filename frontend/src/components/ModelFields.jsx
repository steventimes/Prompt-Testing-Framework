export default function ModelFields({ provider, modelName, onProviderChange, onModelChange, disabled = false }) {
  return (
    <div className="model-row">
      <label><span>供应商</span><select aria-label="供应商" disabled={disabled} value={provider} onChange={(event) => { onProviderChange(event.target.value); onModelChange('') }}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select></label>
      <label><span>模型名称</span><input disabled={disabled} value={modelName} onChange={(event) => onModelChange(event.target.value)} placeholder="填写该供应商的模型 ID" required /></label>
    </div>
  )
}
