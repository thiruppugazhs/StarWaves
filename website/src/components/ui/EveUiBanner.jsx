import { useEffect, useRef, useState } from 'react'
import { Sparkles, RotateCcw, X } from 'lucide-react'
import { restoreUiVersion, getUiHistory } from '../../lib/uiPreferencesApi'

const UI_CACHE_KEY = 'starwaves.ui.cache'
const BANNER_AUTO_HIDE_MS = 12000

export function EveUiBanner() {
  const [visible, setVisible] = useState(false)
  const [detail, setDetail] = useState(null)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState('')
  const hideTimer = useRef(null)

  useEffect(() => {
    const scheduleHide = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setVisible(false), BANNER_AUTO_HIDE_MS)
    }
    const onUpdate = (e) => {
      const prefs = e.detail?.preferences
      if (!prefs) return
      setDetail({ version: prefs.version, prefs })
      setError('')
      setVisible(true)
      scheduleHide()
    }
    window.addEventListener('eve-ui-update', onUpdate)
    return () => {
      window.removeEventListener('eve-ui-update', onUpdate)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  const handleUndo = async () => {
    if (!detail?.prefs || restoring) return
    setRestoring(true)
    setError('')
    try {
      const currentVersion = Number(detail.prefs.version) || null
      const hist = await getUiHistory().catch(() => ({ history: [] }))
      const entries = Array.isArray(hist?.history) ? hist.history : []
      // History snapshots store the pre-mutation version, so the entry to
      // restore is currentVersion - 1 (== last history entry in the normal case).
      let targetVersion = currentVersion ? currentVersion - 1 : null
      if (targetVersion && !entries.some((h) => Number(h.version) === targetVersion)) {
        targetVersion = entries.length ? Number(entries[entries.length - 1].version) : null
      }
      if (!targetVersion) {
        setError('No earlier version to undo to yet.')
        return
      }
      const res = await restoreUiVersion(targetVersion)
      if (res?.preferences) {
        try {
          localStorage.setItem(UI_CACHE_KEY, JSON.stringify(res.preferences))
        } catch {}
        window.dispatchEvent(new CustomEvent('eve-ui-update', { detail: { preferences: res.preferences } }))
        setVisible(false)
      }
    } catch (err) {
      setError(err?.message || 'Undo failed.')
    } finally {
      setRestoring(false)
    }
  }

  const handleReview = () => {
    // App's useRouter syncs on `popstate` (not `hashchange`), so dispatch
    // popstate for the SPA route to update, then scroll to the anchor.
    window.history.pushState({}, '', '/app/setting#settings-appearance')
    window.dispatchEvent(new PopStateEvent('popstate'))
    setVisible(false)
    setTimeout(() => {
      document.getElementById('settings-appearance')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleDismiss = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setVisible(false)
  }

  if (!visible || !detail) return null

  return (
    <div className="eve-ui-banner" role="status" aria-live="polite">
      <Sparkles size={14} />
      <span>
        Eve updated UI — <strong>v{detail.version}</strong>
      </span>
      {error && <span className="eve-ui-banner-error">{error}</span>}
      <div className="eve-ui-banner-actions">
        <button type="button" className="eve-ui-banner-btn" onClick={handleReview}>
          Review
        </button>
        <button type="button" className="eve-ui-banner-btn" onClick={handleUndo} disabled={restoring}>
          <RotateCcw size={12} /> {restoring ? 'Undoing…' : 'Undo'}
        </button>
      </div>
      <button type="button" className="eve-ui-banner-close" aria-label="Dismiss" onClick={handleDismiss}>
        <X size={14} />
      </button>
    </div>
  )
}
