import { Plus, Trash2 } from 'lucide-react'
import {
  ASSERTION_TYPES,
  createEvaluationCase,
  normalizeEvaluationCases,
} from '../lib/assertions.js'

export default function TestCaseEditor({ variables, cases, onChange, maxCases = 12 }) {
  const normalizedCases = normalizeEvaluationCases(cases, variables)

  const updateCase = (index, updater) => {
    onChange(normalizedCases.map((item, itemIndex) => itemIndex === index ? updater(item) : item))
  }

  const updateVariable = (index, variable, value) => {
    updateCase(index, (item) => ({
      ...item,
      variables: { ...item.variables, [variable]: value },
    }))
  }

  const updateAssertion = (caseIndex, assertionIndex, field, value) => {
    updateCase(caseIndex, (item) => ({
      ...item,
      assertions: item.assertions.map((rule, index) => index === assertionIndex
        ? { ...rule, [field]: field === 'threshold' ? Number(value) : value }
        : rule),
    }))
  }

  const addAssertion = (index) => {
    updateCase(index, (item) => ({
      ...item,
      assertions: [...item.assertions, { type: 'CONTAINS', value: '' }],
    }))
  }

  const removeAssertion = (caseIndex, assertionIndex) => {
    updateCase(caseIndex, (item) => ({
      ...item,
      assertions: item.assertions.filter((_, index) => index !== assertionIndex),
    }))
  }

  const addCase = () => {
    onChange([...normalizedCases, createEvaluationCase(variables, normalizedCases.length)])
  }

  const removeCase = (index) => {
    if (normalizedCases.length === 1) return
    onChange(normalizedCases.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div className="case-editor">
      <div className="variable-strip">
        <span>识别到的变量</span>
        {variables.length > 0
          ? variables.map((variable) => <code key={variable}>{`{{${variable}}}`}</code>)
          : <em>固定 Prompt，无需输入变量</em>}
      </div>

      <div className="case-list">
        {normalizedCases.map((testCase, index) => (
          <article className="test-case" key={`case-${index}`}>
            <header>
              <label className="case-name">
                <span>CASE {String(index + 1).padStart(2, '0')}</span>
                <input
                  aria-label={`用例 ${index + 1} 名称`}
                  value={testCase.name}
                  onChange={(event) => updateCase(index, (item) => ({ ...item, name: event.target.value }))}
                />
              </label>
              <button
                aria-label={`删除用例 ${index + 1}`}
                className="icon-button"
                disabled={normalizedCases.length === 1}
                onClick={() => removeCase(index)}
                type="button"
              >
                <Trash2 size={15} />
              </button>
            </header>

            {variables.length > 0 ? (
              <div className="case-fields">
                {variables.map((variable) => (
                  <label key={variable}>
                    <span>{variable}</span>
                    <input
                      value={testCase.variables[variable] ?? ''}
                      onChange={(event) => updateVariable(index, variable, event.target.value)}
                      placeholder={`填写 ${variable}`}
                    />
                  </label>
                ))}
              </div>
            ) : <p className="muted-copy">该用例会直接运行模板内容。</p>}

            <section className="assertion-editor">
              <header>
                <div><span>断言信号</span><small>{testCase.assertions.length || '未设置自动判定'}</small></div>
                <button className="text-action assertion-add" onClick={() => addAssertion(index)} type="button">
                  <Plus size={13} /> 添加断言
                </button>
              </header>
              {testCase.assertions.map((rule, assertionIndex) => {
                const metadata = ASSERTION_TYPES.find((item) => item.value === rule.type) || ASSERTION_TYPES[0]
                return (
                  <div className="assertion-rule" key={`${index}-assertion-${assertionIndex}`}>
                    <i aria-hidden="true" />
                    <select
                      aria-label={`用例 ${index + 1} 断言 ${assertionIndex + 1} 类型`}
                      value={rule.type}
                      onChange={(event) => {
                        const nextType = event.target.value
                        const nextMetadata = ASSERTION_TYPES.find((item) => item.value === nextType)
                        updateCase(index, (item) => ({
                          ...item,
                          assertions: item.assertions.map((current, currentIndex) => currentIndex === assertionIndex
                            ? nextMetadata.valueKind === 'number'
                              ? { type: nextType, threshold: 0 }
                              : nextMetadata.valueKind === 'text'
                                ? { type: nextType, value: '' }
                                : { type: nextType }
                            : current),
                        }))
                      }}
                    >
                      {ASSERTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                    {metadata.valueKind === 'text' ? (
                      <input
                        aria-label={`用例 ${index + 1} 断言值`}
                        value={rule.value ?? ''}
                        onChange={(event) => updateAssertion(index, assertionIndex, 'value', event.target.value)}
                        placeholder={metadata.placeholder}
                      />
                    ) : null}
                    {metadata.valueKind === 'number' ? (
                      <input
                        aria-label={`用例 ${index + 1} 断言阈值`}
                        min="0"
                        step="any"
                        type="number"
                        value={rule.threshold ?? 0}
                        onChange={(event) => updateAssertion(index, assertionIndex, 'threshold', event.target.value)}
                        placeholder={metadata.placeholder}
                      />
                    ) : null}
                    {metadata.valueKind === 'none' ? <span className="assertion-static">解析整个响应</span> : null}
                    <button
                      aria-label={`删除用例 ${index + 1} 的断言 ${assertionIndex + 1}`}
                      className="icon-button"
                      onClick={() => removeAssertion(index, assertionIndex)}
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </section>
          </article>
        ))}
      </div>

      <button
        className="button button-ghost button-compact"
        disabled={normalizedCases.length >= maxCases}
        onClick={addCase}
        type="button"
      >
        <Plus size={15} /> 添加用例
      </button>
    </div>
  )
}
