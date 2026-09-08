import '../../styles/pages/mail-reader.css'
import { Send, X } from 'lucide-react'
import { MailModal } from '../../components/ui'

export function MailComposer({ compose, setCompose, sending, onSend, onRequestClose }) {
  return (
    <MailModal labelledBy="compose-title" onClose={onRequestClose} className="compose-card">
      <form onSubmit={onSend}>
        <header className="mail-card-header">
          <h3 id="compose-title">{compose.threadId ? 'Reply Message' : 'New Message'}</h3>
          <button type="button" onClick={onRequestClose} aria-label="Close compose"><X size={16} /></button>
        </header>
        <div className="compose-fields">
          <input value={compose.to} onChange={(event) => setCompose((c) => ({ ...c, to: event.target.value }))} placeholder="To" required />
          <input value={compose.cc} onChange={(event) => setCompose((c) => ({ ...c, cc: event.target.value }))} placeholder="Cc" />
          <input value={compose.bcc} onChange={(event) => setCompose((c) => ({ ...c, bcc: event.target.value }))} placeholder="Bcc" />
          <input value={compose.subject} onChange={(event) => setCompose((c) => ({ ...c, subject: event.target.value }))} placeholder="Subject" required />
          <textarea value={compose.body} onChange={(event) => setCompose((c) => ({ ...c, body: event.target.value }))} placeholder="Write your message…" rows="12" required />
        </div>
        <footer className="compose-footer">
          <button type="button" onClick={onRequestClose}>Discard</button>
          <button className="primary-button" type="submit" disabled={sending}>
            {sending ? 'Sending…' : <><Send size={15} /> Send</>}
          </button>
        </footer>
      </form>
    </MailModal>
  )
}
