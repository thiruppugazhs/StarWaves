import { useCallback, useEffect, useState } from 'react'
import { Palette, RotateCcw, History, Eye } from 'lucide-react'
import { SettingsCard, SettingsSection } from '../../components/ui'
import {
  getUiHistory,
  resetUiPreferences,
  restoreUiVersion,
  clearUiPreferences,
} from '../../lib/uiPreferencesApi'
import { useCustomUI } from '../../hooks/useCustomUI'

export function AppearanceSection() {
  const { prefs: ctxPrefs, refresh: refreshCtx } = useCustomUI()
  const [prefs, setPrefs] = useState(ctxPrefs ?? null)
  const [history, setHistory] = useState(ctxPrefs?.history ?? [])
  const [loading, setLoading] = useState(!ctxPrefs)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCss, setShowCss] = useState(false)

  const loadHistoryOnly = useCallback(async () => {
    try {
      const histRes = await getUiHistory().catch(() => ({ history: [] }))
      // history is also embedded in prefs.history; prefer dedicated endpoint
      if (histRes?.history?.length) setHistory(histRes.history)
      else if (ctxPrefs?.history) setHistory(ctxPrefs.history)
    } catch {}
  }, [ctxPrefs])

  useEffect(() => {
    // Sync with provider — no fetch of /ui/preferences here (provider owns it, cached 120s)
    if (ctxPrefs) {
      setPrefs(ctxPrefs)
      setHistory(ctxPrefs.history ?? [])
      setLoading(false)
      setError('')
    }
    // Still ensure history is fresh if provider had no history
    if (ctxPrefs && !ctxPrefs.history?.length) loadHistoryOnly()
    if (!ctxPrefs) {
      setLoading(true)
      loadHistoryOnly().finally(() => setLoading(false))
    }
  }, [ctxPrefs, loadHistoryOnly])

  useEffect(() => {
    const onUpdate = (e) => {
      if (e.detail?.preferences) {
        setPrefs(e.detail.preferences)
        setHistory(e.detail.preferences.history || [])
        setLoading(false)
      }
    }
    window.addEventListener('eve-ui-update', onUpdate)
    return () => window.removeEventListener('eve-ui-update', onUpdate)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await refreshCtx({ force: true })
      await loadHistoryOnly()
    } catch (err) {
      setError(err.message || 'Could not load UI preferences.')
    } finally {
      setLoading(false)
    }
  }, [refreshCtx, loadHistoryOnly])

  const handleResetGlobal = async () => {
    setBusy(true)
    try {
      const res = await clearUiPreferences()
      const p = res?.preferences
      if (p) {
        setPrefs(p)
        setHistory(p.history || [])
        window.dispatchEvent(new CustomEvent('eve-ui-update', { detail: { preferences: p } }))
      } else {
        await load()
      }
    } catch (err) {
      setError(err.message || 'Reset failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (version) => {
    setBusy(true)
    try {
      const res = await restoreUiVersion(version)
      const p = res?.preferences
      if (p) {
        setPrefs(p)
        setHistory(p.history || [])
        window.dispatchEvent(new CustomEvent('eve-ui-update', { detail: { preferences: p } }))
      }
    } catch (err) {
      setError(err.message || `Restore v${version} failed.`)
    } finally {
      setBusy(false)
    }
  }

  const handleResetPage = async (page) => {
    setBusy(true)
    try {
      const res = await resetUiPreferences(page, null)
      const p = res?.preferences
      if (p) {
        setPrefs(p)
        setHistory(p.history || [])
        window.dispatchEvent(new CustomEvent('eve-ui-update', { detail: { preferences: p } }))
      }
    } catch (err) {
      setError(err.message || `Reset ${page} failed.`)
    } finally {
      setBusy(false)
    }
  }

  const globalTokens = prefs?.global_tokens || {}
  const globalCss = prefs?.global_css || ''
  const pages = prefs?.pages || {}
  const version = prefs?.version || 1
  const hasOverrides = Object.keys(globalTokens).length > 0 || Boolean(globalCss) || Object.keys(pages).length > 0

  return (
    <SettingsSection id="settings-appearance" title="Appearance — Eve UI" icon={Palette} description="UI customizations made by Eve. Versioned, reversible, per-page.">
      <SettingsCard title="Current overrides" description={`Version v${version}${hasOverrides ? ' · Eve has customized your UI' : ' · Default theme'}`}>
        {loading ? (
          <p className="appearance-note">Loading…</p>
        ) : error ? (
          <p className="appearance-note-error">{error}</p>
        ) : !hasOverrides ? (
          <p className="appearance-note">
            No Eve overrides yet. Try asking Eve: “Make the cards more rounded” or “Create a custom page for my notes”.
          </p>
        ) : (
          <div className="appearance-stack">
            {Object.keys(globalTokens).length > 0 && (
              <div>
                <strong className="appearance-label">Global tokens</strong>
                <pre className="appearance-code">
                  {JSON.stringify(globalTokens, null, 2)}
                </pre>
              </div>
            )}
            {globalCss && (
              <div>
                <div className="appearance-row-head">
                  <strong className="appearance-label">Global CSS</strong>
                  <button type="button" onClick={() => setShowCss((v) => !v)} className="appearance-pill-btn" aria-expanded={showCss}>
                    <Eye size={10} />
                    {showCss ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showCss && (
                  <pre className="appearance-code appearance-code-wrap">
                    {globalCss}
                  </pre>
                )}
              </div>
            )}
            {Object.keys(pages).length > 0 && (
              <div>
                <strong className="appearance-label">Per-page overrides</strong>
                <div className="appearance-list">
                  {Object.entries(pages).map(([page, val]) => (
                    <div key={page} className="appearance-row">
                      <span className="appearance-row-name">{page}</span>
                      <span className="appearance-row-meta">
                        {val?.tokens ? `${Object.keys(val.tokens).length} tokens` : ''}
                        {val?.css ? ' · CSS' : ''}
                        {val?.visibility ? ' · visibility' : ''}
                        {val?.type === 'custom_page' ? ` · ${val.title}` : ''}
                      </span>
                      <button type="button" disabled={busy} onClick={() => handleResetPage(page)} className="appearance-pill-btn">
                        Reset
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="appearance-actions">
              <button type="button" disabled={busy} onClick={handleResetGlobal} className="appearance-primary-btn">
                <RotateCcw size={12} /> {busy ? 'Resetting…' : 'Reset all to default'}
              </button>
            </div>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Version history" description={`Last ${history.length} versions — click Restore to undo`}>
        {history.length === 0 ? (
          <p className="appearance-note">No history yet.</p>
        ) : (
          <div className="appearance-history">
            {[...history].reverse().map((h) => (
              <div key={h.version} className={`appearance-row${h.version === version ? ' appearance-row-active' : ''}`}>
                <span className="appearance-label">
                  <strong>v{h.version}</strong> · {h.cause || 'update'} ·{' '}
                  <span className="appearance-row-time">{h.at ? new Date(h.at).toLocaleString() : ''}</span>
                </span>
                <button type="button" disabled={busy || h.version === version} onClick={() => handleRestore(h.version)} className="appearance-pill-btn">
                  <History size={10} />Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </SettingsSection>
  )
}
