import { ApiError, createApiError } from './apiContract.js'
import { createMockApi } from './mockApi.js'

const env = import.meta.env ?? {}
const API_BASE = (env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')
const MOCK_MODE = env.VITE_USE_MOCK !== 'false'
const REQUEST_TIMEOUT_MS = 15_000

let mockAdapter

export const buildApiUrl = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
export const isMockMode = () => MOCK_MODE

function getMockAdapter() {
  if (!mockAdapter) {
    mockAdapter = createMockApi({
      persistentStorage: globalThis.localStorage,
      sessionStorage: globalThis.sessionStorage,
    })
  }
  return mockAdapter
}

async function parseResponse(response) {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body

  if (MOCK_MODE) {
    return getMockAdapter().request(path, { method, body })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const abortFromCaller = () => controller.abort()
  options.signal?.addEventListener('abort', abortFromCaller, { once: true })

  try {
    const response = await fetch(buildApiUrl(path), {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const payload = await parseResponse(response)
    if (!response.ok) throw createApiError(response.status, payload, path)
    return payload
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (controller.signal.aborted) {
      throw new ApiError({ status: 0, code: 'REQUEST_TIMEOUT', message: '请求超时，请稍后重试', path })
    }
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: '无法连接后端服务', path })
  } finally {
    clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}

export const api = {
  workspace: {
    summary: () => apiRequest('/workspace/summary'),
  },
  prompts: {
    list: () => apiRequest('/prompts'),
    get: (id) => apiRequest(`/prompts/${id}`),
    create: (input) => apiRequest('/prompts', { method: 'POST', body: input }),
    update: (id, input) => apiRequest(`/prompts/${id}`, { method: 'PUT', body: input }),
    remove: (id) => apiRequest(`/prompts/${id}`, { method: 'DELETE' }),
    createVersion: (id, content) => apiRequest(`/prompts/${id}/versions`, {
      method: 'POST',
      body: { content },
    }),
  },
  suites: {
    list: () => apiRequest('/test-suites'),
    get: (id) => apiRequest(`/test-suites/${id}`),
    create: (input) => apiRequest('/test-suites', { method: 'POST', body: input }),
    update: (id, input) => apiRequest(`/test-suites/${id}`, { method: 'PUT', body: input }),
    remove: (id) => apiRequest(`/test-suites/${id}`, { method: 'DELETE' }),
  },
  tests: {
    quick: (input) => apiRequest('/quick-test', { method: 'POST', body: input }),
    run: (input) => apiRequest('/test-runs', { method: 'POST', body: input }),
    get: (id) => apiRequest(`/test-runs/${id}`),
    history: (versionId) => apiRequest(`/test-runs/version/${versionId}`),
    regressionGate: (candidateRunId, input) => apiRequest(`/test-runs/${candidateRunId}/regression-gate`, { method: "POST", body: input }),
  },
}

export { API_BASE }
