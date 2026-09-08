import { fetchUpdateCheck, getAppVersion } from './updatesApi'

const TAURI_FLAG = '__TAURI__'

export const isTauri = () => {
  if (typeof window === 'undefined') return false
  return !!window[TAURI_FLAG] || !!window.__TAURI_INTERNALS__ || navigator.userAgent.includes('Tauri')
}

let checking = false

function arch() {
  // Best-effort arch detection; Tauri reports x86_64 for Windows
  const ua = navigator.userAgent || ''
  if (ua.includes('WOW64') || ua.includes('Win64') || ua.includes('x64')) return 'x86_64'
  return 'x86_64'
}

export async function checkDesktopUpdateSilent() {
  if (!isTauri()) return null
  if (checking) return null
  checking = true
  try {
    const current = getAppVersion()
    const info = await fetchUpdateCheck('windows', current, arch())
    if (!info?.updateAvailable) return null
    // Do not auto-download; let banner handle user consent (non-blocking)
    return info
  } catch (err) {
    // silent failure; log only in dev
    if (import.meta.env.DEV) console.warn('[desktopUpdater] check failed', err)
    return null
  } finally {
    checking = false
  }
}

export async function performDesktopUpdateViaPlugin(updateInfo) {
  // Tauri plugin path (if plugin is present at runtime)
  try {
    const mod = await import('@tauri-apps/plugin-updater')
    const { check } = mod
    const update = await check()
    if (!update) {
      // Fallback to browser open if plugin reports no update but our API does
      if (updateInfo?.url) window.open(updateInfo.url, '_blank', 'noopener')
      return
    }
    await update.downloadAndInstall((ev) => {
      if (import.meta.env.DEV) console.log('[updater] event', ev)
      if (ev.event === 'Finished') {
        // will relaunch
      }
    })
    const proc = await import('@tauri-apps/plugin-process')
    await proc.relaunch()
  } catch (err) {
    // Fallback: open artifact URL in browser (works for manual download)
    if (updateInfo?.url) {
      window.open(updateInfo.url, '_blank', 'noopener')
    } else {
      throw err
    }
  }
}

export async function checkDesktopUpdateInteractive() {
  if (!isTauri()) throw new Error('Not running inside Tauri desktop')
  checking = true
  try {
    const current = getAppVersion()
    const info = await fetchUpdateCheck('windows', current, arch())
    if (!info?.updateAvailable) return { updated: false, info }
    // Load dialog plugin if available
    try {
      const dlg = await import('@tauri-apps/plugin-dialog')
      const yes = await dlg.ask(`Version ${info.latestVersion} available.\n\n${info.notes || ''}\n\nInstall now?`, {
        title: 'Starwaves Update',
        kind: 'info',
      })
      if (!yes) return { updated: false, info, dismissed: true }
    } catch {
      const yes = window.confirm(`Version ${info.latestVersion} available.\n${info.notes || ''}\n\nInstall now?`)
      if (!yes) return { updated: false, info, dismissed: true }
    }
    await performDesktopUpdateViaPlugin(info)
    return { updated: true, info }
  } finally {
    checking = false
  }
}
