import '../../styles/pages/mail-reader.css'
import { Archive, LoaderCircle, Mail, Reply, Trash2, X } from 'lucide-react'
import { MailModal } from '../../components/ui'
import { formatMailDate, sanitizeEmailHtml } from './mailUtils'

export function MailReader({ message, reading, onClose, onReply, onArchive, onDelete }) {
  return (
    <MailModal labelledBy="message-title" onClose={onClose}>
      <header className="mail-card-header">
        <div>
          <span className="mail-avatar" aria-label="Mail" title="Mail">
            <Mail size={22} strokeWidth={2.25} aria-hidden="true" />
          </span>
          <div>
            <h3 id="message-title">{message.subject || '(No Subject)'}</h3>
            <span>{message.from} → {message.to || 'me'}</span>
            <time>{formatMailDate(message.date, true)}</time>
          </div>
        </div>
        <div className="mail-card-actions">
          <button onClick={() => onReply(message)}>
            <Reply size={16} /> Reply
          </button>
          <button onClick={() => onArchive(message)}><Archive size={16} /> Archive</button>
          <button onClick={() => onDelete(message)}><Trash2 size={16} /> Trash</button>
          <button onClick={onClose} aria-label="Close message"><X size={16} /></button>
        </div>
      </header>
      <div className="mail-card-body">
        {reading ? (
          <div className="mail-state"><LoaderCircle className="mail-spin" />Loading message body…</div>
        ) : message.html ? (
          <iframe
            title={message.subject}
            srcDoc={sanitizeEmailHtml(message.html)}
            sandbox="allow-popups"
          />
        ) : (
          <pre>{message.body}</pre>
        )}
      </div>
    </MailModal>
  )
}
