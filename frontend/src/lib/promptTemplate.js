const VARIABLE_PATTERN = /{{\s*([A-Za-z_][\w.-]*)\s*}}|{\s*([A-Za-z_][\w.-]*)\s*}/g

export function extractVariables(template = '') {
  const variables = []
  const seen = new Set()

  for (const match of String(template).matchAll(VARIABLE_PATTERN)) {
    const name = match[1] ?? match[2]
    if (!seen.has(name)) {
      seen.add(name)
      variables.push(name)
    }
  }

  return variables
}

export function analyzeTemplate(template, values = {}) {
  const variables = extractVariables(template)
  const missingVariables = variables.filter((name) => {
    const value = values?.[name]
    return value === undefined || value === null || String(value).trim() === ''
  })

  return { variables, missingVariables }
}

export function renderTemplate(template = '', values = {}) {
  return String(template).replace(VARIABLE_PATTERN, (placeholder, doubleName, singleName) => {
    const name = doubleName ?? singleName
    const value = values?.[name]
    return value === undefined || value === null ? placeholder : String(value)
  })
}
