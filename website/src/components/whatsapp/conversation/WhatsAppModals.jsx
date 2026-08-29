/** Modals — single responsibility: message info, lightbox and reactions modals. */
import { Check, CheckCheck, Download, User, X } from 'lucide-react'

export function WhatsAppModals({
  infoModalMessage,
  setInfoModalMessage,
  activeLightboxMedia,
  setActiveLightboxMedia,
  reactionModalData,
  setReactionModalData,
  selectedReactionTab,
  setSelectedReactionTab,
  resolveReactionSender,
  handleDownloadMedia,
}) {
  return (
    <>
      {infoModalMessage && (
        <div className="whatsapp-info-modal-backdrop" onClick={() => setInfoModalMessage(null)}>
          <div className="whatsapp-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="whatsapp-info-modal-header">
              <h3>Message Info</h3>
              <button type="button" className="whatsapp-icon-btn small" onClick={() => setInfoModalMessage(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="whatsapp-info-modal-body">
              <div className="whatsapp-info-row">
                <span className="info-label">Sender</span>
                <span className="info-value">{infoModalMessage.is_from_me ? 'You' : infoModalMessage.sender_name || 'Contact'}</span>
              </div>
              <div className="whatsapp-info-row">
                <span className="info-label">Length</span>
                <span className="info-value">{infoModalMessage.content?.length || 0} characters</span>
              </div>
              <div className="whatsapp-info-status-section">
                <div className="whatsapp-info-status-item">
                  <div className="whatsapp-info-status-title">
                    <CheckCheck size={16} className="status-icon read" />
                    <span>Read</span>
                  </div>
                  <span className="whatsapp-info-status-time">
                    {infoModalMessage.status === 'read'
                      ? infoModalMessage.read_at
                        ? new Date(infoModalMessage.read_at).toLocaleString()
                        : 'Read'
                      : 'Not read yet'}
                  </span>
                </div>
                <div className="whatsapp-info-status-item">
                  <div className="whatsapp-info-status-title">
                    <CheckCheck size={16} className="status-icon delivered" />
                    <span>Delivered</span>
                  </div>
                  <span className="whatsapp-info-status-time">
                    {infoModalMessage.status === 'delivered' || infoModalMessage.status === 'read'
                      ? infoModalMessage.delivered_at
                        ? new Date(infoModalMessage.delivered_at).toLocaleString()
                        : 'Delivered'
                      : 'Pending'}
                  </span>
                </div>
                <div className="whatsapp-info-status-item">
                  <div className="whatsapp-info-status-title">
                    <Check size={16} className="status-icon sent" />
                    <span>Sent</span>
                  </div>
                  <span className="whatsapp-info-status-time">{new Date(infoModalMessage.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <div className="whatsapp-info-preview-box">
                <p>{infoModalMessage.content}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeLightboxMedia && (
        <div className="whatsapp-lightbox-backdrop" onClick={() => setActiveLightboxMedia(null)}>
          <div className="whatsapp-lightbox-container" onClick={(e) => e.stopPropagation()}>
            <div className="whatsapp-lightbox-header">
              <div className="whatsapp-lightbox-meta">
                <span className="whatsapp-lightbox-sender">{activeLightboxMedia.sender}</span>
                {activeLightboxMedia.timestamp && <span className="whatsapp-lightbox-time">{new Date(activeLightboxMedia.timestamp).toLocaleString()}</span>}
              </div>
              <div className="whatsapp-lightbox-actions">
                <button type="button" onClick={() => handleDownloadMedia(activeLightboxMedia, 'whatsapp-media')} className="whatsapp-icon-btn small" title="Download media">
                  <Download size={16} />
                </button>
                <button type="button" className="whatsapp-icon-btn small" onClick={() => setActiveLightboxMedia(null)} title="Close viewer">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="whatsapp-lightbox-body">
              {activeLightboxMedia.type === 'video' && activeLightboxMedia.url && activeLightboxMedia.url.startsWith('data:video') ? (
                <video src={activeLightboxMedia.url} controls autoPlay className="whatsapp-lightbox-media" />
              ) : activeLightboxMedia.type === 'video' && activeLightboxMedia.thumbnail_base64 ? (
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <img src={activeLightboxMedia.thumbnail_base64} alt={activeLightboxMedia.filename || 'Video preview'} className="whatsapp-lightbox-media" />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Video preview (encrypted media streaming via WhatsApp)</span>
                </div>
              ) : (
                <img
                  src={activeLightboxMedia.url || activeLightboxMedia.thumbnail_base64}
                  alt={activeLightboxMedia.filename || 'Fullscreen media'}
                  className="whatsapp-lightbox-media"
                  onError={(e) => {
                    if (activeLightboxMedia.thumbnail_base64 && e.currentTarget.src !== activeLightboxMedia.thumbnail_base64) {
                      e.currentTarget.src = activeLightboxMedia.thumbnail_base64
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {reactionModalData && (
        <div className="whatsapp-info-modal-backdrop" onClick={() => setReactionModalData(null)}>
          <div className="whatsapp-reaction-modal" onClick={(e) => e.stopPropagation()}>
            <div className="whatsapp-reaction-modal-header">
              <div className="whatsapp-reaction-modal-tabs">
                <button
                  type="button"
                  className={`whatsapp-reaction-tab ${selectedReactionTab === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedReactionTab('all')}
                >
                  All ({reactionModalData.reactions.length})
                </button>
                {Array.from(new Set(reactionModalData.reactions.map((r) => r.emoji))).map((emoji) => {
                  const count = reactionModalData.reactions.filter((r) => r.emoji === emoji).length
                  const isActive = selectedReactionTab === emoji
                  return (
                    <button key={emoji} type="button" className={`whatsapp-reaction-tab ${isActive ? 'active' : ''}`} onClick={() => setSelectedReactionTab(emoji)}>
                      {emoji} {count}
                    </button>
                  )
                })}
              </div>
              <button type="button" className="whatsapp-icon-btn small" onClick={() => setReactionModalData(null)} title="Close">
                <X size={16} />
              </button>
            </div>
            <div className="whatsapp-reaction-modal-list">
              {reactionModalData.reactions
                .filter((rx) => selectedReactionTab === 'all' || rx.emoji === selectedReactionTab)
                .map((rx, idx) => {
                  const senderInfo = resolveReactionSender(rx)
                  return (
                    <div key={idx} className="whatsapp-reaction-user-row">
                      <div className="whatsapp-avatar small">
                        {senderInfo.avatar ? (
                          <img
                            src={senderInfo.avatar}
                            alt={senderInfo.name}
                            className="whatsapp-avatar-img"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              if (e.currentTarget.nextSibling) {
                                e.currentTarget.nextSibling.style.display = 'flex'
                              }
                            }}
                          />
                        ) : null}
                        <div className="whatsapp-avatar-fallback" style={senderInfo.avatar ? { display: 'none' } : {}}>
                          {senderInfo.name !== 'Contact' && senderInfo.initial !== '?' ? (
                            <span className="whatsapp-avatar-initial">{senderInfo.initial}</span>
                          ) : (
                            <User size={14} />
                          )}
                        </div>
                      </div>
                      <div className="whatsapp-reaction-user-name">
                        <span className="whatsapp-reaction-person-title">{senderInfo.name}</span>
                      </div>
                      <span className="whatsapp-reaction-emoji-badge">{rx.emoji}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
