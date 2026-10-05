export async function api(path, options = {}) {
  const { timeoutMs = 20000, ...fetchOptions } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`/api${path}`, {
      ...fetchOptions,
      credentials: 'same-origin',
      signal: fetchOptions.signal || controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-CAMY-Request': '1', ...fetchOptions.headers },
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const error = new Error(data?.message || 'CAMY could not complete this request. Please try again.')
      error.status = response.status
      if (response.status === 401 && !path.startsWith('/customer/')) window.dispatchEvent(new Event('camy-session-expired'))
      throw error
    }
    if (!data) throw new Error('The server returned an invalid response. Please try again.')
    return data
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('This request took too long. Check your connection and try again.')
    if (error instanceof TypeError) throw new Error('Cannot reach CAMY. Check your connection and make sure the server is running.')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
