import { getDeviceId, getDeviceName, getStoredAuthToken } from './authApi'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1'

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

// Lightweight dedup + cache for GET on e2-micro single worker (reduces thundering herd)
const pendingRequests = new Map()
const getCache = new Map() // key -> { expires, data }
const GET_CACHE_TTL_MS = 30_000

function cacheKey(method, url) {
  return `${method}:${url}`
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
    })
  } catch (error) {
    if (error.name === 'AbortError' && !options.signal?.aborted) {
      throw new Error('The server took too long to respond. Please try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function apiRequest(
  path = '',
  {
    basePath = '',
    authRequired = true,
    errorMessage = 'The request could not be completed.',
    missingTokenMessage = 'Sign in to continue.',
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    notFoundMessage = null,
    onFetchError = null,
    retries = 0,
    useCache = false,
    ...fetchOptions
  } = {},
) {
  const method = (fetchOptions.method || 'GET').toUpperCase()
  const fullUrl = `${API_URL}${basePath}${path}`
  const dedupKey = cacheKey(method, fullUrl + JSON.stringify(fetchOptions.body || ''))

  // GET cache (30s) for idempotent reads — reduces e2-micro load
  if (useCache && method === 'GET' && !fetchOptions.body) {
    const cached = getCache.get(dedupKey)
    if (cached && cached.expires > Date.now()) {
      return cached.data
    }
  }

  // Dedup concurrent identical GETs
  if (method === 'GET' && pendingRequests.has(dedupKey)) {
    return pendingRequests.get(dedupKey)
  }

  const headers = {}
  if (authRequired) {
    const token = getStoredAuthToken()
    if (!token) throw new Error(missingTokenMessage)
    headers.Authorization = `Bearer ${token}`
  }
  // Multi-device: identify device for session creation & per-device metrics
  try {
    headers['X-Device-Id'] = getDeviceId()
    headers['X-Device-Name'] = getDeviceName()
  } catch {
    // ignore storage access errors (private mode)
  }
  if (fetchOptions.body) headers['Content-Type'] = 'application/json'

  const exec = async (attempt = 0) => {
    let response
    try {
      response = await fetchWithTimeout(fullUrl, {
        ...fetchOptions,
        headers: { ...headers, ...fetchOptions.headers },
      }, timeoutMs)
    } catch (error) {
      // Retry on timeout/network for transient e2-micro burst throttling
      if (attempt < retries && error.message?.includes('too long')) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
        return exec(attempt + 1)
      }
      if (onFetchError) throw onFetchError(error)
      throw error
    }

    if (!response.ok) {
      // Retry on 429/502/503 with backoff
      if (attempt < retries && [429, 502, 503].includes(response.status)) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10)
        const delay = retryAfter ? retryAfter * 1000 : 400 * Math.pow(2, attempt)
        await new Promise((r) => setTimeout(r, delay))
        return exec(attempt + 1)
      }
      if (notFoundMessage && response.status === 404) {
        throw new Error(notFoundMessage)
      }
      let failure = null
      try {
        failure = await response.json()
      } catch {
        // response was not valid JSON (e.g. HTML error page)
      }
      // Multi-device: revoked/expired token → force sign out so other device sees 401
      if (response.status === 401 && authRequired) {
        try {
          const { clearAuthSession } = await import('./authApi')
          clearAuthSession()
          window.dispatchEvent(new CustomEvent('starwaves:session-revoked'))
        } catch {}
      }
      throw Object.assign(new Error(failure?.detail || errorMessage), { status: response.status })
    }
    if (response.status === 204) return null
    try {
      const data = await response.json()
      if (useCache && method === 'GET') {
        getCache.set(dedupKey, { data, expires: Date.now() + GET_CACHE_TTL_MS })
        // Bound cache size
        if (getCache.size > 100) {
          const firstKey = getCache.keys().next().value
          getCache.delete(firstKey)
        }
      }
      return data
    } catch {
      throw new Error('Received an invalid response from the server.')
    }
  }

  const promise = exec()
  if (method === 'GET') {
    pendingRequests.set(dedupKey, promise)
    promise.finally(() => pendingRequests.delete(dedupKey))
  }
  return promise
}

export function clearRequestCache() {
  getCache.clear()
  pendingRequests.clear()
}
