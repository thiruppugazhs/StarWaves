/** Header — single responsibility: conversation header with contact info and actions. */
import { Bot, Info, Loader2, Phone, Search, Sparkles, User, Users, Video } from 'lucide-react'
import { getSenderInitial } from './utils'

export function WhatsAppConversationHeader({
  chat,
  isEve,
  isTyping,
  typingText,
  isSearchOpen,
  setIsSearchOpen,
  setInChatSearchQuery,
  isSummarizing,
  onOpenInfoDrawer,
  onSummarizeChat,
  formatParticipantsSubtitle,
}) {
  return (
    <div className="whatsapp-main-header">
      <div
        className="whatsapp-contact-header"
        onClick={onOpenInfoDrawer}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpenInfoDrawer?.()
          }
        }}
        title={chat?.is_group ? 'Click to view group details and participants' : 'Click to view contact info'}
      >
        <div className={`whatsapp-avatar ${isEve ? 'is-eve' : chat?.is_group ? 'is-group' : ''}`}>
          {isEve ? (
            <Bot size={22} />
          ) : chat?.avatar_url ? (
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
            <div className="whatsapp-avatar-fallback" style={chat?.avatar_url ? { display: 'none' } : {}}>
              {chat?.name && chat.name !== 'Contact' && chat.name !== chat.id && !/^\+?\d{6,}$/.test(String(chat.name).replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '').trim()) ? (
                <span className="whatsapp-avatar-initial">{getSenderInitial(chat.name)}</span>
              ) : chat?.is_group ? (
                <Users size={20} />
              ) : (
                <User size={20} />
              )}
            </div>
          )}
        </div>
        <div className="whatsapp-contact-details">
          <h3 title={chat?.name}>
            {(() => {
              const clean = String(chat?.name || '').replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '').trim()
              const isNum = /^\+?\d{6,}$/.test(clean)
              if (chat?.is_group && (!chat?.name || chat?.name === 'Contact' || chat?.name === chat?.id || isNum)) return 'Group conversation'
              if (!chat?.name || chat?.name === 'Contact' || isNum) return 'Conversation'
              return chat.name
            })()}
          </h3>
          <span className={`whatsapp-contact-subtitle ${isTyping ? 'is-typing' : ''}`} title={chat?.participants?.join(', ')}>
            {isTyping ? (
              <span className="whatsapp-typing-text">
                <span className="whatsapp-typing-dots">● ● ●</span> {typingText || 'typing...'}
              </span>
            ) : isEve ? (
              'AI Workspace Assistant • Always active'
            ) : chat?.is_group ? (
              formatParticipantsSubtitle(chat.participants)
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span className="whatsapp-online-dot" />
                {chat?.phone_number ? `${chat.phone_number} • Online` : 'Online'}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="whatsapp-header-actions">
        <button type="button" className="whatsapp-icon-btn" title="Audio call" onClick={() => alert(`Starting audio call with ${chat?.name}...`)}>
          <Phone size={16} />
        </button>
        <button type="button" className="whatsapp-icon-btn" title="Video call" onClick={() => alert(`Starting video call with ${chat?.name}...`)}>
          <Video size={16} />
        </button>
        <button
          type="button"
          className={`whatsapp-icon-btn ${isSearchOpen ? 'active' : ''}`}
          title="Search in chat"
          onClick={() => {
            setIsSearchOpen((prev) => !prev)
            if (isSearchOpen) setInChatSearchQuery('')
          }}
        >
          <Search size={16} />
        </button>
        {!isEve && (
          <button
            type="button"
            className="secondary-button"
            style={{
              minHeight: '34px',
              padding: '6px 12px',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isSummarizing ? 0.7 : 1,
              cursor: isSummarizing ? 'not-allowed' : 'pointer',
            }}
            disabled={isSummarizing}
            onClick={() => onSummarizeChat?.(chat?.id)}
            title={isSummarizing ? 'Summarizing conversation...' : 'Summarize conversation with Eve'}
          >
            {isSummarizing ? (
              <>
                <Loader2 size={14} className="spin" />
                <span>Summarizing...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Summarize</span>
              </>
            )}
          </button>
        )}
        <button type="button" className="whatsapp-icon-btn" onClick={onOpenInfoDrawer} title="Chat info & settings">
          <Info size={16} />
        </button>
      </div>
    </div>
  )
}
