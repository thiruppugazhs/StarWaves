import { clearAuthSession, getDeviceId, getDeviceName, getStoredAuthToken } from './authStorage'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1'

// Warn if prod build points to localhost (common Vercel mis-config)
if (typeof window !== 'undefined' && import.meta.env.PROD && API_URL.includes('127.0.0.1')) {
  console.warn('[StarWaves] VITE_API_URL is localhost in production — set Vercel env to https://api.starwaves.susindran.in/api/v1')
}
if (typeof window !== 'undefined' && import.meta.env.PROD && API_URL.startsWith('http://')) {
  console.warn('[StarWaves] VITE_API_URL should be https:// in production, got', API_URL)
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000
const DEFAULT_RETRIES_FOR_IDEMPOTENT = 2

function formatErrorDetail(detail, fallback) {
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const hasEmptyContent = detail.some((e) => e?.type === 'string_too_short' && Array.isArray(e.loc) && e.loc.includes('content'))
    if (hasEmptyContent) return 'A message was empty and could not be sent. Please write a message and try again.'
    const parts = detail.map((entry) => {
      if (!entry || typeof entry !== 'object') return String(entry)
      if (typeof entry.msg === 'string') {
        const loc = Array.isArray(entry.loc) ? entry.loc.slice(1).join('.') : ''
        return loc ? `${loc}: ${entry.msg}` : entry.msg
      }
      return JSON.stringify(entry)
    })
    const joined = parts.join('; ')
    return joined || fallback
  }
  if (typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg
    try {
      return JSON.stringify(detail)
    } catch {
      return fallback
    }
  }
  return String(detail) || fallback
}

// Frontend concurrency limiter — prevents dashboard thundering herd
// e2-micro Nginx: 10r/s burst 60. Dashboard fires ~15 GETs (+15 OPTIONS preflights =30).
// Limiting JS to 4 concurrent keeps Nginx ≤8 in-flight, well under burst.
const MAX_CONCURRENT_REQUESTS = 6
let activeRequests = 0
const requestQueue = []

function withConcurrencyLimit(task) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      activeRequests += 1
      try {
        const result = await task()
        resolve(result)
      } catch (error) {
        reject(error)
      } finally {
        activeRequests -= 1
        const next = requestQueue.shift()
        if (next) next()
      }
    }
    if (activeRequests < MAX_CONCURRENT_REQUESTS) run()
    else requestQueue.push(run)
  })
}

function isRetryableNetworkError(error) {
  const msg = error?.message ?? ''
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Load failed') ||
    msg.includes('too long')
  )
}

// Lightweight dedup + cache for GET on e2-micro single worker (reduces thundering herd)
// Default policy: cache GETs for 30s unless caller opts out with useCache:false or useCacheTtl:0
const pendingRequests = new Map()
const getCache = new Map() // key -> { expires, data }
const DEFAULT_GET_CACHE_TTL_MS = 30_000
const GET_CACHE_MAX_SIZE = 150

// Per-path TTL overrides (ms) — longer for slowly changing prefs, shorter for volatile lists
const CACHE_TTL_OVERRIDES = [
  { match: (p) => p.includes('/ui/preferences'), ttl: 120_000 },
  { match: (p) => p.includes('/auth/me'), ttl: 60_000 },
  { match: (p) => p.includes('/auth/sessions'), ttl: 0 }, // always live
  { match: (p) => p.includes('/usage/'), ttl: 15_000 },
  { match: (p) => p.includes('/eve/sessions') || p.includes('/eve/memories'), ttl: 15_000 },
  { match: (p) => p.includes('/settings/ai-models'), ttl: 60_000 },
]

function resolveCacheTtl(path, explicitTtl) {
  if (typeof explicitTtl === 'number') return explicitTtl
  for (const o of CACHE_TTL_OVERRIDES) if (o.match(path)) return o.ttl
  return DEFAULT_GET_CACHE_TTL_MS
}

function cacheKey(method, url) {
  return `${method}:${url}`
}

function shouldCacheGet(path, useCache, useCacheTtl, method) {
  if (method !== 'GET') return false
  if (useCache === false) return false
  if (typeof useCacheTtl === 'number' && useCacheTtl === 0) return false
  const ttl = resolveCacheTtl(path, useCacheTtl)
  return ttl > 0
}

function getTtlForPath(path, useCacheTtl) {
  return resolveCacheTtl(path, useCacheTtl)
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
    useCache = undefined,
    useCacheTtl = undefined,
    ...fetchOptions
  } = {},
) {
  const method = (fetchOptions.method || 'GET').toUpperCase()
  // Default retries: idempotent GETs retry on 429/503/network; mutations do not
  if (retries === 0 && method === 'GET') retries = DEFAULT_RETRIES_FOR_IDEMPOTENT
  const fullUrl = `${API_URL}${basePath}${path}`
  const dedupKey = cacheKey(method, fullUrl + JSON.stringify(fetchOptions.body || ''))
  const effectiveUseCache = shouldCacheGet(path, useCache, useCacheTtl, method)

  // GET cache for idempotent reads — reduces e2-micro load & spam
  if (effectiveUseCache && !fetchOptions.body) {
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
      response = await withConcurrencyLimit(() =>
        fetchWithTimeout(fullUrl, {
          mode: 'cors',
          credentials: 'omit',
          ...fetchOptions,
          headers: { ...headers, ...fetchOptions.headers },
        }, timeoutMs)
      )
    } catch (error) {
      // Retry on timeout / network / CORS-blocked (Failed to fetch) for transient e2-micro burst throttling
      // Nginx 429 without CORS manifests as TypeError: Failed to fetch — retry with jitter
      if (attempt < retries && isRetryableNetworkError(error)) {
        const jitter = 100 + Math.random() * 200
        const delay = 350 * Math.pow(1.8, attempt) + jitter
        await new Promise((r) => setTimeout(r, delay))
        return exec(attempt + 1)
      }
      if (onFetchError) throw onFetchError(error)
      // Surface a friendlier message for CORS/network failures
      if (isRetryableNetworkError(error)) {
        throw new Error('Network error — please check your connection and try again.')
      }
      throw error
    }

    if (!response.ok) {
      // Retry on 429/502/503 with backoff + jitter (respects Retry-After when Nginx/RateLimit sends it)
      if (attempt < retries && [429, 502, 503].includes(response.status)) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10)
        const baseDelay = retryAfter ? retryAfter * 1000 : 400 * Math.pow(2, attempt)
        const jitter = 100 + Math.random() * 200
        const delay = baseDelay + jitter
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
          clearAuthSession()
          window.dispatchEvent(new CustomEvent('starwaves:session-revoked'))
        } catch {}
      }
      const detailMessage = formatErrorDetail(failure?.detail, errorMessage)
      throw Object.assign(new Error(detailMessage), { status: response.status, detail: failure?.detail })
    }
    if (response.status === 204) return null
    try {
      const data = await response.json()
      if (effectiveUseCache) {
        const ttl = getTtlForPath(path, useCacheTtl)
        getCache.set(dedupKey, { data, expires: Date.now() + ttl })
        // Bound cache size (LRU-ish: drop oldest)
        if (getCache.size > GET_CACHE_MAX_SIZE) {
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

export function invalidateRequestCache(predicate) {
  for (const key of getCache.keys()) {
    if (predicate(key)) getCache.delete(key)
  }
}

export function invalidateCacheForPath(pathFragment) {
  invalidateRequestCache((key) => key.includes(pathFragment))
}
