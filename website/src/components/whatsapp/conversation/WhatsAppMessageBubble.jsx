/** Message bubble — single responsibility: render one WhatsApp message. */
import {
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  CornerUpLeft,
  Download,
  ExternalLink,
  FileText,
  Pause,
  Pin,
  Play,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Info,
} from 'lucide-react'
import { Markdown } from '../../ui/Markdown'
import { extractFirstUrl, formatMessageContent, formatMessageTime, formatReactions, formatSenderName, getSenderInitial } from './utils'

export function WhatsAppMessageBubble({
  msg,
  chat,
  isOutgoing,
  isMsgEve,
  isHovered,
  isMenuOpen,
  menuPlacement,
  menuRef,
  quotedMsg,
  playingAudioId,
  onToggleAudio,
  onSetActiveMenuMessageId,
  onSetMenuPlacement,
  onSetReplyingTo,
  onCopyMessage,
  onAskEveAboutMessage,
  onSetInfoModalMessage,
  onSetActiveLightboxMedia,
  onSetReactionModalData,
  onSetSelectedReactionTab,
  onReactToMessage,
  onStarMessage,
  onDeleteMessage,
  setActiveMenuMessageId,
  resolveReactionSender,
  onDownloadMedia,
  onForwardMessage,
  onPinToggle,
  setHoveredMessageId,
}) {
  return (
    <div className={`whatsapp-message-row ${isOutgoing ? 'outgoing' : 'incoming'}`}>
      {!isOutgoing && chat?.is_group && (
        <div className="whatsapp-sender-avatar" title={formatSenderName(msg.sender_name, msg.sender_id) || 'Sender'}>
          {msg.sender_avatar_url ? (
            <img
              src={msg.sender_avatar_url}
              alt={formatSenderName(msg.sender_name, msg.sender_id) || 'Sender'}
              className="whatsapp-sender-avatar-img"
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
          <div className="whatsapp-sender-avatar-fallback" style={msg.sender_avatar_url ? { display: 'none' } : {}}>
            {(() => {
              const n = formatSenderName(msg.sender_name, msg.sender_id)
              return n ? getSenderInitial(n) : '?'
            })()}
          </div>
        </div>
      )}
      <div
        id={`whatsapp-msg-${msg.id}`}
        className={`whatsapp-message-wrapper ${isOutgoing ? 'outgoing' : 'incoming'} ${isMsgEve ? 'is-eve' : ''}`}
        onMouseEnter={() => setHoveredMessageId(msg.id)}
        onMouseLeave={() => setHoveredMessageId((curr) => (curr === msg.id ? null : curr))}
      >
        <div className="whatsapp-message-bubble-container">
          {(isHovered || isMenuOpen) && (
            <div className="whatsapp-bubble-menu-container">
              <button
                type="button"
                className="whatsapp-bubble-menu-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  if (isMenuOpen) {
                    setActiveMenuMessageId(null)
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const spaceBelow = window.innerHeight - rect.bottom
                    onSetMenuPlacement(spaceBelow < 260 ? 'top' : 'bottom')
                    onSetActiveMenuMessageId(msg.id)
                  }
                }}
                title="Message menu"
              >
                <ChevronDown size={14} />
              </button>
              {isMenuOpen && (
                <div className={`whatsapp-context-menu placement-${menuPlacement}`} ref={menuRef}>
                  <button type="button" className="whatsapp-context-item" onClick={() => { onSetInfoModalMessage(msg); setActiveMenuMessageId(null) }}>
                    <Info size={15} />
                    <span>Message info</span>
                  </button>
                  <button type="button" className="whatsapp-context-item" onClick={() => { onSetReplyingTo(msg); setActiveMenuMessageId(null) }}>
                    <CornerUpLeft size={15} />
                    <span>Reply</span>
                  </button>
                  <button type="button" className="whatsapp-context-item" onClick={() => onCopyMessage(msg.content)}>
                    <Copy size={15} />
                    <span>Copy</span>
                  </button>
                  <div className="whatsapp-context-react-row">
                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="whatsapp-context-react-btn"
                        onClick={() => {
                          onReactToMessage?.(chat.id, msg.id, emoji)
                          setActiveMenuMessageId(null)
                        }}
                        title={`React ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="whatsapp-context-item" onClick={() => onForwardMessage(msg)}>
                    <Share2 size={15} />
                    <span>Forward</span>
                  </button>
                  <button type="button" className="whatsapp-context-item" onClick={() => onPinToggle(msg)}>
                    <Pin size={15} />
                    <span>{msg.is_pinned ? 'Unpin' : 'Pin'}</span>
                  </button>
                  <button type="button" className="whatsapp-context-item eve-action" onClick={() => onAskEveAboutMessage(msg)}>
                    <Sparkles size={15} />
                    <span>Ask Eve AI</span>
                  </button>
                  <button
                    type="button"
                    className="whatsapp-context-item"
                    onClick={() => {
                      onStarMessage?.(chat.id, msg.id, !msg.is_starred)
                      setActiveMenuMessageId(null)
                    }}
                  >
                    <Star size={15} fill={msg.is_starred ? 'currentColor' : 'none'} />
                    <span>{msg.is_starred ? 'Unstar' : 'Star'}</span>
                  </button>
                  <button
                    type="button"
                    className="whatsapp-context-item danger"
                    onClick={() => {
                      onDeleteMessage?.(chat.id, msg.id)
                      setActiveMenuMessageId(null)
                    }}
                  >
                    <Trash2 size={15} />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div
            className="whatsapp-message-bubble"
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const spaceBelow = window.innerHeight - e.clientY
              onSetMenuPlacement(spaceBelow < 260 ? 'top' : 'bottom')
              onSetActiveMenuMessageId(msg.id)
            }}
          >
            {(() => {
              const senderDisplay = formatSenderName(msg.sender_name, msg.sender_id)
              return !isOutgoing && chat?.is_group && senderDisplay ? (
                <div className="whatsapp-sender-name">{senderDisplay}</div>
              ) : null
            })()}
            {(msg.is_forwarded || msg.isForwarded) && (
              <div className="whatsapp-forwarded-tag">
                <CornerUpLeft size={13} style={{ transform: 'scaleX(-1)' }} />
                <span>Forwarded</span>
              </div>
            )}
            {quotedMsg && (
              <div
                className="whatsapp-quoted-preview"
                onClick={(e) => {
                  e.stopPropagation()
                  const el = document.getElementById(`whatsapp-msg-${quotedMsg.id}`)
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el.classList.add('whatsapp-message-highlight')
                    setTimeout(() => el.classList.remove('whatsapp-message-highlight'), 1600)
                  }
                }}
                style={{ cursor: 'pointer' }}
                title="Click to jump to quoted message"
              >
                <div className="whatsapp-quoted-body">
                  {(() => {
                    const qName = quotedMsg.is_from_me ? 'You' : formatSenderName(quotedMsg.sender_name, quotedMsg.sender_id)
                    return qName ? <span className="whatsapp-quoted-sender">{qName}</span> : null
                  })()}
                  <p className="whatsapp-quoted-text">
                    {quotedMsg.media && !quotedMsg.content ? (
                      <span className="whatsapp-quoted-media-tag">
                        {quotedMsg.media.type === 'video'
                          ? '🎥 Video'
                          : quotedMsg.media.type === 'audio'
                            ? '🎵 Audio'
                            : quotedMsg.media.type === 'document'
                              ? `📄 ${quotedMsg.media.filename || 'Document'}`
                              : '📷 Photo'}
                      </span>
                    ) : quotedMsg.media && quotedMsg.content ? (
                      <span>
                        <span className="whatsapp-quoted-media-tag">
                          {quotedMsg.media.type === 'video'
                            ? '🎥 '
                            : quotedMsg.media.type === 'audio'
                              ? '🎵 '
                              : quotedMsg.media.type === 'document'
                                ? '📄 '
                                : '📷 '}
                        </span>
                        {quotedMsg.content}
                      </span>
                    ) : (
                      quotedMsg.content || 'Message'
                    )}
                  </p>
                </div>
                {quotedMsg.media && (quotedMsg.media.url || quotedMsg.media.thumbnail_base64) && (
                  <div className="whatsapp-quoted-thumb-wrapper">
                    <img src={quotedMsg.media.url || quotedMsg.media.thumbnail_base64} alt="Quoted media preview" className="whatsapp-quoted-thumb" />
                    {quotedMsg.media.type === 'video' && (
                      <div className="whatsapp-quoted-video-icon">
                        <Play size={10} fill="white" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {msg.media?.type === 'audio' ? (
              <div className="whatsapp-audio-player">
                <button type="button" className="whatsapp-audio-btn" onClick={() => onToggleAudio(msg.id)}>
                  {playingAudioId === msg.id ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <div className="whatsapp-audio-wave">
                  {[12, 18, 8, 22, 14, 20, 10, 16, 24, 12, 18, 14, 20, 8].map((h, i) => (
                    <div
                      key={i}
                      className="whatsapp-wave-bar"
                      style={{ height: `${h}px`, opacity: playingAudioId === msg.id ? (i % 2 === 0 ? 1 : 0.6) : 0.5 }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>0:08</span>
              </div>
            ) : msg.media && (msg.media.thumbnail_base64 || ['image', 'gif', 'video', 'sticker'].includes(msg.media.type) || msg.media.url) ? (
              <div
                className={`whatsapp-media-preview-container ${msg.media.type === 'sticker' ? 'is-sticker' : 'is-clickable'}`}
                onClick={() => {
                  if (msg.media.type !== 'sticker') {
                    onSetActiveLightboxMedia({
                      url: msg.media.url || msg.media.thumbnail_base64,
                      type: msg.media.type || 'image',
                      filename: msg.media.filename || 'Media file',
                      timestamp: msg.timestamp,
                      sender: msg.is_from_me ? 'You' : msg.sender_name || 'Contact',
                    })
                  }
                }}
                title={msg.media.type !== 'sticker' ? 'Click to open fullscreen' : undefined}
              >
                {(msg.media.url || msg.media.thumbnail_base64) ? (
                  <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                    <img
                      src={msg.media.url || msg.media.thumbnail_base64}
                      alt={msg.media.filename || 'Media attachment'}
                      className="whatsapp-media-preview-img"
                      onError={(e) => {
                        e.currentTarget.parentElement.style.display = 'none'
                      }}
                    />
                    {msg.media.type === 'gif' && <span className="whatsapp-gif-badge">GIF</span>}
                    {msg.media.type === 'video' && (
                      <div className="whatsapp-video-overlay">
                        <Play size={20} fill="white" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="whatsapp-media-placeholder">
                    {msg.media.type === 'gif' ? <span className="whatsapp-gif-badge">GIF</span> : msg.media.type === 'video' ? <Play size={20} /> : <FileText size={20} />}
                    <span>{msg.media.filename || `${(msg.media.type || 'Media').toUpperCase()} Attachment`}</span>
                  </div>
                )}
              </div>
            ) : msg.media?.type === 'document' ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  marginBottom: 6,
                  cursor: 'pointer',
                }}
                onClick={() => onDownloadMedia(msg.media, 'document')}
                title="Click to download document"
              >
                <FileText size={18} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, flex: 1 }}>{(msg.media.filename || 'Document').replace(/\.enc$/i, '')}</span>
                <Download size={14} style={{ opacity: 0.7 }} />
              </div>
            ) : null}

            {(() => {
              const linkInfo = extractFirstUrl(msg.content)
              if (!linkInfo) return null
              return (
                <a href={linkInfo.url} target="_blank" rel="noopener noreferrer" className="whatsapp-link-preview-card" onClick={(e) => e.stopPropagation()}>
                  <div className="whatsapp-link-preview-icon">
                    <ExternalLink size={16} />
                  </div>
                  <div className="whatsapp-link-preview-body">
                    <span className="whatsapp-link-preview-host">{linkInfo.hostname}</span>
                    <span className="whatsapp-link-preview-url">{linkInfo.url}</span>
                  </div>
                </a>
              )
            })()}

            {msg.content && (
              <div className="whatsapp-message-text">
                <Markdown content={formatMessageContent(msg.content)} />
              </div>
            )}

            <div className="whatsapp-message-meta">
              {msg.is_starred && <Star size={11} fill="currentColor" style={{ opacity: 0.8 }} />}
              <span>{formatMessageTime(msg.timestamp)}</span>
              {isOutgoing && (
                <span>
                  {msg.status === 'read' ? (
                    <CheckCheck size={14} />
                  ) : msg.status === 'delivered' ? (
                    <CheckCheck size={14} style={{ opacity: 0.6 }} />
                  ) : (
                    <Check size={14} />
                  )}
                </span>
              )}
            </div>
          </div>

          {(() => {
            const rxSummary = formatReactions(msg.reactions)
            if (!rxSummary) return null
            return (
              <div className="whatsapp-reactions-badge-list">
                <div
                  className="whatsapp-reaction-pill"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSetReactionModalData({ reactions: msg.reactions || [], messageId: msg.id })
                    onSetSelectedReactionTab('all')
                  }}
                  title={(msg.reactions || []).map((r) => `${resolveReactionSender(r).name}: ${r.emoji}`).join('\n')}
                >
                  <span className="whatsapp-reaction-emojis">{rxSummary.emojis.join(' ')}</span>
                  {rxSummary.totalCount > 1 && <span className="whatsapp-reaction-count">{rxSummary.totalCount}</span>}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
