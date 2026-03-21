export function createApiClient(baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
  const storageKey = 'dala_wms_api_token'

  function getStoredToken() {
    try {
      return globalThis.localStorage?.getItem(storageKey) || ''
    } catch (_error) {
      return ''
    }
  }

  function setStoredToken(token) {
    try {
      if (token) globalThis.localStorage?.setItem(storageKey, token)
      else globalThis.localStorage?.removeItem(storageKey)
    } catch (_error) {
      // No-op when storage is unavailable.
    }
  }

  async function request(path, options = {}) {
    const token = getStoredToken()
    const response = await fetch(`${normalizedBaseUrl}${path}`, {
      method: options.method || 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (response.status === 204) {
      return null
    }

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (response.status === 401) {
        setStoredToken('')
      }
      const error = new Error(payload.error || 'Request failed.')
      error.status = response.status
      error.details = payload.details
      throw error
    }

    if (payload?.token) {
      setStoredToken(payload.token)
    }

    if (path === '/auth/logout') {
      setStoredToken('')
    }

    return payload
  }

  return {
    get(path) {
      return request(path)
    },
    post(path, body) {
      return request(path, { method: 'POST', body })
    },
    patch(path, body) {
      return request(path, { method: 'PATCH', body })
    },
  }
}
