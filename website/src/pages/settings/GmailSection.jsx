import { useEffect, useState } from 'react'
import { Check, Mail, Plus, Trash2 } from 'lucide-react'
import { ConfirmDialog, SettingsCard } from '../../components/ui'
import { clearGmailAuthorization } from '../../lib/firebase'
import {
  disconnectGmail,
  disconnectGmailAccount,
  getGmailAccounts,
  getGmailStatus,
} from '../../lib/gmailApi'
import { beginGmailOAuth } from '../../lib/googleMail'

export function GmailSection({ user }) {
  const [gmailAccounts, setGmailAccounts] = useState([])
  const [gmailBusy, setGmailBusy] = useState(false)
  const [gmailMessage, setGmailMessage] = useState('')
  const [disconnectAllRequested, setDisconnectAllRequested] = useState(false)
  const [removeRequested, setRemoveRequested] = useState(null)

  const fetchGmailAccounts = () => {
    getGmailAccounts()
      .then(({ accounts }) => {
        setGmailAccounts(accounts || [])
      })
      .catch(() => {
        getGmailStatus()
          .then(({ connected, account }) => {
            if (connected && account) {
              setGmailAccounts([account])
            } else {
              setGmailAccounts([])
            }
          })
          .catch(() => setGmailAccounts([]))
      })
  }

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const gmailResult = searchParams.get('gmail')
    const reason = searchParams.get('reason')
    if (gmailResult) {
      setGmailMessage(
        gmailResult === 'connected'
          ? 'Gmail account connected successfully.'
          : `Gmail connection failed: ${reason || 'OAuth authorization failed'}`,
      )
      window.history.replaceState({}, '', window.location.pathname)
    }
    fetchGmailAccounts()
  }, [user?.uid])

  const addGmailAccount = async () => {
    setGmailBusy(true)
    setGmailMessage('')
    try {
      await beginGmailOAuth()
      fetchGmailAccounts()
    } catch (error) {
      setGmailMessage(error.message || 'Gmail account could not be connected.')
    } finally {
      setGmailBusy(false)
    }
  }

  const removeGmailAccount = async (account) => {
    setGmailBusy(true)
    setGmailMessage('')
    try {
      if (account.id) {
        await disconnectGmailAccount(account.id)
      } else {
        await disconnectGmail()
      }
      clearGmailAuthorization(account.email)
      fetchGmailAccounts()
      setGmailMessage(`Disconnected ${account.email}.`)
    } catch (error) {
      setGmailMessage(error.message || 'Could not disconnect account.')
    } finally {
      setGmailBusy(false)
    }
  }

  const disconnectAllGmailAccounts = async () => {
    setGmailBusy(true)
    setGmailMessage('')
    try {
      await Promise.all(
        gmailAccounts.map((acc) =>
          acc.id ? disconnectGmailAccount(acc.id) : disconnectGmail(),
        ),
      )
      gmailAccounts.forEach((acc) => clearGmailAuthorization(acc.email))
      setGmailAccounts([])
      setGmailMessage('All Gmail accounts disconnected.')
    } catch (error) {
      setGmailMessage(error.message || 'Could not disconnect accounts.')
    } finally {
      setGmailBusy(false)
    }
  }

  return (
    <>
      <SettingsCard
        className="gmail-settings-card"
        icon={<Mail size={19} />}
        title="Google Mail"
        description="Connect and switch between multiple Gmail accounts"
        action={
          <button
            className={gmailAccounts.length > 0 ? 'workspace-connected' : ''}
            onClick={gmailAccounts.length > 0 ? () => setDisconnectAllRequested(true) : addGmailAccount}
            disabled={gmailBusy}
          >
            {gmailAccounts.length > 0 && <Check size={15} />}
            {gmailBusy
              ? gmailAccounts.length > 0 ? 'Disconnecting…' : 'Connecting…'
              : gmailAccounts.length > 0
                ? 'Disconnect'
                : 'Add Gmail account'}
          </button>
        }
      >
        <div className="google-calendar-settings-body">
          {gmailAccounts.length ? (
            <>
              <div className="google-calendar-account-list">
                {gmailAccounts.map((acc) => (
                  <div className="google-calendar-account" key={acc.id || acc.email}>
                    <span className="google-calendar-avatar">
                      <Mail size={16} />
                    </span>
                    <div>
                      <strong>{acc.email}</strong>
                      <small>Gmail connected</small>
                    </div>
                    <button
                      className="google-calendar-remove"
                      onClick={() => setRemoveRequested(acc)}
                      aria-label={`Remove ${acc.email}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="google-calendar-add-btn"
                onClick={addGmailAccount}
                disabled={gmailBusy}
              >
                <Plus size={14} /> Add another Gmail account
              </button>
            </>
          ) : (
            <p className="google-calendar-empty">
              No Gmail accounts connected yet. Link your Google account to read, compose, and search emails.
            </p>
          )}
          {gmailMessage && <strong role="status">{gmailMessage}</strong>}
        </div>
      </SettingsCard>

      <ConfirmDialog
        isOpen={disconnectAllRequested}
        title="Disconnect integration?"
        message="Disconnect all Gmail accounts from StarWaves? You can reconnect them later."
        confirmLabel="Disconnect"
        onCancel={() => setDisconnectAllRequested(false)}
        onConfirm={() => {
          setDisconnectAllRequested(false)
          disconnectAllGmailAccounts()
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(removeRequested)}
        title="Disconnect integration?"
        message={removeRequested?.email
          ? `Disconnect ${removeRequested.email} from StarWaves? You can reconnect it later.`
          : 'Disconnect this integration from StarWaves? You can reconnect it later.'}
        confirmLabel="Disconnect"
        onCancel={() => setRemoveRequested(null)}
        onConfirm={() => {
          const account = removeRequested
          setRemoveRequested(null)
          if (account) removeGmailAccount(account)
        }}
      />
    </>
  )
}
