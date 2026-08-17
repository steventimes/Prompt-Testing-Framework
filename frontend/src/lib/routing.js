export function getRouterBasename(baseUrl) {
  if (baseUrl === '/' || baseUrl === './') {
    return undefined
  }

  return baseUrl.replace(/\/$/, '')
}
