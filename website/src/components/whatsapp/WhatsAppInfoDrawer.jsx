import '../../styles/pages/whatsapp-drawer.css'
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
      <div className="whatsapp-drawer-header">
        <h3 className="whatsapp-drawer-title">
          {chat.is_group ? 'Group Info' : 'Contact Info'}
        </h3>
        <button
          type="button"
          className="whatsapp-icon-btn"
          onClick={onClose}
          title="Close details"
          aria-label="Close details"
        >
          <X size={16} />
        </button>
      </div>

      {/* Profile Card */}
      <div className="whatsapp-drawer-profile">
        <div className={`whatsapp-avatar whatsapp-avatar--lg ${isEve ? 'is-eve' : chat.is_group ? 'is-group' : ''}`}>
          {isEve ? (
            <Bot size={36} />
          ) : chat.avatar_url ? (
            <img
              src={chat.avatar_url}
              alt={chat.name}
              className="whatsapp-avatar-img whatsapp-avatar-img--cover"
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
        <div className="whatsapp-drawer-profile-meta">
          <div className="whatsapp-drawer-name">{chat.name || 'Conversation'}</div>
          <div className="whatsapp-drawer-subtitle">
            {chat.phone_number || (isEve ? 'Eve Assistant • AI Workspace Agent' : chat.is_group ? `${chat.participants?.length || 0} participants` : 'WhatsApp Contact')}
          </div>
        </div>
      </div>

      {/* Description / About */}
      {chat.description && (
        <div className="whatsapp-drawer-section">
          <h4>About / Description</h4>
          <div className="whatsapp-drawer-description">
            {chat.description}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="whatsapp-drawer-tabs">
        <button
          type="button"
          className={`filter-pill whatsapp-drawer-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`filter-pill whatsapp-drawer-tab ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => setActiveTab('media')}
        >
          Media ({photosAndVideos.length})
        </button>
        <button
          type="button"
          className={`filter-pill whatsapp-drawer-tab ${activeTab === 'docs' ? 'active' : ''}`}
          onClick={() => setActiveTab('docs')}
        >
          Docs ({documentFiles.length})
        </button>
        <button
          type="button"
          className={`filter-pill whatsapp-drawer-tab ${activeTab === 'starred' ? 'active' : ''}`}
          onClick={() => setActiveTab('starred')}
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
              <div className="whatsapp-drawer-card">
                <div className="whatsapp-drawer-card-row">
                  <Bot size={16} />
                  <span className="whatsapp-drawer-card-label">Auto-Responder</span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(chat.eve_auto_reply)}
                  onChange={(e) => onToggleEveAutoReply?.(chat.id, e.target.checked)}
                  className="whatsapp-drawer-checkbox"
                  aria-label="Toggle Eve auto-responder"
                />
              </div>

              <button
                type="button"
                className="secondary-button whatsapp-drawer-full-btn"
                onClick={() => onSummarizeChat?.(chat.id)}
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
              <div className="whatsapp-drawer-scroll-list">
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
                      className="whatsapp-drawer-participant"
                    >
                      <div className="whatsapp-avatar whatsapp-avatar--sm">
                        <User size={14} />
                      </div>
                      <div className="whatsapp-drawer-participant-meta">
                        <div className="whatsapp-drawer-participant-name">
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
            <div className="whatsapp-drawer-security">
              <ShieldCheck size={18} className="whatsapp-drawer-security-icon" />
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
            <div className="whatsapp-drawer-empty">
              <ImageIcon size={24} className="whatsapp-drawer-empty-icon" />
              No photos or videos shared yet
            </div>
          ) : (
            <div className="whatsapp-drawer-media-grid">
              {photosAndVideos.map((m) => {
                const src = m.media.url || m.media.thumbnail_base64
                return (
                  <div
                    key={m.id}
                    className="whatsapp-drawer-media-item"
                    onClick={() => setSelectedLightbox(m.media)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedLightbox(m.media) } }}
                    aria-label={`Open ${m.media.filename || 'media'}`}
                  >
                    <img
                      src={src}
                      alt={m.media.filename || 'media'}
                      className="whatsapp-drawer-media-img"
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
            <div className="whatsapp-drawer-empty">
              <FileText size={24} className="whatsapp-drawer-empty-icon" />
              No documents shared yet
            </div>
          ) : (
            <div className="whatsapp-drawer-scroll-list">
              {documentFiles.map((m) => (
                <div
                  key={m.id}
                  className="whatsapp-drawer-doc"
                >
                  <div className="whatsapp-drawer-doc-main">
                    <FileText size={16} />
                    <span className="whatsapp-drawer-doc-name">
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
                      aria-label={`Download ${m.media.filename || 'document'}`}
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
            <div className="whatsapp-drawer-empty">
              <Star size={24} className="whatsapp-drawer-empty-icon" />
              No starred messages in this chat
            </div>
          ) : (
            <div className="whatsapp-drawer-scroll-list">
              {starredMessages.map((m) => (
                <div
                  key={m.id}
                  className="whatsapp-drawer-starred"
                >
                  <div className="whatsapp-drawer-starred-meta">
                    <span>{m.is_from_me ? 'You' : m.sender_name || 'Contact'}</span>
                    <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="whatsapp-drawer-starred-content">
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
