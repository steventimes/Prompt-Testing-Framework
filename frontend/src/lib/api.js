export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

export const buildApiUrl = (path) => {
  if (!path.startsWith('/')) {
    return `${API_BASE}/${path}`
  }
  return `${API_BASE}${path}`
}
