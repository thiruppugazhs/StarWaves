import '../../styles/pages/whatsapp-shell.css'
import { MessageSquare, QrCode } from 'lucide-react'

export function WhatsAppEmptyPane({ connected, onLink }) {
  return (
    <div className="whatsapp-main-empty">
      <div className="whatsapp-empty-badge-icon">
        <MessageSquare size={28} strokeWidth={1.75} />
      </div>

      <h3 className="whatsapp-empty-title">
        {connected ? 'Select a conversation' : 'WhatsApp is not connected'}
      </h3>

      <p className="whatsapp-empty-lead">
        {connected
          ? 'Choose a chat from the sidebar to view and send messages.'
          : 'Link your device to start sending and receiving messages in Starwaves.'}
      </p>

      {!connected && (
        <div className="whatsapp-empty-actions">
          <button
            type="button"
            className="primary-button"
            onClick={onLink}
          >
            <QrCode size={16} /> Link WhatsApp Account
          </button>
        </div>
      )}
    </div>
  )
}
