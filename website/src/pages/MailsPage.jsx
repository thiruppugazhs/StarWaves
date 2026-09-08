import '../styles/pages/mail-shell.css'
import { useCallback, useEffect, useState } from 'react'
import { MailPlus, RefreshCw, X } from 'lucide-react'
import {
  beginGmailOAuth, hasGmailConnection, loadGoogleMail, loadGoogleMessage,
  sendGoogleMessage, updateGoogleMessage,
} from '../lib/googleMail'
import { getGmailAccounts, getGmailStatus } from '../lib/gmailApi'
import { ConfirmDialog, LoadingState, Pagination, SearchBar, TabNav } from '../components/ui'
import { usePersistentState } from '../hooks/usePersistentState'
import { EMPTY_COMPOSE, INBOX_TABS, buildReplyDraft } from './mail/mailUtils'
import { MailComposer } from './mail/MailComposer'
import { MailConnect } from './mail/MailConnect'
import { MailFolders } from './mail/MailFolders'
import { MailList } from './mail/MailList'
import { MailReader } from './mail/MailReader'

export function MailsPage({ onNavigate }) {
  const [messages, setMessages] = useState([])
  const [account, setAccount] = useState('')
  const [accounts, setAccounts] = useState([])
  const [selectedAccountEmail, setSelectedAccountEmail] = useState('')
  const [query, setQuery] = useState('')
  const [folder, setFolder] = usePersistentState('starwaves.mail.folder', 'INBOX')
  const [inboxTab, setInboxTab] = usePersistentState('starwaves.mail.inbox-tab', 'primary')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(null)
  const [selected, setSelected] = useState(null)
  const [reading, setReading] = useState(false)
  const [compose, setCompose] = useState(null)
  const [discardRequested, setDiscardRequested] = useState(false)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [pageToken, setPageToken] = useState('')
  const [previousPageTokens, setPreviousPageTokens] = useState([])
  const [nextPageToken, setNextPageToken] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [connectingGmail, setConnectingGmail] = useState(false)

  const refresh = useCallback(async (search = query, nextFolder = folder, token = '', keepPage = false, targetAccount = selectedAccountEmail) => {
    setLoading(true)
    setError('')
    try {
      const category = nextFolder === 'INBOX' ? inboxTab : ''
      const result = await loadGoogleMail(search, nextFolder, token, targetAccount || null, category)
      setMessages(result.messages)
      setAccount(result.email)
      setNextPageToken(result.nextPageToken)
      setPageToken(token)
      if (!keepPage) setPreviousPageTokens([])
      setConnected(true)
    } catch (refreshError) {
      setError(refreshError.message)
      setConnected(hasGmailConnection())
    } finally {
      setLoading(false)
    }
  }, [folder, query, selectedAccountEmail, inboxTab])

  const openOlderMessages = () => {
    if (!nextPageToken || loading) return
    setPreviousPageTokens((tokens) => [...tokens, pageToken])
    refresh(query, folder, nextPageToken, true, selectedAccountEmail)
  }

  const openNewerMessages = () => {
    if (!previousPageTokens.length || loading) return
    const tokens = [...previousPageTokens]
    const previousToken = tokens.pop()
    setPreviousPageTokens(tokens)
    refresh(query, folder, previousToken, true, selectedAccountEmail)
  }

  useEffect(() => {
    if (connected) refresh('', folder, '', false, selectedAccountEmail)
  }, [connected, folder, inboxTab, selectedAccountEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true
    getGmailAccounts()
      .then(({ accounts: fetchedAccounts }) => {
        if (!active) return
        if (fetchedAccounts && fetchedAccounts.length) {
          setAccounts(fetchedAccounts)
          setConnected(true)
          if (!selectedAccountEmail) {
            setSelectedAccountEmail(fetchedAccounts[0].email)
          }
        } else {
          setConnected(false)
        }
      })
      .catch(() => {
        getGmailStatus()
          .then(({ connected: savedConnection, account: singleAcc }) => {
            if (!active) return
            setConnected(savedConnection)
            if (singleAcc?.email) {
              setAccounts([singleAcc])
            }
          })
          .catch((statusError) => {
            if (active) {
              setConnected(false)
              setError(statusError.message)
            }
          })
      })
    return () => {
      active = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openMessage = async (message) => {
    setReading(true)
    setError('')
    try {
      const full = await loadGoogleMessage(message.id, selectedAccountEmail)
      setSelected(full)
      if (message.unread) {
        setMessages((items) => items.map((item) => item.id === message.id ? { ...item, unread: false } : item))
        await updateGoogleMessage(message.id, { remove: ['UNREAD'] }, selectedAccountEmail)
      }
    } catch (readError) {
      setError(readError.message)
    } finally {
      setReading(false)
    }
  }

  const toggleStar = async (message, event) => {
    event.stopPropagation()
    const nextStarred = !message.starred
    setMessages((items) => items.map((item) => item.id === message.id ? { ...item, starred: nextStarred } : item))
    if (selected?.id === message.id) setSelected((current) => current ? { ...current, starred: nextStarred } : null)
    try {
      await updateGoogleMessage(
        message.id,
        nextStarred ? { add: ['STARRED'] } : { remove: ['STARRED'] },
        selectedAccountEmail,
      )
    } catch (starError) {
      setError(starError.message)
    }
  }

  const archiveMessage = async (message) => {
    setMessages((items) => items.filter((item) => item.id !== message.id))
    if (selected?.id === message.id) setSelected(null)
    try {
      await updateGoogleMessage(message.id, { remove: ['INBOX'] }, selectedAccountEmail)
      setNotice('Message archived.')
    } catch (archiveError) {
      setError(archiveError.message)
    }
  }

  const deleteMessage = async (message) => {
    setMessages((items) => items.filter((item) => item.id !== message.id))
    if (selected?.id === message.id) setSelected(null)
    try {
      await updateGoogleMessage(message.id, { add: ['TRASH'] }, selectedAccountEmail)
      setNotice('Message moved to Trash.')
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      await sendGoogleMessage(compose, selectedAccountEmail)
      setCompose(null)
      setNotice('Message sent successfully.')
      if (folder === 'SENT') refresh(query, 'SENT', '', false, selectedAccountEmail)
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  const requestCloseCompose = () => {
    const hasDraftContent = compose && Object.values(compose).some(
      (value) => typeof value === 'string' && value.trim(),
    )
    if (hasDraftContent) {
      setDiscardRequested(true)
      return
    }
    setCompose(null)
  }

  const handleConnectGmail = async () => {
    setConnectingGmail(true)
    try {
      await beginGmailOAuth()
      const { accounts: fetchedAccounts } = await getGmailAccounts()
      if (fetchedAccounts && fetchedAccounts.length) {
        setAccounts(fetchedAccounts)
        setSelectedAccountEmail(fetchedAccounts[0].email)
        setConnected(true)
      } else {
        setConnected(true)
      }
      refresh('', 'INBOX', '', false, null)
    } catch (err) {
      setError(err.message)
    } finally {
      setConnectingGmail(false)
    }
  }

  const handleReplyMessage = (message) => {
    setCompose({ ...EMPTY_COMPOSE, ...buildReplyDraft(message) })
  }

  const handleSelectFolder = (id) => {
    setFolder(id)
    setSelected(null)
    setQuery('')
  }

  const handleSelectAccount = (email) => {
    if (email) {
      setSelectedAccountEmail(email)
    } else {
      setSelectedAccountEmail('')
    }
    setAccountMenuOpen(false)
    setSelected(null)
    refresh(query, folder, '', false, email)
  }

  if (connected === null) {
    return (
      <div className="mail-page-loading-wrap">
        <LoadingState message="Checking mail integration…" />
      </div>
    )
  }

  if (!connected) {
    return (
      <MailConnect
        error={error}
        connectingGmail={connectingGmail}
        onConnect={handleConnectGmail}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <div className="mail-page">
      {notice && (
        <div className="mail-toast">
          {notice}
          <button onClick={() => setNotice('')} aria-label="Close notice"><X size={14} /></button>
        </div>
      )}

      <MailFolders
        folder={folder}
        onSelectFolder={handleSelectFolder}
        accounts={accounts}
        account={account}
        selectedAccountEmail={selectedAccountEmail}
        onSelectAccount={handleSelectAccount}
        accountMenuOpen={accountMenuOpen}
        onToggleAccountMenu={() => setAccountMenuOpen((open) => !open)}
        onAddAccount={handleConnectGmail}
        onCompose={() => setCompose({ ...EMPTY_COMPOSE })}
        unreadCount={messages.filter((message) => message.unread).length}
      />

      <div className="page-inline-actions mail-page-heading">
        <div className="mail-toolbar">
          <form onSubmit={(event) => { event.preventDefault(); refresh(query, folder, '', false, selectedAccountEmail) }}>
            <SearchBar
              value={query}
              onChange={setQuery}
              onClear={() => {
                setQuery('')
                refresh('', folder, '', false, selectedAccountEmail)
              }}
              placeholder="Search mail"
              ariaLabel="Search mail"
              iconSize={17}
            />
          </form>
          <button onClick={() => refresh(query, folder, pageToken, true, selectedAccountEmail)} disabled={loading} aria-label="Refresh inbox">
            <RefreshCw size={17} className={loading ? 'mail-spin' : ''} />
          </button>
        </div>
        <button className="primary-button" onClick={() => setCompose({ ...EMPTY_COMPOSE })}>
          <MailPlus size={16} /> Compose
        </button>
      </div>

      {folder === 'INBOX' && (
        <TabNav
          tabs={INBOX_TABS}
          activeTab={inboxTab}
          onChange={setInboxTab}
          className="mail-inbox-tabs"
          ariaLabel="Inbox categories"
        />
      )}

      <div className="mail-layout">
        <MailList
          error={error}
          loading={loading}
          messages={messages}
          onRetry={() => refresh(query, folder, pageToken, true, selectedAccountEmail)}
          onToggleStar={toggleStar}
          onOpenMessage={openMessage}
        />

        <Pagination
          className="mail-pagination"
          ariaLabel="Mail pages"
          onPrev={openNewerMessages}
          onNext={openOlderMessages}
          hasPrev={Boolean(previousPageTokens.length && !loading)}
          hasNext={Boolean(nextPageToken && !loading)}
          disabled={loading}
        >
          <input
            className="mail-page-indicator"
            type="number"
            min="1"
            value={previousPageTokens.length + 1}
            readOnly
            aria-label="Current mail page"
          />
        </Pagination>
      </div>

      {selected && (
        <MailReader
          message={selected}
          reading={reading}
          onClose={() => setSelected(null)}
          onReply={handleReplyMessage}
          onArchive={archiveMessage}
          onDelete={deleteMessage}
        />
      )}

      {compose && (
        <MailComposer
          compose={compose}
          setCompose={setCompose}
          sending={sending}
          onSend={sendMessage}
          onRequestClose={requestCloseCompose}
        />
      )}
      <ConfirmDialog
        isOpen={discardRequested}
        title="Discard draft?"
        message="Your unsent message will be permanently discarded."
        confirmLabel="Discard draft"
        onCancel={() => setDiscardRequested(false)}
        onConfirm={() => {
          setDiscardRequested(false)
          setCompose(null)
        }}
      />
    </div>
  )
}
