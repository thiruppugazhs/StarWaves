import { useEffect, useState } from 'react'
import { Bot, Check, Eye, EyeOff, Key, Lock, Save, Loader2 } from 'lucide-react'
import {
  listProviderModels,
  loadAiModels,
  saveAiModelPreference,
} from '../../lib/aiModelsApi'
import { CustomDropdown, SectionHeading, SettingsCard } from '../../components/ui'

export function AiModelsSection() {
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState('default')
  const [selectedModel, setSelectedModel] = useState('default')
  const [assistantName, setAssistantName] = useState('Eve')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [liveModels, setLiveModels] = useState({}) // providerId -> models[]
  const [loadingModels, setLoadingModels] = useState(false)
  const [liveError, setLiveError] = useState('')

  useEffect(() => {
    let active = true
    loadAiModels()
      .then((data) => {
        if (!active) return
        const catalog = data.providers || []
        setProviders(catalog)
        const preference = data.preference || null

        if (preference?.assistant_name) {
          setAssistantName(preference.assistant_name)
        }

        const chosenProviderId = preference?.provider || 'default'
        const matchedProvider = catalog.find((p) => p.id === chosenProviderId) || catalog[0]

        if (matchedProvider) {
          setSelectedProvider(matchedProvider.id)
          const models = matchedProvider.models || []
          if (matchedProvider.id === 'default') {
            setSelectedModel('default')
          } else {
            setSelectedModel(
              models.some((m) => m.id === preference?.model)
                ? preference.model
                : matchedProvider.default_model || models[0]?.id || '',
            )
          }
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const isDefault = selectedProvider === 'default'
  const selectedProviderDescriptor = providers.find(
    (provider) => provider.id === selectedProvider,
  )

  const hasUserKey = Boolean(selectedProviderDescriptor?.has_user_key)

  const providerOptions = providers.map((provider) => ({
    value: provider.id,
    label: provider.label,
  }))

  // Merge live-fetched models (via list API) with catalog models
  const effectiveModels = isDefault
    ? []
    : liveModels[selectedProvider] || selectedProviderDescriptor?.models || []
  const usingLiveModels = Boolean(liveModels[selectedProvider]?.length)

  const modelOptions = isDefault
    ? [{ value: 'default', label: 'Default' }]
    : effectiveModels.map((model) => ({
        value: model.id,
        label: model.label,
      }))

  const modelsHint = loadingModels
    ? 'Fetching models via API…'
    : usingLiveModels
      ? `Which model from the selected provider Eve uses. ${effectiveModels.length} available via provider API.`
      : effectiveModels.length
        ? `Which model from the selected provider Eve uses. ${effectiveModels.length} in catalog.`
        : 'Which model from the selected provider Eve uses.'

  // Live-fetch models via provider API whenever a provider is selected without a
  // typed key — backend resolves the saved user key, then the server env key,
  // then falls back to the static catalog (GET /settings/ai-models/models/{provider}).
  useEffect(() => {
    if (isDefault || apiKey.trim()) return
    let cancelled = false
    setLoadingModels(true)
    setLiveError('')
    listProviderModels(selectedProvider)
      .then((res) => {
        if (cancelled) return
        const models = res.models || []
        if (models.length) {
          setLiveModels((prev) => ({ ...prev, [selectedProvider]: models }))
          setSelectedModel((current) =>
            models.some((m) => m.id === current) ? current : models[0]?.id || current,
          )
        }
      })
      .catch(() => {
        // Static catalog from the loaded providers list remains as fallback
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedProvider, isDefault, apiKey])

  // Live fetch models via provider API when user types a new key (uses /settings/ai-models/models/{provider}?api_key=...)
  useEffect(() => {
    if (isDefault) {
      setLiveError('')
      return
    }
    const key = apiKey.trim()
    if (!key || key.length < 8) {
      setLiveError('')
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoadingModels(true)
      setLiveError('')
      try {
        const res = await listProviderModels(selectedProvider, key)
        if (cancelled) return
        const models = res.models || []
        if (models.length) {
          setLiveModels((prev) => ({ ...prev, [selectedProvider]: models }))
          const ids = new Set(models.map((m) => m.id))
          if (!ids.has(selectedModel)) {
            setSelectedModel(models[0]?.id || selectedModel)
          }
        }
      } catch (e) {
        if (!cancelled) setLiveError(e.message || 'Could not fetch models for this key.')
      } finally {
        if (!cancelled) setLoadingModels(false)
      }
    }, 700)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [selectedProvider, apiKey, isDefault, selectedModel])

  const handleProviderChange = (providerId) => {
    setSelectedProvider(providerId)
    if (providerId === 'default') {
      setSelectedModel('default')
    } else {
      const nextModels = liveModels[providerId] || providers.find((provider) => provider.id === providerId)?.models || []
      const nextProvider = providers.find((provider) => provider.id === providerId)
      setSelectedModel(nextProvider?.default_model || nextModels[0]?.id || '')
    }
    setApiKey('')
    setMessage('')
    setLiveError('')
    setLoadingModels(false)
  }

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId)
    setMessage('')
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!selectedProvider || !selectedModel) {
      setMessage('Pick a provider and a model before saving.')
      return
    }

    // Ollama is local — API key optional (server URL configured via OLLAMA_URL)
    if (!isDefault && selectedProvider !== 'ollama' && !hasUserKey && !apiKey.trim()) {
      setMessage(`Please provide an API key for ${selectedProviderDescriptor?.label || 'the selected provider'}.`)
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const payload = {
        provider: selectedProvider,
        model: isDefault ? 'default' : selectedModel,
        assistant_name: assistantName.trim() || 'Eve',
      }
      if (!isDefault && apiKey.trim()) {
        payload.api_key = apiKey.trim()
      }
      const data = await saveAiModelPreference(payload)
      if (data.providers) {
        setProviders(data.providers)
        const savedProv = data.providers.find((p) => p.id === selectedProvider)
        if (savedProv?.models?.length) {
          setLiveModels((prev) => ({ ...prev, [selectedProvider]: savedProv.models.map((m) => ({ id: m.id, label: m.label })) }))
        }
      }
      setApiKey('')
      setLiveError('')
      setMessage(`AI settings saved. Your assistant (${assistantName.trim() || 'Eve'}) will use this configuration.`)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="setting-section" id="settings-ai-models">
      <SectionHeading
        title="AI models"
        description="Choose which AI provider and model power your EVE assistant."
      />

      <div className="setting-content-stack">
        <SettingsCard
          as="form"
          className="coding-settings-card"
          onSubmit={handleSave}
          icon={<Bot size={18} />}
          title="EVE model provider"
          description="Eve uses this provider and model for chat, scheduled reminders, and voice calls."
        >

          {loading ? (
            <p className="hackathon-source-message" role="status" style={{ padding: '18px 22px' }}>
              Loading AI model options…
            </p>
          ) : providers.length === 0 ? (
            <p className="hackathon-source-message" role="status" style={{ padding: '18px 22px' }}>
              No AI provider available. Add <code>OPENAI_API_KEY</code>,{' '}
              <code>ANTHROPIC_API_KEY</code>, or <code>GEMINI_API_KEY</code> to enable EVE.
            </p>
          ) : (
            <>
              <div className="ai-models-fields">
                <label>
                  <span>
                    <strong>Assistant Name</strong>
                    <small>Name your autonomous AI companion.</small>
                  </span>
                  <input
                    type="text"
                    value={assistantName}
                    onChange={(e) => setAssistantName(e.target.value)}
                    placeholder="e.g. Eve, Jarvis, Aria, Nova"
                    maxLength={32}
                    style={{
                      height: '42px',
                      padding: '0 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      font: 'inherit',
                      fontSize: '13px',
                    }}
                  />
                </label>

                <label>
                  <span>
                    <strong>Provider</strong>
                    <small>Which AI service runs your model.</small>
                  </span>
                  <CustomDropdown
                    value={selectedProvider}
                    options={providerOptions}
                    onChange={handleProviderChange}
                    ariaLabel="AI provider"
                  />
                </label>
                <label>
                  <span>
                    <strong>Model</strong>
                    <small>{modelsHint}</small>
                    {loadingModels && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '11px', color: 'var(--text-muted)' }}>
                        <Loader2 size={12} className="spin" /> Listing models from provider API…
                      </span>
                    )}
                    {liveError && !loadingModels && (
                      <span style={{ display: 'block', marginTop: 4, fontSize: '11px', color: 'var(--text-muted)' }}>{liveError}</span>
                    )}
                  </span>
                  <CustomDropdown
                    value={selectedModel}
                    options={modelOptions}
                    onChange={handleModelChange}
                    ariaLabel="AI model"
                    disabled={isDefault || loadingModels}
                    searchable
                    searchPlaceholder="Search models…"
                  />
                </label>

                {isDefault ? (
                  <div className="ai-models-env-row">
                    <span>
                      <strong>API Key</strong>
                      <small>Provider credentials</small>
                    </span>
                    <div className="ai-models-env-pill">
                      <Lock size={13} />
                      <span>Default</span>
                    </div>
                  </div>
                ) : (
                  <label className="ai-models-key-row">
                    <span>
                      <strong>API Key</strong>
                      <small>
                        {hasUserKey
                          ? `Saved key active. Enter a new key to update.`
                          : `Enter your ${selectedProviderDescriptor?.label || 'provider'} API key.`}
                      </small>
                    </span>
                    <div className="ai-models-key-wrapper">
                      <div className="ai-models-key-input-container">
                        <Key size={14} className="ai-models-key-icon" />
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => {
                            setApiKey(e.target.value)
                            setMessage('')
                          }}
                          placeholder={
                            hasUserKey
                              ? '•••••••••••••••• (API key configured)'
                              : `Enter ${selectedProviderDescriptor?.label || 'API'} key`
                          }
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          className="ai-models-key-toggle"
                          onClick={() => setShowApiKey((prev) => !prev)}
                          aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                        >
                          {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {hasUserKey && (
                        <span className="ai-models-key-status">
                          <Check size={12} /> Key configured
                        </span>
                      )}
                    </div>
                  </label>
                )}
              </div>

              <div className="coding-settings-footer">
                {message && <p role="status">{message}</p>}
                <button type="submit" disabled={saving}>
                  <Save size={15} />
                  {saving ? 'Saving…' : 'Save model'}
                </button>
              </div>
            </>
          )}
        </SettingsCard>
      </div>
    </div>
  )
}