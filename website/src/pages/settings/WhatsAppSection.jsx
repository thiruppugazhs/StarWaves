import { useEffect, useState } from 'react'
import { MessageSquare, QrCode, Trash2, Bot, Bell, Key, Plus, X, RotateCcw, Sparkles, Check } from 'lucide-react'
import { ConfirmDialog, SectionHeading, SettingsCard } from '../../components/ui'
import {
  fetchWhatsAppStatus,
  disconnectWhatsApp,
  fetchWhatsAppSettings,
  updateWhatsAppSettings,
  initiateWhatsAppPairing,
  confirmWhatsAppPairing,
} from '../../lib/whatsappApi'
import { whatsappSocket } from '../../lib/whatsappSocket'
import { WhatsAppQrModal } from '../../components/whatsapp/WhatsAppQrModal'

const DEFAULT_KEYWORDS = ['@eve', 'eve', '@susindran', '@susin', 'urgent', 'help', 'summary', 'schedule']
const KEYWORD_PRESETS = ['@eve', 'urgent', 'help', 'summary', 'schedule', 'meeting', 'status']

export function WhatsAppSection() {
  const [status, setStatus] = useState({ connected: false })
  const [settings, setSettings] = useState({
    auto_reply_enabled: false,
    auto_reply_prompt: '',
    notifications_enabled: true,
    keywords: DEFAULT_KEYWORDS,
    eve_tag: '@eve',
    owner_name: 'Susindran',
  })
  const [keywordInput, setKeywordInput] = useState('')
  const [promptInput, setPromptInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [disconnectRequested, setDisconnectRequested] = useState(false)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [pairingData, setPairingData] = useState({ qr_code: null, pairing_code: null })

  const loadData = async () => {
    try {
      const [stat, sett] = await Promise.all([
        fetchWhatsAppStatus().catch(() => ({ connected: false })),
        fetchWhatsAppSettings().catch(() => ({})),
      ])
      if (stat) setStatus(stat)
      if (sett) {
        setSettings(sett)
        if (sett.auto_reply_prompt) {
          setPromptInput(sett.auto_reply_prompt)
        }
      }
    } catch {
      // ignore
    }
  }

  const currentKeywords = settings.keywords?.length ? settings.keywords : DEFAULT_KEYWORDS

  const handleAddKeyword = (kwToAdd) => {
    const raw = (typeof kwToAdd === 'string' ? kwToAdd : keywordInput).trim()
    if (!raw) return
    const clean = raw.toLowerCase()
    if (!currentKeywords.some((k) => k.toLowerCase() === clean)) {
      const updated = [...currentKeywords, raw]
      handleSaveSettings({ keywords: updated })
    }
    setKeywordInput('')
  }

  const handleRemoveKeyword = (kwToRemove) => {
    const updated = currentKeywords.filter((k) => k.toLowerCase() !== kwToRemove.toLowerCase())
    handleSaveSettings({ keywords: updated })
  }

  const handleResetKeywords = () => {
    handleSaveSettings({ keywords: DEFAULT_KEYWORDS })
  }

  const handleSavePrompt = () => {
    handleSaveSettings({ auto_reply_prompt: promptInput })
  }

  useEffect(() => {
    loadData()

    const unsubscribe = whatsappSocket.subscribe((event) => {
      if (!event || !event.type) return

      if (event.type === 'qr_update') {
        setPairingData((prev) => ({
          qr_code: event.qr_code || prev.qr_code,
          pairing_code: event.pairing_code || prev.pairing_code,
        }))
      } else if (event.type === 'status_update' || event.type === 'connection_state') {
        setStatus((prev) => ({
          ...prev,
          connected: Boolean(event.connected),
          phone_number: event.phone_number || prev.phone_number,
          push_name: event.push_name || prev.push_name,
        }))
        if (event.connected) {
          setIsQrModalOpen(false)
          setMessage('WhatsApp connected successfully.')
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const handleOpenQr = async () => {
    setIsQrModalOpen(true)
    try {
      const pair = await initiateWhatsAppPairing()
      setPairingData(pair)
    } catch {
      // ignore
    }
  }

  const handleConfirmPair = async (phone, name) => {
    try {
      const updated = await confirmWhatsAppPairing(phone, name)
      setStatus(updated)
      setMessage('WhatsApp connected successfully.')
    } catch {
      setMessage('Failed to connect WhatsApp.')
    }
  }

  const handleDisconnect = async () => {
    setBusy(true)
    try {
      await disconnectWhatsApp()
      setStatus({ connected: false })
      setMessage('WhatsApp disconnected.')
    } catch {
      setMessage('Could not disconnect WhatsApp.')
    } finally {
      setBusy(false)
      setDisconnectRequested(false)
    }
  }

  const handleSaveSettings = async (updates) => {
    try {
      const saved = await updateWhatsAppSettings(updates)
      setSettings(saved)
      setMessage('WhatsApp settings updated.')
    } catch {
      setMessage('Could not save settings.')
    }
  }

  return (
    <div className="setting-section" id="settings-whatsapp">
      <SectionHeading
        title="WhatsApp"
        description="Connect personal or workspace WhatsApp to chat, receive notifications, and configure Eve AI automations."
      />

      <div className="apps-settings-stack">
        <SettingsCard
          icon={<MessageSquare size={19} />}
          title="WhatsApp Account"
          description="Link your WhatsApp account to sync conversations, contacts, and real-time alerts."
        action={
          status.connected ? (
            <button
              type="button"
              className="workspace-connected"
              onClick={() => setDisconnectRequested(true)}
              disabled={busy}
            >
              <Trash2 size={14} />
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenQr}
              disabled={busy}
            >
              <QrCode size={14} />
              Link Device
            </button>
          )
        }
      >
        <div className="whatsapp-settings-body">
          {message && (
            <div className="whatsapp-settings-alert">
              {message}
            </div>
          )}

          <div className="whatsapp-status-card">
            <div className="whatsapp-status-left">
              <div className="whatsapp-status-avatar">
                <MessageSquare size={20} />
              </div>
              <div className="whatsapp-status-info">
                <strong>{status.connected ? status.phone_number || 'Linked WhatsApp' : 'Not Connected'}</strong>
                <small>
                  {status.connected ? `Device: ${status.push_name || 'Active Session'}` : 'Link via QR code to sync chats with Starwaves'}
                </small>
              </div>
            </div>
            {status.connected && (
              <span className="whatsapp-status-badge">
                Connected
              </span>
            )}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<Bot size={19} />}
        title="Eve AI WhatsApp Automation"
        description="Configure how Eve interacts with your WhatsApp messages and contacts."
      >
        <div className="whatsapp-settings-body">
          <div className="whatsapp-automation-list">
            <label className="whatsapp-automation-item">
              <div className="whatsapp-automation-left">
                <div className="whatsapp-automation-icon">
                  <Bot size={18} />
                </div>
                <div className="whatsapp-automation-text">
                  <strong>Global Eve Auto-Responder</strong>
                  <small>
                    Allow Eve to draft and auto-respond to incoming WhatsApp inquiries
                  </small>
                </div>
              </div>
              <div className="whatsapp-toggle-switch">
                <input
                  type="checkbox"
                  checked={Boolean(settings.auto_reply_enabled)}
                  onChange={(e) => handleSaveSettings({ auto_reply_enabled: e.target.checked })}
                />
                <span className="whatsapp-toggle-slider" />
              </div>
            </label>

            <label className="whatsapp-automation-item">
              <div className="whatsapp-automation-left">
                <div className="whatsapp-automation-icon">
                  <Bell size={18} />
                </div>
                <div className="whatsapp-automation-text">
                  <strong>Desktop & Push Notifications</strong>
                  <small>
                    Receive instant alerts in Starwaves when new WhatsApp messages arrive
                  </small>
                </div>
              </div>
              <div className="whatsapp-toggle-switch">
                <input
                  type="checkbox"
                  checked={Boolean(settings.notifications_enabled)}
                  onChange={(e) => handleSaveSettings({ notifications_enabled: e.target.checked })}
                />
                <span className="whatsapp-toggle-slider" />
              </div>
            </label>
          </div>

          {/* Eve Trigger Keywords & Tags Section */}
          <div className="whatsapp-keywords-section">
            <div className="whatsapp-keywords-header">
              <div className="whatsapp-keywords-title">
                <Key size={16} />
                <span>Eve Trigger Keywords & Tags</span>
              </div>
              <button
                type="button"
                className="whatsapp-keywords-reset-btn"
                onClick={handleResetKeywords}
                title="Reset to default trigger keywords"
              >
                <RotateCcw size={12} />
                <span>Reset Defaults</span>
              </button>
            </div>
            <p className="whatsapp-keywords-desc">
              When any of these keywords or tags appear in a WhatsApp message, Eve automatically activates to analyze the context, summarize, draft answers, or assist.
            </p>

            {/* Active Keywords Tags List */}
            <div className="whatsapp-keyword-tags-list">
              {currentKeywords.map((kw) => (
                <span key={kw} className="whatsapp-keyword-tag">
                  <span className="whatsapp-keyword-tag-text">{kw}</span>
                  <button
                    type="button"
                    className="whatsapp-keyword-remove-btn"
                    onClick={() => handleRemoveKeyword(kw)}
                    title={`Remove keyword "${kw}"`}
                    aria-label={`Remove keyword ${kw}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            {/* Add Keyword Input Row */}
            <div className="whatsapp-keyword-input-row">
              <input
                type="text"
                className="whatsapp-keyword-text-input"
                placeholder="Add keyword or trigger tag (e.g. urgent, @eve, help)..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddKeyword()
                  }
                }}
              />
              <button
                type="button"
                className="whatsapp-keyword-add-btn"
                onClick={() => handleAddKeyword()}
                disabled={!keywordInput.trim()}
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>

            {/* Quick Keyword Presets */}
            <div className="whatsapp-keyword-presets">
              <span className="whatsapp-keyword-presets-title">Quick Presets:</span>
              <div className="whatsapp-keyword-presets-list">
                {KEYWORD_PRESETS.map((preset) => {
                  const isAdded = currentKeywords.some((k) => k.toLowerCase() === preset.toLowerCase())
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={`whatsapp-keyword-preset-chip ${isAdded ? 'is-added' : ''}`}
                      onClick={() => !isAdded && handleAddKeyword(preset)}
                      disabled={isAdded}
                      title={isAdded ? 'Already added' : `Add "${preset}" to trigger keywords`}
                    >
                      {isAdded ? <Check size={11} /> : <Plus size={11} />}
                      <span>{preset}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Custom Eve Auto-Reply Prompt */}
          <div className="whatsapp-prompt-section">
            <div className="whatsapp-prompt-header">
              <div className="whatsapp-prompt-title">
                <Sparkles size={16} />
                <span>Eve Auto-Reply Instructions & Personality</span>
              </div>
            </div>
            <p className="whatsapp-prompt-desc">
              Custom instructions guiding how Eve formulates replies when answering questions or replying to trigger keywords.
            </p>
            <textarea
              className="whatsapp-prompt-textarea"
              rows={3}
              placeholder="You are Eve, answering incoming WhatsApp messages concisely on behalf of the user..."
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
            />
            <div className="whatsapp-prompt-actions">
              <button
                type="button"
                className="whatsapp-prompt-save-btn"
                onClick={handleSavePrompt}
                disabled={promptInput === settings.auto_reply_prompt}
              >
                Save Instructions
              </button>
            </div>
          </div>
        </div>
      </SettingsCard>
      </div>

      <WhatsAppQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        qrCode={pairingData.qr_code}
        pairingCode={pairingData.pairing_code}
        onRefresh={handleOpenQr}
        onConfirmPairing={handleConfirmPair}
      />

      <ConfirmDialog
        isOpen={disconnectRequested}
        title="Disconnect WhatsApp?"
        message="Are you sure you want to unlink your WhatsApp account? You can re-link at any time."
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnectRequested(false)}
      />
    </div>
  )
}
