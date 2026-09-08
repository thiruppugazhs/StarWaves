import { fetchOtaLatest, getAppVersion } from './updatesApi'

const LAST_BUNDLE_KEY = 'starwaves:ota:bundleId'

export const isNative = () => {
  try {
    return !!window.Capacitor?.isNativePlatform?.()
  } catch { return false }
}

// Phase 1: lightweight OTA — self-hosted bundle zip
// For @capgo/capacitor-updater migration, this module becomes thin wrapper.
export async function checkOtaUpdate() {
  if (!isNative()) return null
  try {
    const latest = await fetchOtaLatest()
    if (!latest) return null
    const last = localStorage.getItem(LAST_BUNDLE_KEY)
    if (last && last === latest.bundleId) return null
    // Optional: compare version vs current
    const current = getAppVersion()
    if (latest.version === current && last) return null
    return latest
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[otaUpdater] check failed', err)
    return null
  }
}

export async function applyOtaViaCapgo(bundle) {
  // If @capgo/capacitor-updater is installed, use it
  try {
    const mod = await import('@capgo/capacitor-updater')
    // Capgo API: Updater.download({ url, version }) then set()
    // We keep compat with CodePush-style
    if (mod?.CapacitorUpdater?.download) {
      const res = await mod.CapacitorUpdater.download({ url: bundle.url, version: bundle.version })
      // res may contain id
      if (res?.version) {
        await mod.CapacitorUpdater.set({ version: res.version })
        localStorage.setItem(LAST_BUNDLE_KEY, bundle.bundleId)
        window.location.reload()
        return true
      }
    }
  } catch {
    // fall through to manual toast + reload prompt
  }
  // Manual fallback: just prompt user to reload — actual bundle apply requires Capgo plugin
  // For now, store bundle id and force reload so next load can pick new assets if server serves new bundle via /updates
  localStorage.setItem(LAST_BUNDLE_KEY, bundle.bundleId)
  return false
}

// Call on app start when native
export async function notifyAppReady() {
  if (!isNative()) return
  try {
    const mod = await import('@capgo/capacitor-updater')
    await mod?.CapacitorUpdater?.notifyAppReady?.()
  } catch {}
}
