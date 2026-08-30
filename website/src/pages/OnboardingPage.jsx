import { ArrowLeft, ArrowRight, Bot, Check, Eye, EyeOff, Key, Sparkles, UserRound } from 'lucide-react'
import { useState } from 'react'
import { updateUserProfile } from '../lib/authApi'
import { saveAiModelPreference } from '../lib/aiModelsApi'
import { StarWavesLogo } from '../components/StarWavesLogo'

const PROVIDER_OPTIONS = [
  { id: 'openai', label: 'OpenAI (ChatGPT)', defaultModel: 'gpt-4o-mini', placeholder: 'sk-proj-...' },
  { id: 'anthropic', label: 'Anthropic (Claude)', defaultModel: 'claude-sonnet-4-5', placeholder: 'sk-ant-...' },
  { id: 'groq', label: 'Groq (Ultra-Fast)', defaultModel: 'llama-3.1-70b-versatile', placeholder: 'gsk_...' },
  { id: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.5-flash', placeholder: 'AIzaSy...' },
  { id: 'openrouter', label: 'OpenRouter (300+ Models)', defaultModel: 'openai/gpt-4o', placeholder: 'sk-or-...' },
]

export function OnboardingPage({ user, onComplete }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState(user?.displayName ?? '')
  const [assistantName, setAssistantName] = useState('Eve')

  // AI Brain Selection
  const [aiMode, setAiMode] = useState('builtin') // 'builtin' | 'byok'
  const [selectedProvider, setSelectedProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleStep1Next = (e) => {
    e.preventDefault()
    const cleanName = name.trim().replace(/\s+/g, ' ')
    if (cleanName.length < 2) {
      setError('Enter your name to continue.')
      return
    }
    const cleanAssistant = assistantName.trim()
    if (!cleanAssistant) {
      setError('Enter a name for your AI assistant.')
      return
    }
    setError('')
    setStep(2)
  }

  const handleComplete = async (e) => {
    e.preventDefault()
    setError('')

    if (aiMode === 'byok' && !apiKey.trim()) {
      setError('Please enter your API key or switch to the built-in AI.')
      return
    }

    setSaving(true)
    try {
      const cleanName = name.trim().replace(/\s+/g, ' ')
      const cleanAssistant = assistantName.trim() || 'Eve'

      // 1. Update user profile with assistant name
      const updatedUser = await updateUserProfile(cleanName, cleanAssistant)
      try {
        localStorage.setItem('starwaves_assistant_name', cleanAssistant)
      } catch {}

      // 2. Save AI model choice & assistant name
      if (aiMode === 'builtin') {
        await saveAiModelPreference({
          provider: 'default',
          model: 'default',
          assistant_name: cleanAssistant,
        })
      } else {
        const prov = PROVIDER_OPTIONS.find((p) => p.id === selectedProvider) || PROVIDER_OPTIONS[0]
        await saveAiModelPreference({
          provider: prov.id,
          model: prov.defaultModel,
          api_key: apiKey.trim(),
          assistant_name: cleanAssistant,
        })
      }

      onComplete(updatedUser, cleanName)
    } catch (err) {
      setError(err.message || 'Setup could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main id="main-content" className="onboarding-page" tabIndex={-1}>
      <section className="onboarding-card" style={{ maxWidth: '520px', width: '100%' }}>
        <StarWavesLogo size={36} />

        <div className="onboarding-icon">
          {step === 1 ? <UserRound size={23} /> : <Sparkles size={23} />}
        </div>

        <p className="onboarding-eyebrow">Step {step} of 2</p>
        <h1 className="onboarding-title">
          {step === 1 ? 'Personalize Your Workspace' : 'Choose Your AI Brain'}
        </h1>
        <span className="onboarding-copy">
          {step === 1
            ? 'Set up your identity and choose what to name your personal AI companion.'
            : 'Select how your AI assistant should be powered. You can change this anytime in Settings.'}
        </span>

        {step === 1 ? (
          <form className="onboarding-form" onSubmit={handleStep1Next}>
            <label htmlFor="onboarding-name">
              Your Name
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

            <label htmlFor="onboarding-assistant-name">
              Name Your AI Assistant
              <input
                id="onboarding-assistant-name"
                type="text"
                value={assistantName}
                onChange={(event) => setAssistantName(event.target.value)}
                placeholder="e.g. Eve, Jarvis, Aria, Nova"
                minLength="1"
                maxLength="32"
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Your assistant will respond to this name in chat and tools.
              </span>
            </label>

            {error && <span className="auth-error" role="alert">{error}</span>}

            <button type="submit">
              Next: Choose AI Brain
              <ArrowRight size={17} />
            </button>
          </form>
        ) : (
          <form className="onboarding-form" onSubmit={handleComplete}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Option A: Built-in Gemini */}
              <div
                onClick={() => setAiMode('builtin')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: aiMode === 'builtin' ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                  background: aiMode === 'builtin' ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '1px solid var(--border-color)',
                    display: 'grid',
                    placeItems: 'center',
                    marginTop: '2px',
                    background: aiMode === 'builtin' ? 'var(--text-primary)' : 'transparent',
                  }}
                >
                  {aiMode === 'builtin' && <Check size={12} style={{ color: 'var(--bg-primary)' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                      StarWaves Built-in AI
                    </strong>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Google Gemini
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Instant & ready to use. Zero configuration needed from you.
                  </p>
                </div>
              </div>

              {/* Option B: BYOK */}
              <div
                onClick={() => setAiMode('byok')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: aiMode === 'byok' ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                  background: aiMode === 'byok' ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '1px solid var(--border-color)',
                    display: 'grid',
                    placeItems: 'center',
                    marginTop: '2px',
                    background: aiMode === 'byok' ? 'var(--text-primary)' : 'transparent',
                  }}
                >
                  {aiMode === 'byok' && <Check size={12} style={{ color: 'var(--bg-primary)' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                      Bring Your Own API Key (BYOK)
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Connect your OpenAI, Claude, Groq, or OpenRouter keys directly.
                  </p>
                </div>
              </div>
            </div>

            {aiMode === 'byok' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
                <label>
                  AI Provider
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    style={{
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      font: 'inherit',
                      fontSize: '13px',
                    }}
                  >
                    {PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Your API Key
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={PROVIDER_OPTIONS.find((p) => p.id === selectedProvider)?.placeholder || 'Enter API Key'}
                      autoComplete="off"
                      required
                      style={{
                        paddingRight: '40px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        padding: '4px',
                      }}
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Keys are stored securely in your private account settings.
                  </span>
                </label>
              </div>
            )}

            {error && <span className="auth-error" role="alert">{error}</span>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setStep(1)
                }}
                style={{
                  width: 'auto',
                  padding: '0 16px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <ArrowLeft size={16} />
              </button>

              <button type="submit" disabled={saving || (aiMode === 'byok' && !apiKey.trim())} style={{ flex: 1 }}>
                {saving ? 'Setting up workspace…' : 'Launch Workspace'}
                {!saving && <ArrowRight size={17} />}
              </button>
            </div>
          </form>
        )}

        <small className="onboarding-footer-text" style={{ marginTop: '16px' }}>
          Signed in as {user?.email}
        </small>
      </section>
    </main>
  )
}
