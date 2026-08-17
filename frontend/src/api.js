const API_BASE = (
  import.meta.env.VITE_API_URL || ''
).replace(/\/$/, '')

export function getToken() {
  try {
    return localStorage.getItem('lifeos_token') || ''
  } catch {
    return ''
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem('lifeos_token', token)
    } else {
      localStorage.removeItem('lifeos_token')
    }
  } catch {
    // Local storage may be unavailable in private browsing.
  }
}

function getErrorMessage(data, status) {
  if (!data) {
    return `Request failed (${status})`
  }

  if (typeof data === 'string') {
    // Prevent an entire Nginx HTML error page from appearing in the UI.
    if (data.trim().startsWith('<')) {
      return `The server returned an invalid response (${status}).`
    }

    return data
  }

  const detail = data.detail || data.message || data.error

  if (Array.isArray(detail)) {
    return detail
      .map(item => item?.msg || item?.message || String(item))
      .join(', ')
  }

  if (typeof detail === 'string') {
    return detail
  }

  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail)
  }

  return `Request failed (${status})`
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = getToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }

  headers.set('Accept', 'application/json')

  let response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    })
  } catch {
    throw new Error(
      'Cannot reach the LifeOS backend. The backend may be waking up—wait 30 seconds and try again.'
    )
  }

  if (response.status === 204) {
    return null
  }

  const contentType =
    response.headers.get('content-type') || ''

  const isJson = contentType.includes('application/json')

  let data

  try {
    data = isJson
      ? await response.json()
      : await response.text()
  } catch {
    throw new Error(
      'The server returned a response that LifeOS could not read.'
    )
  }

  if (!response.ok) {
    if (response.status === 401) {
      setToken('')
      throw new Error(
        'Your session has expired. Refresh the page and sign in again.'
      )
    }

    throw new Error(
      getErrorMessage(data, response.status)
    )
  }

  /*
   * All LifeOS API endpoints return JSON.
   * If HTML is returned with status 200, Nginx sent index.html
   * instead of forwarding the request to FastAPI.
   */
  if (!isJson) {
    throw new Error(
      'The frontend could not reach the LifeOS API. Check the Nginx /api proxy configuration.'
    )
  }

  return data
}

export function emitAction(action) {
  if (!action || typeof action !== 'object') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('lifeos:action', {
      detail: action,
    })
  )
}
