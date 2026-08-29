import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { RefreshCw, Smartphone, Copy, Check, Radio } from 'lucide-react'

export function WhatsAppQrModal({
  isOpen,
  onClose,
  qrCode,
  pairingCode,
  onRefresh,
  onRequestPairingCode,
  onCheckStatus,
  loading = false,
}) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [useCode, setUseCode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [requestingCode, setRequestingCode] = useState(false)

  const handleCopyCode = (code) => {
    if (!code) return
    navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleGetPairingCode = async (e) => {
    e?.preventDefault()
    if (!phoneNumber.trim() || !onRequestPairingCode) return
    try {
      setRequestingCode(true)
      await onRequestPairingCode(phoneNumber.trim())
    } finally {
      setRequestingCode(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Link WhatsApp"
      subtitle="Connect your WhatsApp account to Starwaves and Eve AI"
      className="whatsapp-qr-modal-dialog"
    >
      <div className="whatsapp-qr-container">
        {!useCode ? (
          <>
            <div className="whatsapp-qr-box">
              {loading || !qrCode ? (
                <div className="whatsapp-qr-loading">
                  <RefreshCw size={32} className="animate-spin" />
                  <span style={{ marginTop: '8px', fontSize: '0.8125rem' }}>Fetching live WhatsApp QR...</span>
                </div>
              ) : (
                <img src={qrCode} alt="WhatsApp QR Code" className="whatsapp-qr-image" />
              )}
            </div>

            <div className="whatsapp-qr-status-pill">
              <span className="whatsapp-qr-pulse-dot" />
              <span>Waiting for WhatsApp scan...</span>
            </div>

            <ol className="whatsapp-qr-steps">
              <li className="whatsapp-qr-step-item">
                <span className="whatsapp-qr-step-num">1</span>
                <span>Open <strong>WhatsApp</strong> on your phone</span>
              </li>
              <li className="whatsapp-qr-step-item">
                <span className="whatsapp-qr-step-num">2</span>
                <span>Tap <strong>Menu (⋮)</strong> or <strong>Settings (⚙)</strong> and select <strong>Linked Devices</strong></span>
              </li>
              <li className="whatsapp-qr-step-item">
                <span className="whatsapp-qr-step-num">3</span>
                <span>Tap <strong>Link a Device</strong> and point your camera at this QR code</span>
              </li>
            </ol>

            <div className="whatsapp-qr-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh QR
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setUseCode(true)}
              >
                <Smartphone size={14} />
                Link with phone number
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={onCheckStatus}
                disabled={loading}
              >
                <Radio size={14} />
                Check Status
              </button>
            </div>
          </>
        ) : (
          <div className="whatsapp-phone-pairing-container">
            <p className="whatsapp-phone-pairing-desc">
              Enter your phone number (including country code) to receive an 8-character pairing code to enter on your phone.
            </p>

            <form className="whatsapp-phone-form" onSubmit={handleGetPairingCode}>
              <div className="whatsapp-phone-input-row">
                <input
                  type="tel"
                  className="whatsapp-phone-input"
                  placeholder="+1 (555) 000-0000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!phoneNumber.trim() || requestingCode}
                >
                  {requestingCode ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Requesting...
                    </>
                  ) : (
                    'Get Code'
                  )}
                </button>
              </div>
            </form>

            {pairingCode && (
              <div className="whatsapp-pairing-card">
                <div className="whatsapp-pairing-label">YOUR PAIRING CODE</div>
                <div className="whatsapp-pairing-code-row">
                  <span className="whatsapp-pairing-digits">{pairingCode}</span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleCopyCode(pairingCode)}
                    title="Copy pairing code"
                    style={{ minHeight: '34px', padding: '6px 10px' }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="whatsapp-pairing-instruction">
                  On WhatsApp: <strong>Settings &gt; Linked Devices &gt; Link a Device &gt; Link with phone number instead</strong> and type the code above.
                </p>
              </div>
            )}

            <div className="whatsapp-qr-actions" style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setUseCode(false)}
              >
                Back to QR Code
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={onCheckStatus}
              >
                <Radio size={14} />
                Check Status
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
