const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export function getToken() {
  return localStorage.getItem('lifeos_token') || ''
}

export function setToken(token) {
  if (token) localStorage.setItem('lifeos_token', token)
  else localStorage.removeItem('lifeos_token')
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error('Cannot reach the LifeOS backend. Check that it is running and try again.')
  }
  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) {
    const detail = typeof data === 'object' ? data.detail : data
    throw new Error(Array.isArray(detail) ? detail.map(x => x.msg).join(', ') : detail || `Request failed (${response.status})`)
  }
  return data
}

export const emitAction = action => window.dispatchEvent(new CustomEvent('lifeos:action', { detail: action }))

