import { useState } from 'react'
import { Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { checkAndroidUpdateInteractive } from '../../lib/androidUpdater'
import { checkDesktopUpdateInteractive, isTauri } from '../../lib/desktopUpdater'
import { isNative as isCapacitorNative } from '../../lib/otaUpdater'
import { fetchOtaLatest, getAppVersion } from '../../lib/updatesApi'
import { SettingsCard, SettingsSection } from '../../components/ui'

export function UpdateSection() {
  const version = getAppVersion()
  const tauri = isTauri()
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null) // { platform, info, upToDate, error }

  const handleCheck = async () => {
    setChecking(true)
    setResult(null)
    try {
      if (tauri) {
        const res = await checkDesktopUpdateInteractive()
        setResult({ platform: 'windows', info: res.info, upToDate: !res.info?.updateAvailable, error: null })
      } else {
        // Try android check, fallback to OTA
        try {
          const info = await checkAndroidUpdateInteractive()
          setResult({
            platform: 'android',
            info,
            upToDate: !info?.updateAvailable,
            error: null,
          })
        } catch (err) {
          // Fallback OTA if android endpoint 404
          const ota = await fetchOtaLatest()
          if (ota) setResult({ platform: 'ota', info: ota, upToDate: false, error: null })
          else setResult({ platform: 'web', info: null, upToDate: true, error: null })
          if (!ota) throw err
        }
      }
    } catch (err) {
      setResult({ platform: 'error', info: null, upToDate: false, error: err.message || String(err) })
    } finally {
      setChecking(false)
    }
  }

  const platformLabel = tauri ? 'Desktop (Tauri)' : 'Android / Web'

  // Native-shell only: on plain web there is nothing to update in-app —
  // the site refreshes itself on redeploy. Render nothing instead of
  // exposing Tauri/APK/OTA machinery that can never apply.
  if (!tauri && !isCapacitorNative()) return null

  return (
    <SettingsSection id="settings-updates" title="Updates" description={`Current version v${version} • ${platformLabel}`}>
      <SettingsCard title="App updates" description="Check for new versions hosted on the backend. Updates are optional and signed.">
        <div className="update-check-row">
          <button
            type="button"
            className="btn btn-primary update-check-btn"
            onClick={handleCheck}
            disabled={checking}
          >
            {checking ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
          <span className="update-check-hint">
            Backend: <code>/api/v1/updates/check</code> + <code>/updates/…</code>
          </span>
        </div>

        {result && (
          <div className="update-result">
            {result.error ? (
              <div className="update-result-row update-result-row-primary">
                <AlertCircle size={16} /> <span className="update-result-text">{result.error}</span>
              </div>
            ) : result.upToDate ? (
              <div className="update-result-row">
                <CheckCircle size={16} /> <span className="update-result-text">You are on the latest version (v{version}).</span>
              </div>
            ) : (
              <div className="update-result-column">
                <strong className="update-result-title">
                  Update available — v{result.info?.latestVersion || result.info?.version}
                </strong>
                {result.info?.notes && <span className="update-result-notes">{result.info.notes}</span>}
                {result.info?.url && (
                  <a href={result.info.url} target="_blank" rel="noreferrer" className="update-result-link">
                    Download artifact
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        <p className="update-footnote">
          Desktop uses Tauri signed updater (<code>latest.json</code>). Android uses backend <code>android.json</code> → browser APK download. OTA bundles via <code>/ota/latest.json</code> when Capgo plugin is present.
        </p>
      </SettingsCard>
    </SettingsSection>
  )
}
