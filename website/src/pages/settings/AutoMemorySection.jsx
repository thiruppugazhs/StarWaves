import { useEffect, useState } from 'react'
import { BrainCog } from 'lucide-react'
import { loadEveMemorySettings, saveEveMemorySettings } from '../../lib/eveMemoryApi'
import { SettingsCard, SettingsSection } from '../../components/ui'

export function AutoMemorySection() {
  const [autoRemember, setAutoRemember] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    loadEveMemorySettings()
      .then((data) => {
        if (active) setAutoRemember(Boolean(data.auto_remember))
      })
      .catch(() => {
        // Server default (ON) applies when the preference was never saved
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleToggle = async (nextValue) => {
    const previous = autoRemember
    setAutoRemember(nextValue)
    setSaving(true)
    setMessage('')
    try {
      await saveEveMemorySettings({ auto_remember: nextValue })
      setMessage(nextValue ? 'Auto-remember is on.' : 'Auto-remember is off.')
    } catch (error) {
      setAutoRemember(previous)
      setMessage(error.message || 'Could not save the setting. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection
      id="settings-eve-memory"
      heading="Eve memory"
      description="Control what Eve remembers about you across chats, WhatsApp replies, voice calls, and scheduled tasks."
    >
      <SettingsCard
        icon={<BrainCog size={18} />}
        title="Auto-remember"
        description="Eve quietly saves durable facts you share — preferences, projects, stack, commitments — as memories she recalls in future conversations."
      >
        <label className="whatsapp-automation-item">
          <div className="whatsapp-automation-left">
            <div className="whatsapp-automation-icon">
              <BrainCog size={18} />
            </div>
            <div className="whatsapp-automation-text">
              <strong>{autoRemember ? 'On' : 'Off'}</strong>
              <small>
                {autoRemember
                  ? 'New facts are captured automatically after each AI reply.'
                  : 'Eve only saves memories when you ask her to remember something.'}
              </small>
            </div>
          </div>
          <div className="whatsapp-toggle-switch">
            <input
              type="checkbox"
              checked={Boolean(autoRemember)}
              disabled={loading || saving}
              onChange={(e) => handleToggle(e.target.checked)}
              aria-label="Toggle automatic memory saving"
            />
            <span className="whatsapp-toggle-slider" />
          </div>
        </label>

        {message ? (
          <p className="settings-inline-status" role="status">
            {message}
          </p>
        ) : null}
      </SettingsCard>
    </SettingsSection>
  )
}
