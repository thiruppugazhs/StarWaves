import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Search, Sparkles, X } from 'lucide-react'
import { loadAiModels } from '../../lib/aiModelsApi'

export function ModelSelectorDropdown({
  value,
  activeModel,
  onSelectModel,
  onChange,
  providers: initialProviders,
  direction = 'down',
  className = '',
  placeholder = 'Select model',
  showIcon = true,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [providers, setProviders] = useState(initialProviders || [])
  const [isLoading, setIsLoading] = useState(!initialProviders)
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  // Fetch available providers if not provided via props
  useEffect(() => {
    if (initialProviders) {
      setProviders(initialProviders)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    loadAiModels()
      .then((data) => {
        if (!cancelled && data?.providers) {
          setProviders(data.providers)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [initialProviders])

  // Filter strictly to providers where the user provided an API key or env key is configured
  const configuredProviders = useMemo(() => {
    return (providers || []).filter((p) => Boolean(p.available || p.has_user_key || p.env_configured))
  }, [providers])

  // Filter models based on search query
  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return configuredProviders.map((p) => ({
        ...p,
        filteredModels: p.models || [],
      }))
    }

    return configuredProviders
      .map((p) => {
        const providerMatch = (p.label || p.id).toLowerCase().includes(query)
        const matchedModels = (p.models || []).filter((m) => {
          if (providerMatch) return true
          const labelMatch = (m.label || '').toLowerCase().includes(query)
          const idMatch = (m.id || '').toLowerCase().includes(query)
          return labelMatch || idMatch
        })

        return {
          ...p,
          filteredModels: matchedModels,
        }
      })
      .filter((p) => p.filteredModels.length > 0)
  }, [configuredProviders, searchQuery])

  // Resolve current active model label
  const currentModelId = typeof value === 'string' ? value : activeModel?.model || ''
  const currentProviderId = activeModel?.provider || ''

  const displayLabel = useMemo(() => {
    if (activeModel?.label) return activeModel.label
    for (const p of configuredProviders) {
      const found = (p.models || []).find((m) => m.id === currentModelId)
      if (found) return found.label || found.id
    }
    return currentModelId || placeholder
  }, [activeModel, configuredProviders, currentModelId, placeholder])

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (providerId, modelId, modelLabel) => {
    onSelectModel?.(providerId, modelId, modelLabel)
    onChange?.({ provider: providerId, model: modelId, label: modelLabel, value: modelId })
    setIsOpen(false)
    setSearchQuery('')
  }

  const isUpward = direction === 'up'

  return (
    <div
      ref={dropdownRef}
      className={`model-selector-dropdown ${className} ${isOpen ? 'open' : ''} ${isUpward ? 'direction-up' : 'direction-down'}`}
    >
      <button
        type="button"
        className="model-selector-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={`Current AI Model: ${displayLabel}`}
      >
        {showIcon && <Sparkles size={13} className="model-selector-sparkle" aria-hidden="true" />}
        <span className="model-selector-label">{displayLabel}</span>
        {isUpward ? (
          <ChevronUp size={13} className="model-selector-chevron" aria-hidden="true" />
        ) : (
          <ChevronDown size={13} className="model-selector-chevron" aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div className="model-selector-menu" role="listbox" aria-label="Select AI Model">
          {/* Search Input Bar */}
          <div className="model-selector-search-box">
            <Search size={13} className="model-selector-search-icon" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              className="model-selector-search-input"
              placeholder="Search models…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search models or providers"
            />
            {searchQuery && (
              <button
                type="button"
                className="model-selector-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Model Options List */}
          <div className="model-selector-list">
            {isLoading ? (
              <div className="model-selector-empty">Loading models…</div>
            ) : configuredProviders.length === 0 ? (
              <div className="model-selector-empty">
                <span>No API keys configured yet.</span>
                <small>Add your API key in Settings &rarr; AI Models</small>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="model-selector-empty">No models match &ldquo;{searchQuery}&rdquo;</div>
            ) : (
              filteredGroups.map((provider) => (
                <div key={provider.id} className="model-selector-group">
                  <div className="model-selector-group-label">{provider.label}</div>
                  <div className="model-selector-group-items">
                    {provider.filteredModels.map((m) => {
                      const isSelected =
                        (currentProviderId && provider.id === currentProviderId && m.id === currentModelId) ||
                        m.id === currentModelId

                      return (
                        <button
                          key={`${provider.id}-${m.id}`}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`model-selector-item ${isSelected ? 'active' : ''}`}
                          onClick={() => handleSelect(provider.id, m.id, m.label)}
                        >
                          <span className="model-selector-item-name">{m.label || m.id}</span>
                          {isSelected && <Check size={13} className="model-selector-item-check" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
