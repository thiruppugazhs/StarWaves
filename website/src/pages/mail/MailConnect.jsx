import '../../styles/pages/mail-connect.css'
import { LoaderCircle, Mail, MailPlus } from 'lucide-react'
import { Alert } from '../../components/ui'

export function MailConnect({ error, connectingGmail, onConnect, onNavigate }) {
  return (
    <div className="mail-page-container">
      <div className="mail-connect-hero-card">
        <div className="mail-connect-badge-icon">
          <Mail size={24} strokeWidth={2} />
        </div>

        <h2>Connect Google Mail</h2>
        <p className="mail-connect-lead">
          Link your Google account to access your inbox, organize priority threads, search archives, and draft replies directly from StarWaves.
        </p>

        <div className="mail-connect-features-grid">
          <div className="mail-feature-item">
            <span className="mail-feature-bullet" />
            <div>
              <strong>Unified Inbox & Categories</strong>
              <p>Browse Primary, Updates, Promotions, and Forums tabs in real time.</p>
            </div>
          </div>
          <div className="mail-feature-item">
            <span className="mail-feature-bullet" />
            <div>
              <strong>Multi-Account Switching</strong>
              <p>Connect and switch across personal and workspace accounts seamlessly.</p>
            </div>
          </div>
          <div className="mail-feature-item">
            <span className="mail-feature-bullet" />
            <div>
              <strong>AI Ready & Fast Compose</strong>
              <p>Send clean emails, reply in-thread, and leverage workspace context.</p>
            </div>
          </div>
          <div className="mail-feature-item">
            <span className="mail-feature-bullet" />
            <div>
              <strong>Secure OAuth 2.0</strong>
              <p>Tokens are encrypted and stored safely with direct Google authorization.</p>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="error" title="Connection Error" className="mail-connect-alert">
            {error}
          </Alert>
        )}

        <div className="mail-connect-actions">
          <button
            className="primary-button"
            onClick={onConnect}
            disabled={connectingGmail}
          >
            {connectingGmail ? (
              <>
                <LoaderCircle size={16} className="mail-spin" /> Connecting to Google…
              </>
            ) : (
              <>
                <MailPlus size={16} /> Connect Gmail Account
              </>
            )}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onNavigate('setting')}
          >
            Configure in Settings
          </button>
        </div>

        <div className="mail-connect-footer-note">
          <span>Requires Gmail Read/Send permissions. No third-party data selling.</span>
        </div>
      </div>
    </div>
  )
}
