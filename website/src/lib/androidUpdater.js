import { fetchUpdateCheck, getAppVersion } from './updatesApi'

export const isNativeAndroid = () => {
  try {
    const cap = window.Capacitor
    if (cap?.isNativePlatform?.()) return cap.getPlatform?.() === 'android'
  } catch {}
  // Fallback UA check for WebView
  if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) return true
  return false
}

export async function checkAndroidUpdateSilent() {
  // Allow in browser for testing if running on Android UA, else skip in dev desktop?
  // We always attempt when isNativeAndroid OR when running as PWA on Android
  if (typeof window === 'undefined') return null
  // In dev on desktop we still want to exercise flow if queried manually; silent returns null unless android
  const isAndroid = isNativeAndroid()
  // For silent, only check when on Android to avoid spurious network
  if (!isAndroid) {
    // Still allow check via Settings About on any platform (interactive)
    return null
  }
  try {
    const current = getAppVersion()
    const info = await fetchUpdateCheck('android', current)
    if (!info?.updateAvailable) return null
    return info
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[androidUpdater] check failed', err)
    return null
  }
}

export async function checkAndroidUpdateInteractive() {
  const current = getAppVersion()
  const info = await fetchUpdateCheck('android', current)
  return info
}

export function triggerAndroidDownload(url) {
  if (!url) return
  // Phase 1: browser download (user completes install after enabling unknown sources)
  try {
    window.open(url, '_blank', 'noopener')
  } catch {
    window.location.href = url
  }
}

export async function tryNativeInstall(url) {
  // Phase 2 native installer (requires Kotlin plugin). Gracefully fallback to browser
  // If a native UpdaterPlugin is present (Phase 2), delegate.
  try {
    const cap = window.Capacitor
    if (cap?.Plugins?.UpdaterPlugin?.installApk) {
      await cap.Plugins.UpdaterPlugin.installApk({ url })
      return true
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[androidUpdater] native installer failed, fallback', err)
  }
  triggerAndroidDownload(url)
  return false
}
