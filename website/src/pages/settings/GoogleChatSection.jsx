import { useEffect, useState } from 'react'
import { Check, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { ConfirmDialog, SettingsCard } from '../../components/ui'
import {
  beginGoogleChatOAuth,
  disconnectGoogleChatAccount,
  getGoogleChatAccounts,
} from '../../lib/googleChatApi'

export function GoogleChatSection({ user }) {
  const [googleChatAccounts, setGoogleChatAccounts] = useState([])
  const [googleChatBusy, setGoogleChatBusy] = useState(false)
  const [googleChatMessage, setGoogleChatMessage] = useState('')
  const [disconnectAllRequested, setDisconnectAllRequested] = useState(false)
  const [removeRequested, setRemoveRequested] = useState(null)

  const fetchGoogleChatAccounts = () => {
    getGoogleChatAccounts()
      .then(({ accounts }) => {
        setGoogleChatAccounts(accounts || [])
      })
      .catch(() => setGoogleChatAccounts([]))
  }

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const chatResult = searchParams.get('chat')
    const reason = searchParams.get('reason')
    if (chatResult) {
      setGoogleChatMessage(
        chatResult === 'connected'
          ? 'Google Chat account connected successfully.'
          : `Google Chat connection failed: ${reason || 'OAuth authorization failed'}`,
      )
      window.history.replaceState({}, '', window.location.pathname)
    }
    fetchGoogleChatAccounts()
  }, [user?.uid])

  const addGoogleChatAccount = async () => {
    setGoogleChatBusy(true)
    setGoogleChatMessage('')
    try {
      await beginGoogleChatOAuth()
      fetchGoogleChatAccounts()
    } catch (error) {
      setGoogleChatMessage(error.message || 'Google Chat account could not be connected.')
    } finally {
      setGoogleChatBusy(false)
    }
  }

  const removeGoogleChatAccount = async (account) => {
    setGoogleChatBusy(true)
    setGoogleChatMessage('')
    try {
      if (account.id) {
        await disconnectGoogleChatAccount(account.id)
      }
      fetchGoogleChatAccounts()
      setGoogleChatMessage(`Disconnected Google Chat for ${account.email}.`)
    } catch (error) {
      setGoogleChatMessage(error.message || 'Could not disconnect account.')
    } finally {
      setGoogleChatBusy(false)
    }
  }

  const disconnectAllGoogleChatAccounts = async () => {
    setGoogleChatBusy(true)
    setGoogleChatMessage('')
    try {
      await Promise.all(
        googleChatAccounts
          .filter((acc) => acc.id)
          .map((acc) => disconnectGoogleChatAccount(acc.id)),
      )
      setGoogleChatAccounts([])
      setGoogleChatMessage('All Google Chat accounts disconnected.')
    } catch (error) {
      setGoogleChatMessage(error.message || 'Could not disconnect accounts.')
    } finally {
      setGoogleChatBusy(false)
    }
  }

  return (
    <>
      <SettingsCard
        className="google-chat-settings-card"
        icon={<MessageSquare size={19} />}
        title="Google Chat"
        description="Connect and manage multiple Google Chat accounts"
        action={
          <button
            className={googleChatAccounts.length > 0 ? 'workspace-connected' : ''}
            onClick={googleChatAccounts.length > 0 ? () => setDisconnectAllRequested(true) : addGoogleChatAccount}
            disabled={googleChatBusy}
          >
            {googleChatAccounts.length > 0 && <Check size={15} />}
            {googleChatBusy
              ? googleChatAccounts.length > 0 ? 'Disconnecting…' : 'Connecting…'
              : googleChatAccounts.length > 0
                ? 'Disconnect'
                : 'Add Google Chat account'}
          </button>
        }
      >
        <div className="google-calendar-settings-body">
          {googleChatAccounts.length ? (
            <>
              <div className="google-calendar-account-list">
                {googleChatAccounts.map((acc) => (
                  <div className="google-calendar-account" key={acc.id || acc.email}>
                    <span className="google-calendar-avatar">
                      <MessageSquare size={16} />
                    </span>
                    <div>
                      <strong>{acc.display_name || acc.email}</strong>
                      <small>{acc.email} · Google Chat connected</small>
                    </div>
                    <button
                      className="google-calendar-remove"
                      onClick={() => setRemoveRequested(acc)}
                      aria-label={`Disconnect ${acc.email}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="google-calendar-add-account" onClick={addGoogleChatAccount} disabled={googleChatBusy}>
                <Plus size={14} />
                Add another account
              </button>
            </>
          ) : (
            <p className="google-calendar-empty">
              Connect one or more Google Chat accounts to view spaces, direct messages, and chat across accounts.
            </p>
          )}
          {googleChatMessage && <strong role="status">{googleChatMessage}</strong>}
        </div>
      </SettingsCard>

      <ConfirmDialog
        isOpen={disconnectAllRequested}
        title="Disconnect integration?"
        message="Disconnect all Google Chat accounts from StarWaves? You can reconnect them later."
        confirmLabel="Disconnect"
        onCancel={() => setDisconnectAllRequested(false)}
        onConfirm={() => {
          setDisconnectAllRequested(false)
          disconnectAllGoogleChatAccounts()
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
          if (account) removeGoogleChatAccount(account)
        }}
      />
    </>
  )
}
