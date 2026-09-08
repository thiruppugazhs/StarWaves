import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Paperclip, Plus, X, Zap } from 'lucide-react'
import { CustomDropdown } from '../../components/ui/CustomDropdown'
import { ModelSelectorDropdown } from '../../components/ui/ModelSelectorDropdown'
import { formatFileSize } from '../../utils/fileSize'
import { PROMPT_SUGGESTIONS } from './studioConstants'

const PROMPT_TEXTAREA_MAX_HEIGHT = 160
const TEXT_EXTENSION_PATTERN = /\.(txt|md|json|js|jsx|ts|tsx|html|css|py|csv|xml|yaml|yml|sql|sh|log|rs|go|java|c|cpp|h)$/i
const ATTACHMENT_TEXT_MAX_LENGTH = 40000

const MODE_OPTIONS = [
  { value: 'plan', label: 'Plan' },
  { value: 'build', label: 'Build' },
]

export function StudioHero({
  isSubmitting,
  onSubmitPrompt,
}) {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState('plan')
  const [model, setModel] = useState('openrouter/free')
  const [attachments, setAttachments] = useState([])
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, PROMPT_TEXTAREA_MAX_HEIGHT)}px`
  }, [prompt])

  const canSubmit = prompt.trim().length > 0 && !isSubmitting

  const handleAddFiles = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    files.forEach((file) => {
      const meta = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
      }
      const isText = file.type.startsWith('text/') || TEXT_EXTENSION_PATTERN.test(file.name)
      if (!isText) {
        setAttachments((prev) => [...prev, meta])
        return
      }
      file
        .text()
        .then((text) => {
          const truncated = text.length > ATTACHMENT_TEXT_MAX_LENGTH
            ? `${text.slice(0, ATTACHMENT_TEXT_MAX_LENGTH)}\n\n[...truncated]`
            : text
          setAttachments((prev) => [...prev, { ...meta, textContent: truncated }])
        })
        .catch(() => {
          setAttachments((prev) => [...prev, meta])
        })
    })
    textareaRef.current?.focus()
  }

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((file) => file.id !== id))
  }

  const handleSubmit = async (event) => {
    event?.preventDefault?.()
    if (!canSubmit) return
    try {
      await onSubmitPrompt(prompt.trim(), mode, model, attachments)
      setPrompt('')
      setAttachments([])
    } catch {
      // Failure feedback is handled by parent
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit(event)
    }
  }

  const handleSuggestionClick = (suggestionPrompt) => {
    setPrompt(suggestionPrompt)
    textareaRef.current?.focus()
  }

  return (
    <section className="studio-hero">
      <div className="studio-hero-glow" aria-hidden="true" />
      <div className="studio-hero-gradient studio-hero-gradient-primary" aria-hidden="true" />
      <div className="studio-hero-gradient studio-hero-gradient-secondary" aria-hidden="true" />

      <div className="studio-hero-content">
        <h1 className="studio-hero-title">
          What will you build?
        </h1>

        <form className="studio-prompt-card" onSubmit={handleSubmit}>
          {attachments.length > 0 && (
            <div className="studio-prompt-attachments" aria-label="Attached files">
              {attachments.map((file) => (
                <span key={file.id} className="studio-prompt-attachment-chip">
                  <Paperclip size={12} aria-hidden="true" />
                  <span className="studio-prompt-attachment-name" title={file.name}>{file.name}</span>
                  <span className="studio-prompt-attachment-size">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    className="studio-prompt-attachment-remove"
                    onClick={() => removeAttachment(file.id)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="studio-prompt-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'build'
                ? 'Build directly: e.g. SaaS dashboard with metrics, billing table, and dark mode…'
                : 'Describe your vision — Eve will ask questions and draft the architecture…'
            }
            rows={2}
            aria-label="Describe the app you want to build"
          />
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleAddFiles} />
          <div className="studio-prompt-row">
            <button
              type="button"
              className="studio-prompt-attach"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={14} aria-hidden="true" />
              Add files
            </button>
            <div className="studio-prompt-tools">
              <ModelSelectorDropdown
                className="studio-prompt-mode"
                value={model}
                onChange={(m) => setModel(m.model || m.value)}
                direction="up"
                placeholder="Model"
              />
              <CustomDropdown
                className="studio-prompt-mode"
                value={mode}
                options={MODE_OPTIONS}
                onChange={setMode}
                ariaLabel="Plan or Build mode"
              />
              <button
                type="submit"
                className={`studio-prompt-submit ${isSubmitting ? 'loading' : ''}`}
                disabled={!canSubmit}
                aria-label="Create project from prompt"
                title="Create project (Enter)"
              >
                {isSubmitting ? <Zap size={15} aria-hidden="true" /> : <ArrowUp size={17} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </form>

        <div className="studio-suggestions" aria-label="Prompt suggestions">
          <span className="studio-suggestions-label">Try asking:</span>
          {PROMPT_SUGGESTIONS.map((item) => (
            <button
              key={item.label}
              type="button"
              className="studio-suggestion-chip"
              onClick={() => handleSuggestionClick(item.prompt)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
