export class ApiError extends Error {
  constructor({ status = 0, code = 'NETWORK_ERROR', message, path = '', fieldErrors = {} }) {
    super(message || '无法连接服务，请检查网络后重试')
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.path = path
    this.fieldErrors = fieldErrors && typeof fieldErrors === 'object' ? fieldErrors : {}
  }
}

export function createApiError(status, payload, fallbackPath = '') {
  const structured = payload && typeof payload === 'object' && !Array.isArray(payload)

  return new ApiError({
    status,
    code: structured && payload.code ? payload.code : `HTTP_${status}`,
    message: structured && payload.message ? payload.message : `请求失败（${status}）`,
    path: structured && payload.path ? payload.path : fallbackPath,
    fieldErrors: structured ? payload.fieldErrors : {},
  })
}

export function errorMessage(error, fallback = '操作未完成，请重试') {
  return error instanceof ApiError ? error.message : fallback
}
