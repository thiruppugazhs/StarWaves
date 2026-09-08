import '../../styles/pages/whatsapp-sync.css'
import { Loader2, MessageSquare, RefreshCw, WifiOff } from 'lucide-react'

export function WhatsAppSyncState({ status, progress, stepText, error, onRetry }) {
  if (status === 'error') {
    return (
      <div className="whatsapp-sync-loading-container">
        <div className="whatsapp-sync-loading-card is-error">
          <div className="whatsapp-sync-logo-wrapper is-error">
            <WifiOff size={36} />
          </div>
          <h2 className="whatsapp-sync-title">WhatsApp Gateway Unavailable</h2>
          <p className="whatsapp-sync-error-desc">
            {error || 'The WhatsApp backend server or worker is currently unreachable.'}
          </p>

          <div className="whatsapp-sync-actions">
            <button
              type="button"
              className="primary-button whatsapp-sync-retry-btn"
              onClick={onRetry}
            >
              <RefreshCw size={16} /> Retry Synchronization
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="whatsapp-sync-loading-container">
      <div className="whatsapp-sync-loading-card">
        <div className="whatsapp-sync-logo-wrapper">
          <MessageSquare size={36} className="whatsapp-sync-logo-icon" />
        </div>
        <h2 className="whatsapp-sync-title">Starwaves WhatsApp</h2>
        <p className="whatsapp-sync-step">{stepText}</p>

        <div className="whatsapp-sync-progress-bar-bg">
          <div
            className="whatsapp-sync-progress-bar-fill"
            style={{ '--progress': `${progress}%` }}
          />
        </div>

        <div className="whatsapp-sync-footer">
          <div className="whatsapp-sync-footer-status">
            <Loader2 size={13} className="spin" />
            <span>Syncing encrypted session & conversations</span>
          </div>
          <span className="whatsapp-sync-footer-percent">{progress}%</span>
        </div>
      </div>
    </div>
  )
}
