import { useCallback, useEffect, useRef, useState } from 'react'
import { checkAndroidUpdateSilent, isNativeAndroid } from '../lib/androidUpdater'
import { checkDesktopUpdateSilent, isTauri } from '../lib/desktopUpdater'
import { checkOtaUpdate, notifyAppReady } from '../lib/otaUpdater'

const INTERVAL_MS = 6 * 60 * 60 * 1000 // 6h for desktop, Android shares same interval
const DISMISS_KEY_PREFIX = 'starwaves:update:dismissed:'

function isDismissed(version) {
  if (!version) return false
  try {
    return localStorage.getItem(`${DISMISS_KEY_PREFIX}${version}`) === '1'
  } catch { return false }
}

export function useAutoUpdater() {
  const [update, setUpdate] = useState(null) // { platform, info } or null
  const [checking, setChecking] = useState(false)
  const timerRef = useRef(null)

  const checkNow = useCallback(async ({ silent = true } = {}) => {
    if (checking) return update
    setChecking(true)
    try {
      // Priority: desktop > android > ota
      if (isTauri()) {
        const info = await checkDesktopUpdateSilent()
        if (info && !isDismissed(info.latestVersion)) {
          const payload = { platform: 'windows', info }
          setUpdate(payload)
          return payload
        }
        if (!silent) return { platform: 'windows', info, upToDate: !info }
      }
      if (isNativeAndroid()) {
        const info = await checkAndroidUpdateSilent()
        if (info && !isDismissed(info.latestVersion)) {
          const payload = { platform: 'android', info }
          setUpdate(payload)
          return payload
        }
        // OTA next
        const ota = await checkOtaUpdate()
        if (ota && !isDismissed(ota.version)) {
          const payload = { platform: 'ota', info: ota }
          setUpdate(payload)
          return payload
        }
        if (!silent) return { platform: 'android', info, upToDate: !info }
      }
      // Web/PWA OTA not yet, but still allow check via Settings About on any platform
      return null
    } finally {
      setChecking(false)
    }
  }, [checking, update])

  const dismiss = useCallback(() => {
    if (update?.info?.latestVersion) {
      try { localStorage.setItem(`${DISMISS_KEY_PREFIX}${update.info.latestVersion}`, '1') } catch {}
    } else if (update?.info?.version) {
      try { localStorage.setItem(`${DISMISS_KEY_PREFIX}${update.info.version}`, '1') } catch {}
    }
    setUpdate(null)
  }, [update])

  const clear = useCallback(() => setUpdate(null), [])

  useEffect(() => {
    // Notify Capgo that app is ready
    notifyAppReady()
    // Initial check after a short delay so dashboard burst settles (avoid thundering herd)
    const t = setTimeout(() => { checkNow({ silent: true }) }, 3500)
    timerRef.current = setInterval(() => checkNow({ silent: true }), INTERVAL_MS)
    // Resume on visibility (Android)
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkNow({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    // Capacitor App resume
    let capSub
    try {
      const cap = window.Capacitor?.Plugins?.App
      if (cap?.addListener) {
        cap.addListener('resume', () => checkNow({ silent: true })).then(s => { capSub = s })
      }
    } catch {}
    return () => {
      clearTimeout(t)
      clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      try { capSub?.remove?.() } catch {}
    }
  }, [checkNow])

  return { update, checking, checkNow, dismiss, clear, setUpdate }
}
