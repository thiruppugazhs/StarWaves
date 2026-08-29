import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  MessageSquare,
  Send,
  Users,
  User,
  Settings,
  CheckCheck,
  ChevronDown,
  Globe,
  Lock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import {
  beginGoogleChatOAuth,
  getGoogleChatSpaces,
  sendGoogleChatMessage,
} from '../lib/googleChatApi'
import { FilterPills, LoadingState, PageHeader, SearchBar } from '../components/ui'

export function ChatsPage({ onNavigate: _onNavigate }) {
  const [accounts, setAccounts] = useState([])
  const [spaces, setSpaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAccountEmail, setSelectedAccountEmail] = useState('all')
  const [activeSpaceId, setActiveSpaceId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [connectingChat, setConnectingChat] = useState(false)

  const fetchSpaces = useCallback((accountEmail) => {
    setLoading(true)
    setError(null)
    const email = accountEmail === 'all' ? undefined : accountEmail
    getGoogleChatSpaces(email)
      .then(({ accounts: fetchedAccounts, spaces: fetchedSpaces }) => {
        setAccounts(fetchedAccounts || [])
        setSpaces(fetchedSpaces || [])
        setLoading(false)
        if (!activeSpaceId && fetchedSpaces?.length) {
          setActiveSpaceId(fetchedSpaces[0].id)
        }
      })
      .catch((err) => {
        setError(err.message || 'Could not load Google Chat data.')
        setLoading(false)
      })
  }, [activeSpaceId])

  useEffect(() => {
    fetchSpaces(selectedAccountEmail)
  }, [selectedAccountEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSpaces = useMemo(() => {
    return spaces.filter((space) => {
      const matchSearch =
        space.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        space.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      const matchType =
        filterType === 'all' ||
        (filterType === 'spaces' && space.type === 'space') ||
        (filterType === 'dms' && space.type === 'dm')
      return matchSearch && matchType
    })
  }, [spaces, searchQuery, filterType])

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId) || null,
    [spaces, activeSpaceId],
  )

  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!messageInput.trim() || !activeSpace || sending) return

    setSending(true)
    setSendError('')
    const text = messageInput.trim()
    setMessageInput('')

    // Optimistic UI update
    const optimisticMsg = {
      id: `pending-${Date.now()}`,
      sender: 'You',
      senderEmail: activeSpace.accountEmail,
      avatar: 'ME',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: text,
      isSelf: true,
    }
    setSpaces((prev) =>
      prev.map((s) =>
        s.id === activeSpace.id
          ? { ...s, lastMessage: text, messages: [...(s.messages || []), optimisticMsg] }
          : s,
      ),
    )

    try {
      await sendGoogleChatMessage(activeSpace.id, text, activeSpace.accountEmail)
    } catch (err) {
      setSendError(err.message || 'Message could not be sent.')
      // Roll back optimistic message on error
      setSpaces((prev) =>
        prev.map((s) =>
          s.id === activeSpace.id
            ? {
                ...s,
                messages: (s.messages || []).filter((m) => m.id !== optimisticMsg.id),
              }
            : s,
        ),
      )
    } finally {
      setSending(false)
    }
  }

  const handleConnectGoogleChat = async () => {
    if (connectingChat) return
    setConnectingChat(true)
    setError(null)
    try {
      await beginGoogleChatOAuth()
      await fetchSpaces(selectedAccountEmail)
    } catch (err) {
      setError(err.message || 'Could not connect Google Chat.')
    } finally {
      setConnectingChat(false)
    }
  }

  const handleQuickReply = (text) => setMessageInput(text)

  return (
    <section className="chats-page">
      <PageHeader
        eyebrow="Communication"
        title="Chats"
        actions={
          <>
            {accounts.length > 0 ? (
              <div className="account-badge-pill">
                <span className="dot active"></span>
                {accounts.length} Google {accounts.length === 1 ? 'Account' : 'Accounts'} Connected
              </div>
            ) : !loading ? (
              <button
                className="secondary-button icon-button-text"
                onClick={handleConnectGoogleChat}
                disabled={connectingChat}
              >
                <Settings size={16} className={connectingChat ? 'spin' : ''} />
                <span>{connectingChat ? 'Connecting…' : 'Connect Google Chat'}</span>
              </button>
            ) : null}
            <button
              className="icon-button"
              onClick={() => fetchSpaces(selectedAccountEmail)}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </>
        }
      />

      {/* No accounts connected empty state */}
      {!loading && accounts.length === 0 && (
        <div className="no-active-chat" style={{ height: '60vh' }}>
          <MessageSquare size={48} />
          <h3>No Google Chat Accounts Connected</h3>
          <p>
            Connect a Google Chat account to view your spaces and direct messages
            here. No need to go to Settings.
          </p>
          <button
            className="primary-button"
            style={{ marginTop: '12px', padding: '10px 20px' }}
            onClick={handleConnectGoogleChat}
            disabled={connectingChat}
          >
            <Settings size={15} className={connectingChat ? 'spin' : ''} /> {connectingChat ? 'Connecting…' : 'Connect Google Chat'}
          </button>
        </div>
      )}

      {/* Error state */}
      {error && accounts.length === 0 && (
        <div className="no-active-chat" style={{ height: '40vh' }}>
          <AlertCircle size={40} />
          <h3>Could Not Load Chats</h3>
          <p>{error}</p>
          <button
            className="secondary-button"
            style={{ marginTop: '12px' }}
            onClick={() => fetchSpaces(selectedAccountEmail)}
          >
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      )}

      {/* Main chat UI - only render when we have accounts or are loading */}
      {(loading || accounts.length > 0) && (
        <div className="chats-container">
          {/* Sidebar */}
          <aside className="chats-sidebar">
            {/* Account Selector */}
            <div className="account-selector-box">
              <label className="input-label" htmlFor="account-filter-select">
                Google Account
              </label>
              <div className="select-wrapper">
                <select
                  id="account-filter-select"
                  className="select-input"
                  value={selectedAccountEmail}
                  onChange={(e) => {
                    setSelectedAccountEmail(e.target.value)
                    setActiveSpaceId(null)
                  }}
                >
                  <option value="all">All Accounts ({accounts.length})</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.email}>
                      {acc.email}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-icon" />
              </div>
            </div>

            {/* Search */}
            <SearchBar
              className="chats-search-bar"
              placeholder="Search spaces or messages…"
              ariaLabel="Search spaces or messages"
              value={searchQuery}
              onChange={setSearchQuery}
            />

            {/* Filter chips */}
            <FilterPills
              className="chats-filter-chips"
              ariaLabel="Filter chat spaces"
              items={[
                { id: 'all', label: 'All' },
                { id: 'spaces', label: 'Spaces' },
                { id: 'dms', label: 'DMs' },
              ]}
              activeId={filterType}
              onChange={setFilterType}
            />

            {/* Space list */}
            <div className="chats-list">
              {loading ? (
                <LoadingState message="Loading spaces…" />
              ) : filteredSpaces.length === 0 ? (
                <div className="empty-chats">
                  {spaces.length === 0
                    ? 'No spaces found. Try refreshing or connect an account.'
                    : 'No conversations match your search.'}
                </div>
              ) : (
                filteredSpaces.map((space) => (
                  <button
                    key={space.id}
                    className={`chat-item ${space.id === activeSpaceId ? 'active' : ''}`}
                    onClick={() => setActiveSpaceId(space.id)}
                  >
                    <div className="chat-item-avatar">
                      {space.type === 'space' ? (
                        <Users size={18} />
                      ) : (
                        <User size={18} />
                      )}
                    </div>
                    <div className="chat-item-content">
                      <div className="chat-item-header">
                        <span className="chat-item-title">{space.name}</span>
                        <span className="chat-item-time">{space.lastTime}</span>
                      </div>
                      <div className="chat-item-footer">
                        <span className="chat-item-snippet">{space.lastMessage}</span>
                        {space.unreadCount > 0 && (
                          <span className="unread-badge">{space.unreadCount}</span>
                        )}
                      </div>
                      <div className="chat-item-account-tag">{space.accountEmail}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Main thread */}
          <main className="chats-main">
            {activeSpace ? (
              <>
                {/* Conversation header */}
                <div className="chat-header">
                  <div className="chat-header-info">
                    <div className="chat-header-avatar">
                      {activeSpace.type === 'space' ? (
                        <Users size={20} />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    <div>
                      <h2 className="chat-header-title">
                        {activeSpace.name}
                        {activeSpace.isPrivate ? (
                          <Lock size={14} className="meta-icon" />
                        ) : (
                          <Globe size={14} className="meta-icon" />
                        )}
                      </h2>
                      <p className="chat-header-sub">
                        {activeSpace.type === 'space'
                          ? `${activeSpace.membersCount} members`
                          : 'Direct Message'}{' '}
                        · {activeSpace.accountEmail}
                      </p>
                    </div>
                  </div>
                  <div className="chat-header-actions">
                    <button
                      className="icon-button"
                      title="Connect additional Google Chat account"
                      onClick={handleConnectGoogleChat}
                      disabled={connectingChat}
                    >
                      <Settings size={18} className={connectingChat ? 'spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="chat-messages-container">
                  {(activeSpace.messages || []).length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '40px 20px', fontSize: '14px' }}>
                      No messages yet. Say something!
                    </div>
                  ) : (
                    (activeSpace.messages || []).map((msg) => (
                      <div
                        key={msg.id}
                        className={`chat-message-row ${msg.isSelf ? 'self' : 'other'}`}
                      >
                        {!msg.isSelf && (
                          <div className="message-avatar" title={msg.senderEmail}>
                            {msg.avatar}
                          </div>
                        )}
                        <div className="message-bubble-wrapper">
                          {!msg.isSelf && (
                            <div className="message-sender-name">
                              {msg.sender}{' '}
                              <span className="message-time">{msg.time}</span>
                            </div>
                          )}
                          <div className="message-bubble">{msg.content}</div>
                          {msg.isSelf && (
                            <div className="message-self-meta">
                              <span className="message-time">{msg.time}</span>
                              <CheckCheck size={14} className="read-icon" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick replies */}
                <div className="quick-reply-bar">
                  <span className="quick-reply-label">Quick replies:</span>
                  {[
                    'Acknowledged, thanks!',
                    'I will review this right away.',
                    'Let us schedule a quick sync.',
                  ].map((t) => (
                    <button
                      key={t}
                      className="quick-chip"
                      onClick={() => handleQuickReply(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {sendError && (
                  <p
                    role="alert"
                    style={{
                      color: '#ffffff',
                      fontSize: '12px',
                      padding: '6px 24px',
                      background: '#27272a',
                    }}
                  >
                    {sendError}
                  </p>
                )}

                {/* Composer */}
                <form className="chat-composer" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    placeholder={`Message ${activeSpace.name}…`}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="composer-input"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    className="primary-button composer-send-button"
                    disabled={!messageInput.trim() || sending}
                  >
                    <Send size={16} />
                    <span>{sending ? 'Sending…' : 'Send'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="no-active-chat">
                <MessageSquare size={48} />
                <h3>Select a Conversation</h3>
                <p>
                  Choose a Google Chat space or direct message from the sidebar.
                </p>
              </div>
            )}
          </main>
        </div>
      )}
    </section>
  )
}
