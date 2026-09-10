import { ArrowRight, Bot, Check, Eye, EyeOff, Key, Sparkles, UserRound } from 'lucide-react'
import { useState } from 'react'
import { updateUserProfile } from '../lib/authApi'
import { saveAiModelPreference } from '../lib/aiModelsApi'
import { StarWavesLogo } from '../components/StarWavesLogo'

const PROVIDER_OPTIONS = [
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'openai', label: 'OpenAI (GPT-4o, ChatGPT)' },
  { id: 'anthropic', label: 'Anthropic Claude' },
  { id: 'groq', label: 'Groq (Ultra-fast inference)' },
  { id: 'ollama', label: 'Ollama (Local AI)' },
]

export function OnboardingPage({ user, onComplete }) {
  const [name, setName] = useState(user?.displayName ?? '')
  const [assistantName, setAssistantName] = useState('Eve')
  const [keyOption, setKeyOption] = useState('default') // 'default' | 'custom'
  const [customProvider, setCustomProvider] = useState('gemini')
  const [customKey, setCustomKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const cleanName = name.trim().replace(/\s+/g, ' ')
    if (cleanName.length < 2) {
      setError('Enter your name to continue.')
      return
    }

    const cleanAssistant = assistantName.trim() || 'Eve'

    if (keyOption === 'custom' && customProvider !== 'ollama' && !customKey.trim()) {
      setError(`Please provide your ${PROVIDER_OPTIONS.find((p) => p.id === customProvider)?.label || 'AI'} API key.`)
      return
    }

    setSaving(true)
    setError('')
    try {
      // 1. Update user profile with full name and assistant name
      const updatedUser = await updateUserProfile(cleanName, cleanAssistant)
      try {
        localStorage.setItem('starwaves_assistant_name', cleanAssistant)
      } catch {}

      // 2. Save AI model choice
      if (keyOption === 'default') {
        await saveAiModelPreference({
          provider: 'default',
          model: 'default',
          assistant_name: cleanAssistant,
        }).catch((err) => console.warn('Could not save default AI preference:', err))
      } else {
        await saveAiModelPreference({
          provider: customProvider,
          model: 'default',
          api_key: customKey.trim(),
          assistant_name: cleanAssistant,
        }).catch((err) => console.warn('Could not save custom AI preference:', err))
      }

      onComplete(updatedUser, cleanName)
    } catch (err) {
      setError(err?.message || 'Your setup could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main id="main-content" className="onboarding-page" tabIndex={-1}>
      <section className="onboarding-card" style={{ maxWidth: '520px' }}>
        <StarWavesLogo size={36} />
        <div className="onboarding-icon"><Sparkles size={24} /></div>
        <p className="onboarding-eyebrow">Welcome to StarWaves</p>
        <h1 className="onboarding-title">Set up your workspace</h1>
        <span className="onboarding-copy">
          Personalize your account and configure your autonomous AI companion.
        </span>

        <form className="onboarding-form" onSubmit={submit}>
          {/* User Name */}
          <label htmlFor="onboarding-name">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserRound size={14} />
              <strong>What should we call you?</strong>
            </span>
            <input
              id="onboarding-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your full name"
              minLength="2"
              maxLength="100"
              autoComplete="name"
              autoFocus
              required
            />
          </label>

          {/* Assistant Name */}
          <label htmlFor="onboarding-assistant">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={14} />
              <strong>What's your name for the chat assistant?</strong>
            </span>
            <input
              id="onboarding-assistant"
              type="text"
              value={assistantName}
              onChange={(event) => setAssistantName(event.target.value)}
              placeholder="e.g. Eve, Jarvis, Aria, Nova"
              maxLength={32}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '-4px' }}>
              This will be your personal AI assistant across your dashboard, voice, and WhatsApp.
            </small>
          </label>

          {/* AI Model / Key Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700' }}>
              <Key size={14} />
              <strong>AI Model & Key Selection</strong>
            </span>

            {/* Option Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setKeyOption('default')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '6px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: keyOption === 'default' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                  background: keyOption === 'default' ? 'var(--color-primary-subtle, rgba(99, 102, 241, 0.08))' : 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <strong style={{ fontSize: '13px' }}>Default Gemini</strong>
                  {keyOption === 'default' && <Check size={14} color="var(--color-primary)" />}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                  Built-in Gemini AI key ready to use instantly.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setKeyOption('custom')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '6px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: keyOption === 'custom' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                  background: keyOption === 'custom' ? 'var(--color-primary-subtle, rgba(99, 102, 241, 0.08))' : 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <strong style={{ fontSize: '13px' }}>Custom Key</strong>
                  {keyOption === 'custom' && <Check size={14} color="var(--color-primary)" />}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                  Use your own Gemini, OpenAI, Claude key.
                </span>
              </button>
            </div>

            {/* Custom Key Fields */}
            {keyOption === 'custom' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  marginTop: '4px',
                }}
              >
                <label style={{ fontSize: '11px', gap: '4px' }}>
                  Provider
                  <select
                    value={customProvider}
                    onChange={(e) => setCustomProvider(e.target.value)}
                    style={{
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      font: 'inherit',
                      fontSize: '13px',
                    }}
                  >
                    {PROVIDER_OPTIONS.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.label}
                      </option>
                    ))}
                  </select>
                </label>

                {customProvider !== 'ollama' && (
                  <label style={{ fontSize: '11px', gap: '4px' }}>
                    API Key
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={customKey}
                        onChange={(e) => setCustomKey(e.target.value)}
                        placeholder={`Enter your ${PROVIDER_OPTIONS.find((p) => p.id === customProvider)?.label || ''} key`}
                        autoComplete="off"
                        spellCheck={false}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 36px 0 10px',
                          borderRadius: '8px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          font: 'inherit',
                          fontSize: '13px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((prev) => !prev)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px',
                        }}
                        aria-label={showKey ? 'Hide key' : 'Show key'}
                      >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </label>
                )}
              </div>
            )}
          </div>

          {error && <span className="auth-error" role="alert">{error}</span>}
          <button type="submit" disabled={saving} style={{ marginTop: '8px' }}>
            {saving ? 'Saving…' : 'Continue to workspace'}
            {!saving && <ArrowRight size={17} />}
          </button>
        </form>
        <small className="onboarding-footer-text">Signed in as {user?.email}</small>
      </section>
    </main>
  )
}
