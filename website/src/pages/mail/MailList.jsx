import '../../styles/pages/mail-list.css'
import { Mail, RefreshCw, Star } from 'lucide-react'
import { Alert, EmptyState, LoadingState } from '../../components/ui'
import { formatMailDate } from './mailUtils'

export function MailList({
  error,
  loading,
  messages,
  onRetry,
  onToggleStar,
  onOpenMessage,
}) {
  return (
    <div className="mail-list">
      {error && (
        <Alert
          variant="error"
          title="Could not load mail"
          className="mail-alert-error"
        >
          <p>{error}</p>
          <button
            className="secondary-button mail-retry-btn"
            type="button"
            onClick={onRetry}
            disabled={loading}
          >
            <RefreshCw size={14} /> {loading ? 'Retrying…' : 'Try again'}
          </button>
        </Alert>
      )}
      {loading && !messages.length && <LoadingState message="Loading mail…" />}
      {!loading && !error && !messages.length && (
        <EmptyState
          icon={Mail}
          title="No messages here"
          description="You're all caught up."
        />
      )}
      {messages.map((message) => (
        <div
          className={`mail-row ${message.unread ? 'unread' : ''}`}
          key={message.id}
        >
          <button
            type="button"
            className="mail-star"
            onClick={(event) => onToggleStar(message, event)}
            aria-label={message.starred ? 'Unstar message' : 'Star message'}
          >
            <Star size={16} className={message.starred ? 'starred' : ''} />
          </button>
          <button type="button" className="mail-row-main" onClick={() => onOpenMessage(message)}>
            <strong>{message.sender}</strong>
            <span><b>{message.subject}</b><span> — {message.snippet}</span></span>
            <time>{formatMailDate(message.date)}</time>
          </button>
        </div>
      ))}
    </div>
  )
}
