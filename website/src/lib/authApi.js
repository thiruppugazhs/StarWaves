import { apiRequest } from './request'
import { clearAuthSession, getStoredAuthToken, getStoredUser, setStoredAuthToken } from './authStorage'

// Pure storage/device helpers live in ./authStorage so request.js can use
// them without importing this module (avoids a request <-> authApi cycle).
// Re-exported here so existing `from './authApi'` call sites keep working.
export {
  clearAuthSession,
  getDeviceId,
  getDeviceName,
  getStoredAuthToken,
  getStoredUser,
  setDeviceName,
  setStoredAuthToken,
} from './authStorage'

export function consumeAuthTokenFromHash() {
  const hash = window.location.hash || ''
  const search = window.location.search || ''
  let token = null

  if (hash.startsWith('#token=')) {
    token = decodeURIComponent(hash.slice('#token='.length)).trim()
  } else if (hash.includes('token=')) {
    const parts = hash.split('token=')
    token = decodeURIComponent(parts[1]?.split('&')[0] || '').trim()
  } else if (search.includes('token=')) {
    const params = new URLSearchParams(search)
    token = params.get('token')?.trim()
  }

  if (!token) return false

  setStoredAuthToken(token, undefined)
  window.history.replaceState({}, '', window.location.pathname)
  return true
}

export function consumeAuthTokenFromUrl(url) {
  if (!url) return false
  try {
    const u = new URL(url)
    let token = u.searchParams.get('token')
    if (!token && u.hash) {
      const hp = new URLSearchParams(u.hash.slice(1))
      token = hp.get('token')
      if (!token && u.hash.includes('token=')) {
        const parts = u.hash.split('token=')
        token = decodeURIComponent(parts[1]?.split('&')[0] || '').trim()
      }
    }
    if (token) {
      const decoded = decodeURIComponent(token).trim()
      if (decoded) {
        setStoredAuthToken(decoded, undefined)
        // Close Capacitor Browser if open
        try {
          import('@capacitor/browser').then(({ Browser }) => Browser.close().catch(() => {})).catch(() => {})
        } catch {}
        return true
      }
    }
  } catch {}
  return false
}

let _nativeOAuthSetup = false
export function setupNativeOAuthListeners() {
  if (_nativeOAuthSetup || typeof window === 'undefined') return
  _nativeOAuthSetup = true
  // Capacitor Android deep-link
  try {
    const cap = window.Capacitor
    if (cap?.isNativePlatform?.()) {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appUrlOpen', (data) => {
          if (data?.url && data.url.includes('token=')) {
            if (consumeAuthTokenFromUrl(data.url)) {
              window.dispatchEvent(new Event('starwaves:auth-change'))
              // Navigate to dashboard
              try { window.history.replaceState({}, '', '/app/dashboard'); window.dispatchEvent(new PopStateEvent('popstate')) } catch {}
              window.location.replace('/app/dashboard')
            }
          }
        }).catch(() => {})
      }).catch(() => {})
      // Also handle launch URL (cold start)
      try {
        import('@capacitor/app').then(({ App }) => {
          App.getLaunchUrl?.().then((res) => {
            if (res?.url && res.url.includes('token=')) consumeAuthTokenFromUrl(res.url)
          }).catch(() => {})
        }).catch(() => {})
      } catch {}
    }
  } catch {}
  // Tauri deep-link
  try {
    if (window.__TAURI__ || navigator.userAgent.includes('Tauri')) {
      import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl }) => {
        onOpenUrl((urls) => {
          const list = Array.isArray(urls) ? urls : [urls]
          for (const u of list) {
            if (typeof u === 'string' && u.includes('token=')) {
              if (consumeAuthTokenFromUrl(u)) {
                window.location.replace('/app/dashboard')
              }
            }
          }
        })
      }).catch(() => {})
      // Fallback: also check current URL for token (tauri://localhost?token=...)
      if (window.location.href.includes('token=')) consumeAuthTokenFromUrl(window.location.href)
    }
  } catch {}
  // Also check current location on web for native scheme passthrough (e.g. after redirect)
  try {
    if (window.location.href.includes('token=')) {
      // For web reuse of consume
      consumeAuthTokenFromHash()
    }
  } catch {}

  // Popup postMessage listener for web OAuth popup flows
  try {
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'STARWAVES_AUTH_SUCCESS' && event.data.data?.token) {
        setStoredAuthToken(event.data.data.token, event.data.data.user)
        window.dispatchEvent(new Event('starwaves:auth-change'))
      }
    })
  } catch {}
}

function request(path, options = {}) {
  return apiRequest(path, {
    errorMessage: 'Authentication request failed.',
    missingTokenMessage: 'Sign in to continue.',
    onFetchError: (error) =>
      new Error(
        error.message?.includes('Failed to fetch')
          ? 'Could not reach the StarWaves API. Start the backend server or set VITE_API_URL to a reachable API URL.'
          : error.message || 'Could not reach the StarWaves API.',
      ),
    ...options,
  })
}

export async function signupWithEmail(email, password) {
  const result = await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    authRequired: false,
  })
  setStoredAuthToken(result.token, result.user)
  return result.user
}

export async function loginWithEmail(email, password) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    authRequired: false,
  })
  if (result.token) {
    setStoredAuthToken(result.token, result.user)
  }
  return result.user || result
}

export async function verifyEmailOtp(email, otp) {
  const result = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
    authRequired: false,
  })
  if (result.token) {
    setStoredAuthToken(result.token, result.user)
  }
  return result.user
}

export async function resendEmailOtp(email) {
  return request('/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
    authRequired: false,
  })
}

export function requestPasswordReset(email) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    authRequired: false,
  })
}

export function verifyResetCode(email, code, token = '') {
  return request('/auth/verify-reset-code', {
    method: 'POST',
    body: JSON.stringify({ email, code, token }),
    authRequired: false,
  })
}

export function resetPassword(token, password) {
  return request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
    authRequired: false,
  })
}

export function deleteAccount() {
  return request('/auth/account', { method: 'DELETE' })
}

export async function fetchCurrentUser() {
  const token = getStoredAuthToken()
  if (!token) return null
  try {
    const user = await request('/auth/me')
    setStoredAuthToken(token, user)
    return user
  } catch (error) {
    if (error.status === 401 || error.message?.includes('Sign in') || error.message?.includes('Invalid')) {
      clearAuthSession()
      return null
    }
    return getStoredUser()
  }
}

export async function updateUserProfile(displayName, assistantName = null) {
  const body = { displayName }
  if (assistantName) body.assistantName = assistantName
  const updatedUser = await request('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const current = getStoredUser() || {}
  const cleanAssistant = updatedUser?.assistantName || assistantName || current.assistantName || 'Eve'
  const newUser = {
    ...current,
    displayName: updatedUser?.displayName || displayName,
    assistantName: cleanAssistant,
    isSubscribed: Boolean(updatedUser?.isSubscribed ?? current.isSubscribed),
  }
  setStoredAuthToken(getStoredAuthToken(), newUser)
  if (cleanAssistant) {
    try {
      localStorage.setItem('starwaves_assistant_name', cleanAssistant)
    } catch {}
  }
  return newUser
}

export async function updateCurrentUserProfile(profileData) {
  const user = await request('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  })
  const token = getStoredAuthToken()
  if (token) setStoredAuthToken(token, user)
  return user
}

export async function beginGoogleOAuth() {
  const isCapacitorNative = (() => {
    try { return !!window.Capacitor?.isNativePlatform?.() && window.Capacitor.isNativePlatform() } catch { return false }
  })()
  const isTauri = typeof window !== 'undefined' && (!!window.__TAURI__ || navigator.userAgent.includes('Tauri'))
  let platform = 'web'
  let origin = typeof window !== 'undefined' ? window.location.origin : ''
  if (isCapacitorNative) {
    platform = 'android'
    // Use capacitor scheme as origin for backend validation
    origin = 'capacitor://localhost'
    // Also ensure listener is set up before opening browser
    setupNativeOAuthListeners()
  } else if (isTauri) {
    platform = 'tauri'
    origin = 'tauri://localhost'
    setupNativeOAuthListeners()
  }
  const data = await request(`/auth/google/login?origin=${encodeURIComponent(origin)}&platform=${platform}`, { authRequired: false })
  if (!data?.url) throw new Error('Could not initiate Google authentication.')

  if (platform === 'android') {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: data.url, windowName: '_blank' })
      // Keep promise pending; deep-link will resolve via appUrlOpen
      return new Promise(() => {})
    } catch {
      // Fallback to system open via window
      window.location.assign(data.url)
      return new Promise(() => {})
    }
  }
  if (platform === 'tauri') {
    try {
      const shell = await import('@tauri-apps/plugin-shell').catch(() => null)
      if (shell?.open) {
        await shell.open(data.url)
      } else if (window.__TAURI__?.shell?.open) {
        await window.__TAURI__.shell.open(data.url)
      } else {
        window.open(data.url, '_blank', 'noopener')
      }
      return new Promise(() => {})
    } catch {
      window.location.assign(data.url)
      return new Promise(() => {})
    }
  }
  window.location.assign(data.url)
  return new Promise(() => {})
}

export function requestAccountCombine(targetEmail) {
  return request('/auth/combine-account/request', {
    method: 'POST',
    body: JSON.stringify({ target_email: targetEmail }),
  })
}

export function verifyAccountCombine(token) {
  return request('/auth/combine-account/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
    authRequired: false,
  })
}

export function fetchCombinedAccounts() {
  return request('/auth/combine-account/list')
}

export function unlinkCombinedAccount(targetIdentifier) {
  return request(`/auth/combine-account/unlink?target_identifier=${encodeURIComponent(targetIdentifier)}`, {
    method: 'DELETE',
  })
}

export function fetchDeviceSessions() {
  return request('/auth/sessions', { useCache: false })
}

export function renameDeviceSession(sessionId, deviceName) {
  return request(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ device_name: deviceName }),
  })
}

export function revokeDeviceSession(sessionId) {
  return request(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}

export function revokeOtherSessions() {
  return request('/auth/sessions/revoke-others', { method: 'POST' })
}

// Auto-setup native OAuth listeners on load (deep-link)
if (typeof window !== 'undefined') {
  try {
    // Defer to next tick so Capacitor bridge is ready
    setTimeout(() => { try { setupNativeOAuthListeners() } catch {} }, 0)
  } catch {}
}
