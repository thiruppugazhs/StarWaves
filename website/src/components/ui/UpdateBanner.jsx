import { Download, RefreshCw, X } from 'lucide-react'
import { tryNativeInstall } from '../../lib/androidUpdater'
import { performDesktopUpdateViaPlugin } from '../../lib/desktopUpdater'
import { applyOtaViaCapgo } from '../../lib/otaUpdater'

export function UpdateBanner({ update, onDismiss }) {
  if (!update) return null
  const { platform, info } = update
  const isDesktop = platform === 'windows'
  const isAndroid = platform === 'android'
  const isOta = platform === 'ota'

  const version = info?.latestVersion || info?.version || ''
  const notes = info?.notes || (isOta ? `Web bundle ${version}` : '')

  const handleUpdate = async () => {
    try {
      if (isDesktop) {
        await performDesktopUpdateViaPlugin(info)
      } else if (isAndroid) {
        // Prefer native installer if present, else browser
        await tryNativeInstall(info.url)
      } else if (isOta) {
        const done = await applyOtaViaCapgo(info)
        if (!done) {
          // Fallback: open notes or reload
          if (info.url) window.open(info.url, '_blank', 'noopener')
          else window.location.reload()
        }
      }
    } catch (err) {
      // Fallback to opening URL
      if (info?.url) window.open(info.url, '_blank', 'noopener')
      console.error('[UpdateBanner] update failed', err)
    }
  }

  const platformLabel = isDesktop ? 'Desktop update' : isAndroid ? 'Android update' : 'Web update'

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <div className="update-banner-icon">
        {isOta ? <RefreshCw size={16} /> : <Download size={16} />}
      </div>
      <div className="update-banner-content">
        <strong>
          {platformLabel} {version ? `v${version}` : ''} available
        </strong>
        {notes && <span className="update-banner-notes">{notes.slice(0, 120)}</span>}
      </div>
      <div className="update-banner-actions">
        <button type="button" className="update-banner-btn update-banner-btn-primary" onClick={handleUpdate}>
          {isDesktop ? 'Install & Relaunch' : isAndroid ? 'Download APK' : 'Update'}
        </button>
        <button type="button" className="update-banner-btn" onClick={onDismiss} aria-label="Dismiss update">
          Later
        </button>
      </div>
      <button type="button" className="update-banner-close" aria-label="Dismiss" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  )
}
