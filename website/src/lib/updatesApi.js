import { API_URL } from './request'

const UPDATES_PREFIX = '/updates'

export async function fetchUpdateCheck(platform, currentVersion, arch) {
  const params = new URLSearchParams({ platform, currentVersion })
  if (arch) params.set('arch', arch)
  const url = `${API_URL}${UPDATES_PREFIX}/check?${params.toString()}`
  // public, no auth; use native fetch to avoid token requirement
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Update check failed (${res.status})`)
  }
  return res.json()
}

export async function fetchTauriLatest() {
  const r = await fetch(`${API_URL}${UPDATES_PREFIX}/latest.json`, { mode: 'cors' })
  if (!r.ok) throw new Error('No desktop release')
  return r.json()
}

export async function fetchAndroidLatest() {
  const r = await fetch(`${API_URL}${UPDATES_PREFIX}/android.json`, { mode: 'cors' })
  if (!r.ok) throw new Error('No Android release')
  return r.json()
}

export async function fetchOtaLatest() {
  const r = await fetch(`${API_URL}${UPDATES_PREFIX}/ota/latest.json`, { mode: 'cors' })
  if (r.status === 404) return null
  if (!r.ok) throw new Error('OTA check failed')
  return r.json()
}

export function getAppVersion() {
  // Injected via vite define __APP_VERSION__
  try {
    // eslint-disable-next-line no-undef
    if (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) return String(__APP_VERSION__)
  } catch {}
  // Fallback: package.json version at build time or DOM meta
  const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="app-version"]')?.content : null
  if (meta) return meta
  return '0.1.0'
}
