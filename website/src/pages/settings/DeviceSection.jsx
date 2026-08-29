import { useState } from 'react'
import { Laptop, LogOut, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { ConfirmDialog, SectionHeading } from '../../components/ui'
import { useDevices } from '../../hooks/useDevices'

function formatRelative(iso) {
  if (!iso) return 'Unknown'
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    if (diff < 60_000) return 'Just now'
    if (diff < 3600_000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  } catch { return iso }
}

export function DeviceSection() {
  const { sessions, currentJti, loading, error, rename, revoke, revokeOthers } = useDevices()
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [confirmRevokeId, setConfirmRevokeId] = useState(null)
  const [confirmRevokeOthers, setConfirmRevokeOthers] = useState(false)
  const [busy, setBusy] = useState(false)

  const startEdit = (s) => {
    setEditingId(s.id)
    setEditName(s.device_name)
    setActionMsg('')
  }

  const submitRename = async (s) => {
    const name = editName.trim()
    if (!name) { setActionMsg('Name cannot be empty.'); return }
    if (name.includes('<') || name.includes('>')) { setActionMsg('Invalid name.'); return }
    setBusy(true)
    try {
      await rename(s.id, name)
      setEditingId(null)
      setActionMsg('Device renamed.')
    } catch (e) { setActionMsg(e.message || 'Rename failed.') }
    finally { setBusy(false) }
  }

  const doRevoke = async () => {
    if (!confirmRevokeId) return
    setBusy(true)
    try {
      await revoke(confirmRevokeId)
      setActionMsg('Device revoked.')
    } catch (e) { setActionMsg(e.message || 'Revoke failed.') }
    finally { setBusy(false); setConfirmRevokeId(null) }
  }

  const doRevokeOthers = async () => {
    setBusy(true)
    try {
      const res = await revokeOthers()
      setActionMsg(`Revoked ${res.revoked_count ?? 0} other device(s).`)
    } catch (e) { setActionMsg(e.message || 'Failed.') }
    finally { setBusy(false); setConfirmRevokeOthers(false) }
  }

  return (
    <div className="setting-section" id="settings-devices">
      <SectionHeading
        title="Devices & sessions"
        description="Manage trusted devices. Each login creates a session valid for 30 days. Revoke lost devices."
      />

      <div className="device-section-card">
        <div className="device-section-header">
          <div className="device-section-header-info">
            <ShieldCheck size={18} />
            <span>{sessions.length} active device(s)</span>
          </div>
          {sessions.length > 1 && (
            <button type="button" className="device-revoke-others-btn" onClick={() => setConfirmRevokeOthers(true)} disabled={busy}>
              <LogOut size={14} /> Revoke other devices
            </button>
          )}
        </div>

        {loading && <p className="device-loading">Loading devices…</p>}
        {error && <p className="device-error" role="alert">{error}</p>}
        {actionMsg && <p className="device-action-msg" role="status">{actionMsg}</p>}

        <ul className="device-list">
          {sessions.map((s) => {
            const isCurrent = currentJti && s.token_jti === currentJti
            return (
              <li key={s.id} className={`device-row ${isCurrent ? 'device-row-current' : ''} ${s.revoked ? 'device-row-revoked' : ''}`}>
                <div className="device-row-icon">
                  <Laptop size={16} />
                </div>
                <div className="device-row-main">
                  {editingId === s.id ? (
                    <div className="device-edit-row">
                      <input value={editName} onChange={(e)=>setEditName(e.target.value)} maxLength={255} placeholder="Device name" />
                      <button type="button" onClick={()=>submitRename(s)} disabled={busy}>Save</button>
                      <button type="button" onClick={()=>setEditingId(null)} disabled={busy}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div className="device-name-row">
                        <strong>{s.device_name}</strong>
                        {isCurrent && <span className="device-badge-current">This device</span>}
                        {s.revoked && <span className="device-badge-revoked">Revoked</span>}
                        {s.is_expired && !s.revoked && <span className="device-badge-expired">Expired</span>}
                      </div>
                      <div className="device-meta">
                        <span title={s.user_agent || ''}>{s.ip_address || 'Unknown IP'}</span>
                        <span>·</span>
                        <span>Last seen {formatRelative(s.last_seen_at)}</span>
                        <span>·</span>
                        <span>Created {formatRelative(s.created_at)}</span>
                      </div>
                    </>
                  )}
                </div>
                {editingId !== s.id && !s.revoked && (
                  <div className="device-row-actions">
                    <button type="button" className="device-action-btn" onClick={()=>startEdit(s)} disabled={busy} aria-label="Rename device">
                      <Pencil size={14} />
                    </button>
                    {!isCurrent && (
                      <button type="button" className="device-action-btn device-action-danger" onClick={()=>setConfirmRevokeId(s.id)} disabled={busy} aria-label="Revoke device">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {!loading && sessions.length === 0 && <p className="device-empty">No devices found.</p>}
      </div>

      <ConfirmDialog
        isOpen={!!confirmRevokeId}
        onClose={()=>setConfirmRevokeId(null)}
        onConfirm={doRevoke}
        title="Revoke device?"
        message="This will sign out that device. It will need to sign in again."
        confirmText="Revoke"
        cancelText="Cancel"
      />
      <ConfirmDialog
        isOpen={confirmRevokeOthers}
        onClose={()=>setConfirmRevokeOthers(false)}
        onConfirm={doRevokeOthers}
        title="Revoke other devices?"
        message="All other sessions will be signed out. This device stays signed in."
        confirmText="Revoke others"
        cancelText="Cancel"
      />
    </div>
  )
}
