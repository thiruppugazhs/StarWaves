import { apiRequest } from './request'

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

export async function signupWithEmail(email, password, name = '') {
  const result = await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name: name || undefined }),
    authRequired: false,
  })
  return result
}

export async function loginWithEmail(email, password) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    authRequired: false,
  })
  if (result.status === 'authenticated' && result.token) {
    setStoredAuthToken(result.token, result.user)
  }
  return result
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
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const data = await request(`/auth/google/login?origin=${encodeURIComponent(origin)}`, { authRequired: false })
  if (!data?.url) throw new Error('Could not initiate Google authentication.')

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
