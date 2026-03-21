export function createApiClient(baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')

  async function request(path, options = {}) {
    const response = await fetch(`${normalizedBaseUrl}${path}`, {
      method: options.method || 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (response.status === 204) {
      return null
    }

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      const error = new Error(payload.error || 'Request failed.')
      error.status = response.status
      error.details = payload.details
      throw error
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
