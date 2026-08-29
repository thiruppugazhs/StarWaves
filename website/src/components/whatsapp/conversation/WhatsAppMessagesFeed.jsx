/** Messages feed — single responsibility: render scrollable message list. */
import { Bot, User, Users } from 'lucide-react'
import { WhatsAppMessageBubble } from './WhatsAppMessageBubble'

export function WhatsAppMessagesFeed({
  chat,
  isEve,
  isTyping,
  hasMoreMessages,
  isLoadingMore,
  displayedMessages,
  messages,
  hoveredMessageId,
  setHoveredMessageId,
  activeMenuMessageId,
  setActiveMenuMessageId,
  menuPlacement,
  setMenuPlacement,
  menuRef,
  playingAudioId,
  setPlayingAudioId,
  messagesFeedRef,
  messagesEndRef,
  handleFeedScroll,
  onLoadMoreMessages,
  onReactToMessage,
  onStarMessage,
  onDeleteMessage,
  onSetReplyingTo,
  onCopyMessage,
  onAskEveAboutMessage,
  onForwardMessage,
  onPinToggle,
  onSetInfoModalMessage,
  onSetActiveLightboxMedia,
  onSetReactionModalData,
  onSetSelectedReactionTab,
  resolveReactionSender,
  onDownloadMedia,
  previousScrollHeightRef,
}) {
  const getQuotedMessage = (replyId) => {
    if (!replyId) return null
    return messages.find((m) => m.id === replyId)
  }

  const handleToggleAudio = (msgId) => {
    setPlayingAudioId((prev) => (prev === msgId ? null : msgId))
  }

  if (displayedMessages.length === 0) {
    return (
      <div className="whatsapp-messages-feed" ref={messagesFeedRef} onScroll={handleFeedScroll}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '40px 20px',
            minHeight: '260px',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              display: 'grid',
              placeItems: 'center',
              marginBottom: 12,
            }}
          >
            {isEve ? <Bot size={20} /> : chat?.is_group ? <Users size={20} /> : <User size={20} />}
          </div>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>No messages in this conversation yet</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, maxWidth: 320 }}>
            {isEve ? 'Ask Eve anything to get started.' : `Send a message below to start chatting with ${chat?.name || 'this contact'}.`}
          </p>
        </div>
        <div ref={messagesEndRef} />
      </div>
    )
  }

  return (
    <div className="whatsapp-messages-feed" ref={messagesFeedRef} onScroll={handleFeedScroll}>
      {isLoadingMore ? (
        <div className="whatsapp-loading-older">
          <div className="whatsapp-loading-spinner" />
          <span>Loading earlier messages...</span>
        </div>
      ) : hasMoreMessages && displayedMessages.length > 0 ? (
        <div className="whatsapp-loading-older-wrapper">
          <button
            type="button"
            className="whatsapp-load-more-btn"
            onClick={() => {
              if (messagesFeedRef.current) {
                previousScrollHeightRef.current = messagesFeedRef.current.scrollHeight
              }
              onLoadMoreMessages?.()
            }}
          >
            Load earlier messages
          </button>
        </div>
      ) : null}

      {displayedMessages.map((msg) => {
        const isOutgoing = msg.is_from_me
        const isMsgEve = msg.is_eve || msg.sender_id === 'eve'
        const isHovered = hoveredMessageId === msg.id
        const isMenuOpen = activeMenuMessageId === msg.id
        const quotedMsg = getQuotedMessage(msg.reply_to_message_id)

        return (
          <WhatsAppMessageBubble
            key={msg.id}
            msg={msg}
            chat={chat}
            isOutgoing={isOutgoing}
            isMsgEve={isMsgEve}
            isHovered={isHovered}
            isMenuOpen={isMenuOpen}
            menuPlacement={menuPlacement}
            menuRef={menuRef}
            quotedMsg={quotedMsg}
            playingAudioId={playingAudioId}
            onToggleAudio={handleToggleAudio}
            onSetActiveMenuMessageId={setActiveMenuMessageId}
            onSetMenuPlacement={setMenuPlacement}
            onSetReplyingTo={onSetReplyingTo}
            onCopyMessage={onCopyMessage}
            onAskEveAboutMessage={onAskEveAboutMessage}
            onSetInfoModalMessage={onSetInfoModalMessage}
            onSetActiveLightboxMedia={onSetActiveLightboxMedia}
            onSetReactionModalData={onSetReactionModalData}
            onSetSelectedReactionTab={onSetSelectedReactionTab}
            onReactToMessage={onReactToMessage}
            onStarMessage={onStarMessage}
            onDeleteMessage={onDeleteMessage}
            setActiveMenuMessageId={setActiveMenuMessageId}
            resolveReactionSender={resolveReactionSender}
            onDownloadMedia={onDownloadMedia}
            onForwardMessage={onForwardMessage}
            onPinToggle={onPinToggle}
            setHoveredMessageId={setHoveredMessageId}
          />
        )
      })}

      {isTyping && (
        <div className="whatsapp-message-row incoming is-typing-row">
          <div className="whatsapp-message-wrapper incoming">
            <div className="whatsapp-message-bubble whatsapp-typing-bubble">
              <span className="whatsapp-typing-dot-anim" />
              <span className="whatsapp-typing-dot-anim" />
              <span className="whatsapp-typing-dot-anim" />
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
