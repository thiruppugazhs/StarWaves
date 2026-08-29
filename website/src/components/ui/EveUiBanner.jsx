import { useEffect, useState } from 'react'
import { Sparkles, RotateCcw, X } from 'lucide-react'
import { restoreUiVersion, getUiHistory } from '../../lib/uiPreferencesApi'

export function EveUiBanner() {
  const [visible, setVisible] = useState(false)
  const [detail, setDetail] = useState(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    const onUpdate = (e) => {
      const prefs = e.detail?.preferences
      const version = prefs?.version
      setDetail({ version, prefs })
      setVisible(true)
      const t = setTimeout(() => setVisible(false), 12000)
      return () => clearTimeout(t)
    }
    window.addEventListener('eve-ui-update', onUpdate)
    return () => window.removeEventListener('eve-ui-update', onUpdate)
  }, [])

  const handleUndo = async () => {
    if (!detail?.prefs) return
    setRestoring(true)
    try {
      const hist = await getUiHistory()
      const prev = hist?.history?.length ? hist.history[hist.history.length - 1] : null
      const targetVersion = prev?.version
      if (targetVersion) {
        const res = await restoreUiVersion(targetVersion)
        if (res?.preferences) {
          window.dispatchEvent(new CustomEvent('eve-ui-update', { detail: { preferences: res.preferences } }))
          // also force reload of styles via storage event
          try {
            localStorage.setItem('starwaves.ui.cache', JSON.stringify(res.preferences))
          } catch {}
          window.location.reload()
        }
      } else {
        window.location.reload()
      }
    } catch {
      // fallback
    } finally {
      setRestoring(false)
      setVisible(false)
    }
  }

  const handleReview = () => {
    window.history.pushState({}, '', '/app/setting#settings-appearance')
    window.dispatchEvent(new Event('hashchange'))
    setVisible(false)
    // small delay then scroll
    setTimeout(() => {
      document.getElementById('settings-appearance')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  if (!visible || !detail) return null

  return (
    <div className="eve-ui-banner" role="status" aria-live="polite">
      <Sparkles size={14} />
      <span>
        Eve updated UI — <strong>v{detail.version}</strong>
      </span>
      <div className="eve-ui-banner-actions">
        <button type="button" className="eve-ui-banner-btn" onClick={handleReview}>
          Review
        </button>
        <button type="button" className="eve-ui-banner-btn" onClick={handleUndo} disabled={restoring}>
          <RotateCcw size={12} /> {restoring ? 'Undoing…' : 'Undo'}
        </button>
      </div>
      <button type="button" className="eve-ui-banner-close" aria-label="Dismiss" onClick={() => setVisible(false)}>
        <X size={14} />
      </button>
    </div>
  )
}
