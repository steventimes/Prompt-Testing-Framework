export const average = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) return 0
  return values.reduce((acc, value) => acc + Number(value || 0), 0) / values.length
}

export const clamp = (value, min, max) => {
  const normalized = Number(value)
  if (Number.isNaN(normalized)) return min
  return Math.min(Math.max(normalized, min), max)
}

export const ensureLeadingSlash = (path) => (path.startsWith('/') ? path : `/${path}`)
