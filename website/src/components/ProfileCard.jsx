import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, Link2, LogOut, Mail, ShieldCheck, Trash2, User, X } from 'lucide-react'
import {
  clearAuthSession,
  fetchCombinedAccounts,
  requestAccountCombine,
  unlinkCombinedAccount,
  updateUserProfile,
} from '../lib/authApi'
import { sendVerificationEmail } from '../lib/emailApi'

export function ProfileCard({ user, onProfileUpdated, onSignOut }) {
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(user?.fullName || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut()
    } else {
      clearAuthSession()
    }
  }

  // Combined accounts & email service states
  const [combinedData, setCombinedData] = useState({ combined_accounts: [], pending_combine_requests: [] })
  const [combineEmail, setCombineEmail] = useState('')
  const [loadingCombine, setLoadingCombine] = useState(false)
  const [combineMsg, setCombineMsg] = useState('')
  const [combineError, setCombineError] = useState('')

  // Mail service actions
  const [mailMsg, setMailMsg] = useState('')
  const [mailError, setMailError] = useState('')
  const [loadingMail, setLoadingMail] = useState(false)

  const isVerified = Boolean(
    user?.emailVerified ||
    user?.email_verified ||
    user?.roleLabel === 'Google account' ||
    user?.providerData?.some((p) => p.providerId === 'google.com'),
  )

  const handleSendVerification = async () => {
    setLoadingMail(true)
    setMailMsg('')
    setMailError('')
    try {
      const res = await sendVerificationEmail()
      setMailMsg(res.message || 'Verification link sent to your email.')
    } catch (err) {
      setMailError(err.message || 'Failed to send verification email.')
    } finally {
      setLoadingMail(false)
    }
  }

  const loadCombinedAccounts = async () => {
    try {
      const res = await fetchCombinedAccounts()
      if (res) {
        setCombinedData({
          combined_accounts: res.combined_accounts || [],
          pending_combine_requests: res.pending_combine_requests || [],
        })
      }
    } catch (err) {
      // Non-blocking if unauthenticated
      console.debug('Could not load combined accounts:', err)
    }
  }

  useEffect(() => {
    loadCombinedAccounts()
  }, [])

  useEffect(() => {
    if (!editing) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setEditing(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editing])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('Name cannot be empty.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateUserProfile(displayName.trim())
      onProfileUpdated?.(displayName.trim())
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleRequestCombine = async (e) => {
    e.preventDefault()
    if (!combineEmail.trim()) return
    setLoadingCombine(true)
    setCombineMsg('')
    setCombineError('')
    try {
      const res = await requestAccountCombine(combineEmail.trim())
      setCombineMsg(res.message || 'Combine request sent successfully.')
      setCombineEmail('')
      loadCombinedAccounts()
    } catch (err) {
      setCombineError(err.message || 'Failed to send account combine request.')
    } finally {
      setLoadingCombine(false)
    }
  }

  const handleUnlink = async (targetEmail) => {
    try {
      await unlinkCombinedAccount(targetEmail)
      loadCombinedAccounts()
    } catch (err) {
      setCombineError(err.message || 'Failed to unlink account.')
    }
  }

  return (
    <>
      <article className="profile-card">
        <div className="profile-card-header">
          <div className="profile-card-avatar">{user.initials}</div>
          <div>
            <h3>{user.fullName}</h3>
            <p>{user.role}</p>
          </div>
          <div className="profile-card-actions">
            <button
              type="button"
              className="profile-edit-button"
              onClick={() => {
                setDisplayName(user.fullName)
                setEditing(true)
              }}
            >
              Edit profile
            </button>
            <button
              type="button"
              className="profile-signout-button"
              onClick={handleSignOut}
              title="Sign out of account"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>

        <div className="profile-details">
          <div className="profile-detail">
            <Mail size={17} />
            <div>
              <strong>{user.email}</strong>
              <span>Email</span>
            </div>
          </div>
          <div className="profile-detail">
            <ShieldCheck size={17} />
            <div>
              <strong>{user.roleLabel}</strong>
              <span>Role</span>
            </div>
          </div>
        </div>

        {/* Email & Notification Services */}
        <div className="combined-accounts-section">
          <div className="combined-accounts-header">
            <div className="combined-title">
              <Mail size={16} />
              <span>Email &amp; Notification Services</span>
            </div>
            <span className="combined-smtp-tag">{isVerified ? 'Verified' : 'Mail Ready'}</span>
          </div>
          <p className="combined-description">
            {isVerified
              ? 'Your email address is verified and active for workspace notifications.'
              : 'Verify your email address to secure your account and enable workspace notifications.'}
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
            {isVerified ? (
              <button
                type="button"
                disabled
                className="secondary-button"
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  cursor: 'default',
                  opacity: 0.85,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={13} />
                Verified
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendVerification}
                disabled={loadingMail}
                className="secondary-button"
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                Verify Email
              </button>
            )}
          </div>

          {mailMsg && <p className="combine-feedback success" style={{ marginTop: '10px' }} role="status">{mailMsg}</p>}
          {mailError && <p className="combine-feedback error" style={{ marginTop: '10px' }} role="alert">{mailError}</p>}
        </div>

        {/* Combined Accounts & SMTP Access Sharing */}
        <div className="combined-accounts-section">
          <div className="combined-accounts-header">
            <div className="combined-title">
              <Link2 size={16} />
              <span>Combined Accounts & Shared Access</span>
            </div>
            <span className="combined-smtp-tag">Mail Verification</span>
          </div>

          <p className="combined-description">
            Invite another email address to combine accounts. After verifying via email, multiple accounts can access shared workspace data.
          </p>

          <form onSubmit={handleRequestCombine} className="combine-account-form">
            <div className="combine-input-group">
              <Mail size={16} />
              <input
                type="email"
                value={combineEmail}
                onChange={(e) => setCombineEmail(e.target.value)}
                placeholder="Enter email to combine accounts"
                required
              />
            </div>
            <button type="submit" disabled={loadingCombine} className="primary-button combine-submit-btn">
              {loadingCombine ? 'Sending…' : 'Send Mail Invite'}
            </button>
          </form>

          {combineMsg && <p className="combine-feedback success" role="status">{combineMsg}</p>}
          {combineError && <p className="combine-feedback error" role="alert">{combineError}</p>}

          {combinedData.combined_accounts.length > 0 && (
            <div className="combined-list">
              <h4>Linked Accounts</h4>
              {combinedData.combined_accounts.map((acc, index) => (
                <div key={acc.uid || acc.email || index} className="combined-item">
                  <div className="combined-item-info">
                    <CheckCircle2 size={15} />
                    <div>
                      <strong>{acc.email}</strong>
                      {acc.linked_at && <small>Linked: {acc.linked_at}</small>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="unlink-account-btn"
                    onClick={() => handleUnlink(acc.uid || acc.email)}
                    title="Unlink account"
                  >
                    <Trash2 size={14} /> Unlink
                  </button>
                </div>
              ))}
            </div>
          )}

          {combinedData.pending_combine_requests.length > 0 && (
            <div className="combined-list pending">
              <h4>Pending Email Verifications</h4>
              {combinedData.pending_combine_requests.map((req, index) => (
                <div key={req.email || index} className="combined-item pending">
                  <div className="combined-item-info">
                    <Clock size={15} />
                    <div>
                      <strong>{req.email}</strong>
                      <small>Verification email sent</small>
                    </div>
                  </div>
                  <span className="pending-badge">Verification Sent</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(false)}>
          <div className="modal profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title" onClick={(e) => e.stopPropagation()}>
            <div className="profile-edit-header">
              <h2 id="profile-edit-title">Edit Profile</h2>
              <button type="button" className="icon-button" onClick={() => setEditing(false)} aria-label="Close profile editor">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <label className="profile-edit-field">
                Display Name
                <div className="profile-edit-input">
                  <User size={16} aria-hidden="true" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter full name"
                    required
                  />
                </div>
              </label>
              {error && <p className="form-field-error" role="alert">{error}</p>}
              <div className="profile-edit-actions">
                <button type="button" onClick={() => setEditing(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="primary-button">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
