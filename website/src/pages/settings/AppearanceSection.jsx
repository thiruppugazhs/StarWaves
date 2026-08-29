import { useEffect, useState } from 'react'
import { Palette, RotateCcw, History, Eye } from 'lucide-react'
import { SettingsCard, SettingsSection } from '../../components/ui'
import {
  getUiPreferences,
  getUiHistory,
  resetUiPreferences,
  restoreUiVersion,
  clearUiPreferences,
} from '../../lib/uiPreferencesApi'

export function AppearanceSection() {
  const [prefs, setPrefs] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCss, setShowCss] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [prefRes, histRes] = await Promise.all([getUiPreferences(), getUiHistory().catch(() => ({ history: [] }))])
      setPrefs(prefRes?.preferences || null)
      setHistory(histRes?.history || prefRes?.preferences?.history || [])
    } catch (err) {
      setError(err.message || 'Could not load UI preferences.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const onUpdate = (e) => {
      if (e.detail?.preferences) {
        setPrefs(e.detail.preferences)
        setHistory(e.detail.preferences.history || [])
      }
    }
    window.addEventListener('eve-ui-update', onUpdate)
    return () => window.removeEventListener('eve-ui-update', onUpdate)
  }, [])

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
        window.location.reload()
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
      <SettingsCard title="Current overrides" subtitle={`Version v${version}${hasOverrides ? ' · Eve has customized your UI' : ' · Default theme'}`}>
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
        ) : error ? (
          <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>
        ) : !hasOverrides ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No Eve overrides yet. Try asking Eve: “Make the cards more rounded” or “Create a custom page for my notes”.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {Object.keys(globalTokens).length > 0 && (
              <div>
                <strong style={{ fontSize: 12 }}>Global tokens</strong>
                <pre style={{ marginTop: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 10, fontSize: 11, overflow: 'auto' }}>
                  {JSON.stringify(globalTokens, null, 2)}
                </pre>
              </div>
            )}
            {globalCss && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 12 }}>Global CSS</strong>
                  <button type="button" onClick={() => setShowCss((v) => !v)} style={{ fontSize: 11, border: '1px solid var(--border-color)', borderRadius: 999, padding: '2px 8px', background: 'var(--bg-card)' }}>
                    <Eye size={10} style={{ display: 'inline', marginRight: 4 }} />
                    {showCss ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showCss && (
                  <pre style={{ marginTop: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 10, fontSize: 11, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                    {globalCss}
                  </pre>
                )}
              </div>
            )}
            {Object.keys(pages).length > 0 && (
              <div>
                <strong style={{ fontSize: 12 }}>Per-page overrides</strong>
                <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                  {Object.entries(pages).map(([page, val]) => (
                    <div key={page} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '8px 10px', background: 'var(--bg-card)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{page}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1, marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {val?.tokens ? `${Object.keys(val.tokens).length} tokens` : ''}
                        {val?.css ? ' · CSS' : ''}
                        {val?.visibility ? ' · visibility' : ''}
                        {val?.type === 'custom_page' ? ` · ${val.title}` : ''}
                      </span>
                      <button type="button" disabled={busy} onClick={() => handleResetPage(page)} style={{ fontSize: 11, border: '1px solid var(--border-color)', borderRadius: 999, padding: '4px 8px', background: 'var(--bg-card)', cursor: 'pointer' }}>
                        Reset
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" disabled={busy} onClick={handleResetGlobal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-color)', borderRadius: 999, padding: '8px 14px', background: 'var(--bg-card)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                <RotateCcw size={12} /> {busy ? 'Resetting…' : 'Reset all to default'}
              </button>
            </div>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Version history" subtitle={`Last ${history.length} versions — click Restore to undo`}>
        {history.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No history yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 6, maxHeight: 280, overflow: 'auto', paddingRight: 4 }}>
            {[...history].reverse().map((h) => (
              <div key={h.version} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '8px 10px', background: h.version === version ? 'var(--bg-tertiary)' : 'var(--bg-card)' }}>
                <span style={{ fontSize: 12 }}>
                  <strong>v{h.version}</strong> · {h.cause || 'update'} ·{' '}
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{h.at ? new Date(h.at).toLocaleString() : ''}</span>
                </span>
                <button type="button" disabled={busy || h.version === version} onClick={() => handleRestore(h.version)} style={{ fontSize: 11, border: '1px solid var(--border-color)', borderRadius: 999, padding: '4px 8px', background: 'var(--bg-card)', cursor: h.version === version ? 'default' : 'pointer', opacity: h.version === version ? 0.5 : 1 }}>
                  <History size={10} style={{ display: 'inline', marginRight: 4 }} />Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </SettingsSection>
  )
}
