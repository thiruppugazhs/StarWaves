import { useMemo, useState, useRef, useEffect } from 'react'
import { Bot, Pin, User, Users, QrCode, Archive, BellOff, CheckCheck, Trash2 } from 'lucide-react'
import { SearchBar } from '../ui'

function formatSenderName(name) {
  if (!name) return ''
  const str = String(name).trim()
  if (str === '1289' || str === 'Contact' || str.includes('@s.whatsapp.net') || str.includes('@g.us') || str.includes('@lid')) return ''
  const clean = str.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '').trim()
  // Numeric JID/phone without a display name — hide per requirement (show name if exists, else show nothing)
  if (/^\+?\d{6,}$/.test(clean)) {
    return ''
  }
  return clean
}

function getSenderInitial(name) {
  if (!name) return '?'
  const clean = String(name).trim().replace(/^[@+~]/, '')
  return (clean[0] || '?').toUpperCase()
}

export function WhatsAppChatList({
  chats = [],
  selectedChatId = null,
  onSelectChat,
  onOpenQrModal,
  onTogglePinChat,
  onToggleMuteChat,
  onToggleArchiveChat,
  onDeleteChat,
  onMarkChatRead,
  isConnected = false,
  searchQuery = '',
  onSearchChange,
}) {
  const [activeFilter, setActiveFilter] = useState('all') // 'all', 'unread', 'favourites', 'groups', 'archived'
  const [contextMenuChat, setContextMenuChat] = useState(null)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const menuRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenuChat(null)
      }
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // Counts for pills
  const unreadTotal = useMemo(() => {
    return (chats || []).filter((c) => c && !c.is_archived).reduce((acc, c) => acc + (c.unread_count || 0), 0)
  }, [chats])

  const archivedCount = useMemo(() => {
    return (chats || []).filter((c) => c && c.is_archived).length
  }, [chats])

  const filteredChats = useMemo(() => {
    const list = [...(chats || [])].filter((chat) => {
      if (!chat) return false
      // Archive handling
      if (activeFilter === 'archived') {
        if (!chat.is_archived) return false
      } else {
        if (chat.is_archived) return false
      }

      // Pill filtering
      if (activeFilter === 'unread' && (!chat.unread_count || chat.unread_count <= 0)) {
        return false
      }
      if (activeFilter === 'favourites' && !chat.pinned && !chat.is_starred) {
        return false
      }
      if (activeFilter === 'groups' && !chat.is_group) {
        return false
      }

      // Search query filtering
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      const name = String(chat.name || '').toLowerCase()
      const phone = String(chat.phone_number || '').toLowerCase()
      const desc = String(chat.description || '').toLowerCase()
      const lastMsg = String(chat.last_message?.content || '').toLowerCase()
      const hasPart = Array.isArray(chat.participants) && chat.participants.some((p) => String(p || '').toLowerCase().includes(q))
      return name.includes(q) || phone.includes(q) || desc.includes(q) || lastMsg.includes(q) || hasPart
    })

    // Sort: Pinned first, then chats with real messages by last_message.timestamp descending, then other contacts
    return list.sort((a, b) => {
      const aPinned = a?.pinned || a?.id === 'eve' ? 1 : 0
      const bPinned = b?.pinned || b?.id === 'eve' ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned

      const aHasMsg = Boolean(a?.last_message?.content)
      const bHasMsg = Boolean(b?.last_message?.content)
      if (aHasMsg !== bHasMsg) return bHasMsg ? 1 : -1

      const aTime = a?.last_message?.timestamp ? new Date(a.last_message.timestamp).getTime() : 0
      const bTime = b?.last_message?.timestamp ? new Date(b.last_message.timestamp).getTime() : 0
      if (aTime !== bTime) return bTime - aTime

      return String(a?.name || '').localeCompare(String(b?.name || ''))
    })
  }, [chats, searchQuery, activeFilter])

  const formatChatTime = (isoString) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
    } catch {
      return ''
    }
  }

  const handleContextMenu = (e, chat) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuPos({ x: e.clientX, y: Math.min(e.clientY, window.innerHeight - 200) })
    setContextMenuChat(chat)
  }

  return (
    <div className="whatsapp-sidebar">
      {/* Sidebar Header */}
      <div className="whatsapp-sidebar-header">
        <div style={{ width: 36 }} />

        <h2 className="whatsapp-sidebar-centered-title">Chats</h2>

        <div className="whatsapp-sidebar-actions">
          <button
            type="button"
            className="whatsapp-icon-btn"
            onClick={onOpenQrModal}
            title={isConnected ? 'Device settings & QR' : 'Link WhatsApp'}
          >
            <QrCode size={18} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="whatsapp-search-wrapper">
        <SearchBar
          placeholder="Search or start a new chat"
          ariaLabel="Search WhatsApp chats"
          value={searchQuery}
          onChange={onSearchChange}
        />
      </div>

      {/* Filter Tabs / Pills (All, Unread, Favourites, Groups, Archived) */}
      <div className="whatsapp-filter-pills">
        <button
          type="button"
          className={`whatsapp-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`whatsapp-filter-pill ${activeFilter === 'unread' ? 'active' : ''}`}
          onClick={() => setActiveFilter('unread')}
        >
          Unread {unreadTotal > 0 && <span className="whatsapp-pill-count">{unreadTotal}</span>}
        </button>
        <button
          type="button"
          className={`whatsapp-filter-pill ${activeFilter === 'favourites' ? 'active' : ''}`}
          onClick={() => setActiveFilter('favourites')}
        >
          Favourites
        </button>
        <button
          type="button"
          className={`whatsapp-filter-pill ${activeFilter === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveFilter('groups')}
        >
          Groups
        </button>
        {archivedCount > 0 && (
          <button
            type="button"
            className={`whatsapp-filter-pill ${activeFilter === 'archived' ? 'active' : ''}`}
            onClick={() => setActiveFilter('archived')}
          >
            <Archive size={12} style={{ display: 'inline', marginRight: 3 }} />
            Archived
          </button>
        )}
      </div>

      {/* Chat List */}
      <div className="whatsapp-chat-list">
        {filteredChats.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {searchQuery
              ? 'No matching conversations'
              : activeFilter !== 'all'
              ? `No ${activeFilter} chats`
              : 'No chats yet'}
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = selectedChatId === chat.id
            const isEve = chat.is_eve || chat.id === 'eve'

            return (
              <button
                key={chat.id}
                type="button"
                className={`whatsapp-chat-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectChat(chat.id)}
                onContextMenu={(e) => handleContextMenu(e, chat)}
              >
                <div className={`whatsapp-avatar ${isEve ? 'is-eve' : chat.is_group ? 'is-group' : ''}`}>
                  {isEve ? (
                    <Bot size={22} />
                  ) : chat.avatar_url ? (
                    <img
                      src={chat.avatar_url}
                      alt={chat.name}
                      className="whatsapp-avatar-img"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        if (e.currentTarget.nextSibling) {
                          e.currentTarget.nextSibling.style.display = 'flex'
                        }
                      }}
                    />
                  ) : null}
                  {!isEve && (
                    <div
                      className="whatsapp-avatar-fallback"
                      style={chat.avatar_url ? { display: 'none' } : {}}
                    >
                      {chat.name && chat.name !== 'Contact' && chat.name !== chat.id && !/^\+?\d{6,}$/.test(String(chat.name).replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '').trim()) ? (
                        <span className="whatsapp-avatar-initial">{getSenderInitial(chat.name)}</span>
                      ) : chat.is_group ? (
                        <Users size={20} />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                  )}
                </div>

                <div className="whatsapp-chat-info">
                  <div className="whatsapp-chat-top">
                    <span className="whatsapp-chat-name" title={chat.name}>
                      {chat.pinned && <Pin size={12} style={{ display: 'inline', marginRight: 4 }} />}
                      {chat.is_muted && <BellOff size={12} style={{ display: 'inline', marginRight: 4, opacity: 0.6 }} />}
                      {(() => {
                        const cleanName = String(chat.name || '').replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '').trim()
                        const isNumericName = /^\+?\d{6,}$/.test(cleanName)
                        if (chat.is_group && (!chat.name || chat.name === 'Contact' || chat.name === chat.id || isNumericName)) {
                          return 'Group conversation'
                        }
                        if (!chat.name || chat.name === 'Contact' || isNumericName) return ''
                        return chat.name
                      })()}
                    </span>
                    <span className="whatsapp-chat-time">
                      {formatChatTime(chat.last_message?.timestamp || chat.updated_at)}
                    </span>
                  </div>

                  <div className="whatsapp-chat-bottom">
                    <p className="whatsapp-chat-preview">
                      {chat.last_message ? (
                        <>
                          {chat.last_message.is_from_me ? (
                            <span style={{ fontWeight: 600 }}>You: </span>
                          ) : chat.is_group && formatSenderName(chat.last_message.sender_name) ? (
                            <span style={{ fontWeight: 600 }}>{formatSenderName(chat.last_message.sender_name)}: </span>
                          ) : null}
                          {chat.last_message.content || (chat.last_message.media ? `[${chat.last_message.media.type}]` : '')}
                        </>
                      ) : (
                        isEve ? 'Ask Eve anything or manage workspace...' : 'No messages yet'
                      )}
                    </p>

                    {chat.unread_count > 0 && (
                      <span className="whatsapp-unread-badge">{chat.unread_count}</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Right Click Context Menu on Chat Item */}
      {contextMenuChat && (
        <div
          ref={menuRef}
          className="whatsapp-context-menu"
          style={{
            position: 'fixed',
            top: contextMenuPos.y,
            left: contextMenuPos.x,
            right: 'auto',
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="whatsapp-context-item"
            onClick={() => {
              onTogglePinChat?.(contextMenuChat.id, !contextMenuChat.pinned)
              setContextMenuChat(null)
            }}
          >
            <Pin size={15} />
            <span>{contextMenuChat.pinned ? 'Unpin chat' : 'Pin chat'}</span>
          </button>

          <button
            type="button"
            className="whatsapp-context-item"
            onClick={() => {
              onToggleMuteChat?.(contextMenuChat.id, !contextMenuChat.is_muted)
              setContextMenuChat(null)
            }}
          >
            <BellOff size={15} />
            <span>{contextMenuChat.is_muted ? 'Unmute notifications' : 'Mute notifications'}</span>
          </button>

          <button
            type="button"
            className="whatsapp-context-item"
            onClick={() => {
              onToggleArchiveChat?.(contextMenuChat.id, !contextMenuChat.is_archived)
              setContextMenuChat(null)
            }}
          >
            <Archive size={15} />
            <span>{contextMenuChat.is_archived ? 'Unarchive chat' : 'Archive chat'}</span>
          </button>

          <button
            type="button"
            className="whatsapp-context-item"
            onClick={() => {
              onMarkChatRead?.(contextMenuChat.id)
              setContextMenuChat(null)
            }}
          >
            <CheckCheck size={15} />
            <span>Mark as read</span>
          </button>

          <button
            type="button"
            className="whatsapp-context-item danger"
            onClick={() => {
              if (window.confirm(`Delete conversation with ${contextMenuChat.name}?`)) {
                onDeleteChat?.(contextMenuChat.id)
              }
              setContextMenuChat(null)
            }}
          >
            <Trash2 size={15} />
            <span>Delete chat</span>
          </button>
        </div>
      )}
    </div>
  )
}
