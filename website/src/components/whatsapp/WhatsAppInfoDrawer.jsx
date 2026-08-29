import { useState, useMemo } from 'react'
import { X, Bot, Image as ImageIcon, FileText, Sparkles, Star, Users, User, ShieldCheck, Download } from 'lucide-react'

export function WhatsAppInfoDrawer({
  chat,
  messages = [],
  onClose,
  onToggleEveAutoReply,
  onSummarizeChat,
}) {
  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'media', 'docs', 'starred'
  const [selectedLightbox, setSelectedLightbox] = useState(null)

  // Extract real media files from messages
  const photosAndVideos = useMemo(() => {
    return (messages || []).filter(
      (m) =>
        m.media &&
        (m.media.thumbnail_base64 ||
          ['image', 'video', 'gif'].includes(m.media.type) ||
          (m.media.url && (m.media.url.startsWith('data:') || m.media.url.startsWith('blob:') || m.media.url.startsWith('/')))),
    )
  }, [messages])

  const documentFiles = useMemo(() => {
    return (messages || []).filter((m) => m.media && m.media.type === 'document')
  }, [messages])

  const starredMessages = useMemo(() => {
    return (messages || []).filter((m) => m.is_starred)
  }, [messages])

  if (!chat) return null

  const isEve = chat.is_eve || chat.id === 'eve'

  return (
    <div className="whatsapp-info-drawer">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
          {chat.is_group ? 'Group Info' : 'Contact Info'}
        </h3>
        <button
          type="button"
          className="whatsapp-icon-btn"
          onClick={onClose}
          title="Close details"
        >
          <X size={16} />
        </button>
      </div>

      {/* Profile Card */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px' }}>
        <div className={`whatsapp-avatar ${isEve ? 'is-eve' : chat.is_group ? 'is-group' : ''}`} style={{ width: 72, height: 72, fontSize: '1.75rem' }}>
          {isEve ? (
            <Bot size={36} />
          ) : chat.avatar_url ? (
            <img
              src={chat.avatar_url}
              alt={chat.name}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : chat.is_group ? (
            <Users size={32} />
          ) : (
            <User size={32} />
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{chat.name || 'Conversation'}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: 2 }}>
            {chat.phone_number || (isEve ? 'Eve Assistant • AI Workspace Agent' : chat.is_group ? `${chat.participants?.length || 0} participants` : 'WhatsApp Contact')}
          </div>
        </div>
      </div>

      {/* Description / About */}
      {chat.description && (
        <div className="whatsapp-drawer-section">
          <h4>About / Description</h4>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.45, background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {chat.description}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '4px' }}>
        <button
          type="button"
          className={`filter-pill ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
        >
          Overview
        </button>
        <button
          type="button"
          className={`filter-pill ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => setActiveTab('media')}
          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
        >
          Media ({photosAndVideos.length})
        </button>
        <button
          type="button"
          className={`filter-pill ${activeTab === 'docs' ? 'active' : ''}`}
          onClick={() => setActiveTab('docs')}
          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
        >
          Docs ({documentFiles.length})
        </button>
        <button
          type="button"
          className={`filter-pill ${activeTab === 'starred' ? 'active' : ''}`}
          onClick={() => setActiveTab('starred')}
          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
        >
          Starred ({starredMessages.length})
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <>
          {!isEve && (
            <div className="whatsapp-drawer-section">
              <h4>Eve AI Assistant</h4>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--bg-primary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={16} />
                  <span style={{ fontSize: '0.875rem' }}>Auto-Responder</span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(chat.eve_auto_reply)}
                  onChange={(e) => onToggleEveAutoReply?.(chat.id, e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => onSummarizeChat?.(chat.id)}
                style={{ width: '100%', minHeight: '36px', marginTop: '6px' }}
              >
                <Sparkles size={14} />
                Generate Summary & Action Items
              </button>
            </div>
          )}

          {/* Group Participants List */}
          {chat.is_group && Array.isArray(chat.participants) && chat.participants.length > 0 && (
            <div className="whatsapp-drawer-section">
              <h4>{chat.participants.length} Participants</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '240px', overflowY: 'auto' }}>
                {chat.participants
                  .map((p) => {
                    if (!p) return null
                    const raw = String(p).trim()
                    const cleanP = raw.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '').trim()
                    const isPhone = /^\+?\d{6,}$/.test(cleanP)
                    if (isPhone) return null
                    return { raw: p, displayName: cleanP || raw }
                  })
                  .filter(Boolean)
                  .map(({ raw, displayName }, idx) => (
                    <div
                      key={raw || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div className="whatsapp-avatar" style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                        <User size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayName}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Privacy & Security */}
          <div className="whatsapp-drawer-section">
            <h4>Security & Encryption</h4>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: 'var(--bg-primary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
              }}
            >
              <ShieldCheck size={18} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
              <span>Messages and calls are end-to-end encrypted with WhatsMeow gateway.</span>
            </div>
          </div>
        </>
      )}

      {/* Tab: Media */}
      {activeTab === 'media' && (
        <div className="whatsapp-drawer-section">
          <h4>Shared Media ({photosAndVideos.length})</h4>
          {photosAndVideos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
              <ImageIcon size={24} style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.5 }} />
              No photos or videos shared yet
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
              {photosAndVideos.map((m) => {
                const src = m.media.url || m.media.thumbnail_base64
                return (
                  <div
                    key={m.id}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      background: '#000',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                    }}
                    onClick={() => setSelectedLightbox(m.media)}
                  >
                    <img
                      src={src}
                      alt={m.media.filename || 'media'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Documents */}
      {activeTab === 'docs' && (
        <div className="whatsapp-drawer-section">
          <h4>Shared Documents ({documentFiles.length})</h4>
          {documentFiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
              <FileText size={24} style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.5 }} />
              No documents shared yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
              {documentFiles.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'var(--bg-primary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <FileText size={16} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.media.filename || 'Document'}
                    </span>
                  </div>
                  {m.media.url && (
                    <a
                      href={m.media.url}
                      download={m.media.filename || 'document'}
                      target="_blank"
                      rel="noreferrer"
                      className="whatsapp-icon-btn small"
                    >
                      <Download size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Starred */}
      {activeTab === 'starred' && (
        <div className="whatsapp-drawer-section">
          <h4>Starred Messages ({starredMessages.length})</h4>
          {starredMessages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
              <Star size={24} style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.5 }} />
              No starred messages in this chat
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
              {starredMessages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: '8px 10px',
                    background: 'var(--bg-primary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 4 }}>
                    <span>{m.is_from_me ? 'You' : m.sender_name || 'Contact'}</span>
                    <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drawer Media Lightbox */}
      {selectedLightbox && (
        <div className="whatsapp-lightbox-backdrop" onClick={() => setSelectedLightbox(null)}>
          <div className="whatsapp-lightbox-container" onClick={(e) => e.stopPropagation()}>
            <div className="whatsapp-lightbox-header">
              <span className="whatsapp-lightbox-sender">{selectedLightbox.filename || 'Shared Media'}</span>
              <button
                type="button"
                className="whatsapp-icon-btn small"
                onClick={() => setSelectedLightbox(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="whatsapp-lightbox-body">
              <img
                src={selectedLightbox.url || selectedLightbox.thumbnail_base64}
                alt="Shared media preview"
                className="whatsapp-lightbox-media"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
