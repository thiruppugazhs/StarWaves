// Pure auth/device storage helpers — zero imports.
//
// Lives apart from `authApi.js` on purpose: `request.js` needs these on every
// call (Authorization header + device headers + 401 cleanup), while
// `authApi.js` needs `apiRequest` from `request.js`. Keeping storage here
// breaks that cycle so `request.js` never imports `authApi.js`
// (previously a static import plus an ineffective dynamic import of the same
// module). `authApi.js` re-exports everything below for backward
// compatibility, so existing `from './authApi'` call sites keep working.

const TOKEN_KEY = 'starwaves_auth_token'
const USER_KEY = 'starwaves_auth_user'
const DEVICE_ID_KEY = 'starwaves.device_id'
const DEVICE_NAME_KEY = 'starwaves.device_name'

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function getDeviceName() {
  const stored = localStorage.getItem(DEVICE_NAME_KEY)
  if (stored) return stored
  try {
    const ua = navigator.userAgent || ''
    if (/Mobile|Android|iPhone|iPad/.test(ua)) {
      if (/Android/.test(ua)) return 'Android device'
      if (/iPhone|iPad/.test(ua)) return 'iPhone'
      return 'Mobile device'
    }
    if (/Mac/.test(ua)) return 'Mac'
    if (/Windows/.test(ua)) return 'Windows PC'
    return 'Web browser'
  } catch {
    return 'Web browser'
  }
}

export function setDeviceName(name) {
  if (name) localStorage.setItem(DEVICE_NAME_KEY, String(name).slice(0, 255))
}

export function getStoredAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredAuthToken(token, user = null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } else if (user === null) {
    localStorage.removeItem(USER_KEY)
  }
  window.dispatchEvent(new Event('starwaves:auth-change'))
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('starwaves-auth')
      ch.postMessage({ type: 'auth-change' })
      ch.close()
    }
  } catch {}
}

export function getStoredUser() {
  try {
    const data = localStorage.getItem(USER_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  window.dispatchEvent(new Event('starwaves:auth-change'))
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('starwaves-auth')
      ch.postMessage({ type: 'auth-change' })
      ch.close()
    }
  } catch {}
}
