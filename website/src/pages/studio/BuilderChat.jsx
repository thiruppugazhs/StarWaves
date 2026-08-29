import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Mic, Paperclip, Plus, Sparkles, X } from 'lucide-react'
import { ModelSelectorDropdown } from '../../components/ui/ModelSelectorDropdown'
import { Markdown } from '../../components/ui/Markdown'
import { createEveSession, sendEveMessage } from '../../lib/eveApi'
import { formatFileSize } from '../../utils/fileSize'
import { composeBriefText, takeStudioBrief } from './studioBrief'
import { QuestionCard } from './QuestionCard'
import { parseQuestionsFromMessage } from './questionUtils'

const CHAT_SESSION_KEY_PREFIX = 'starwaves.studio.chat_session.'
const TEXT_EXTENSION_PATTERN = /\.(txt|md|json|js|jsx|ts|tsx|html|css|py|csv|xml|yaml|yml|sql|sh|log|rs|go|java|c|cpp|h)$/i
const ATTACHMENT_TEXT_MAX_LENGTH = 40000

function isPlanMessage(content) {
  if (!content || typeof content !== 'string') return false
  return (
    /(awaiting (?:your )?approval|click Approve|approve (?:the|this) plan|review the (?:build )?plan|submitted and is awaiting|let me know when you'?ve approved)/i.test(content) ||
    (/(### Architecture|### Proposed Files|### Build Plan)/i.test(content) && /(approve|proceed|ready to build)/i.test(content))
  )
}

function loadSessionId(projectId) {
  try {
    return localStorage.getItem(CHAT_SESSION_KEY_PREFIX + projectId)
  } catch {
    return null
  }
}

function storeSessionId(projectId, sessionId) {
  try {
    localStorage.setItem(CHAT_SESSION_KEY_PREFIX + projectId, sessionId)
  } catch {
    // localStorage unavailable
  }
}

export function BuilderChat({ projectId, projectName, onActions, onAssistantReply }) {
  const starter = {
    role: 'assistant',
    content: `Hi! I'm Eve. Tell me what to build or change in **${projectName}** — I'll plan the architecture, and after your approval, I'll write the code.`,
  }
  const [messages, setMessages] = useState(() => [starter])
  const [draft, setDraft] = useState('')
  const [selectedModel, setSelectedModel] = useState('gpt-5-mini')
  const [attachments, setAttachments] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const feedEndRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const brief = takeStudioBrief(projectId)
    if (brief?.model) {
      setSelectedModel(brief.model)
    }
    const isBuild = brief?.mode === 'build'
    const dynamicStarter = {
      role: 'assistant',
      content: isBuild
        ? `Hi! I'm Eve. **Build Mode** is active for **${projectName}** — I will generate the architecture and build the project files directly in one go.`
        : `Hi! I'm Eve. **Plan Mode** is active for **${projectName}** — I will analyze requirements, ask clarifying questions, and propose an architecture plan for your approval before building.`,
    }
    setMessages([dynamicStarter])
    setDraft(brief ? composeBriefText(brief.prompt, brief.attachments, brief.mode) : '')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`
  }, [draft])

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
    event?.preventDefault()
    let content = draft.trim()
    if (attachments.length > 0) {
      content = composeBriefText(content, attachments)
    }
    if (!content || isSending) return

    setDraft('')
    setAttachments([])
    setError('')
    setIsSending(true)
    const nextMessages = [...messages, { role: 'user', content }]
    setMessages(nextMessages)

    try {
      let sessionId = loadSessionId(projectId)
      if (!sessionId) {
        const created = await createEveSession(nextMessages)
        sessionId = created.session.id
        storeSessionId(projectId, sessionId)
      }
      const apiMessages = nextMessages.map(({ role, content: text }) => ({ role, content: text }))
      const response = await sendEveMessage(apiMessages, sessionId)
      setMessages([...nextMessages, { role: 'assistant', content: response.message }])
      onActions?.(response.actions)
      onAssistantReply?.()
    } catch (sendError) {
      setError(sendError.message || 'Eve could not respond. Try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleSendDirectly = async (text) => {
    if (!text || isSending) return
    setError('')
    setIsSending(true)
    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)

    try {
      let sessionId = loadSessionId(projectId)
      if (!sessionId) {
        const created = await createEveSession(nextMessages)
        sessionId = created.session.id
        storeSessionId(projectId, sessionId)
      }
      const apiMessages = nextMessages.map(({ role, content: msgText }) => ({ role, content: msgText }))
      const response = await sendEveMessage(apiMessages, sessionId)
      setMessages([...nextMessages, { role: 'assistant', content: response.message }])
      onActions?.(response.actions)
      onAssistantReply?.()
    } catch (sendError) {
      setError(sendError.message || 'Eve could not respond. Try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="builder-chat" aria-label="Eve builder chat">
      <div className="builder-chat-header">
        <div className="builder-chat-model">
          <Sparkles size={14} className="builder-chat-sparkle" aria-hidden="true" />
          <span>Eve</span>
        </div>
        <ModelSelectorDropdown
          className="builder-model-dropdown"
          value={selectedModel}
          onChange={(m) => setSelectedModel(m.model || m.value)}
        />
      </div>

      <div className="builder-chat-feed" role="log" aria-live="polite">
        {messages.map((message, index) => {
          const isLatestAssistant = message.role === 'assistant' && index === messages.length - 1
          const questions = isLatestAssistant && !isSending ? parseQuestionsFromMessage(message.content) : []
          const showPlanApproval = isLatestAssistant && !isSending && questions.length === 0 && isPlanMessage(message.content)

          return (
            <div key={index} className={`eve-chat-bubble ${message.role}`}>
              {message.role === 'assistant' ? (
                <div className="eve-bubble-text eve-bubble-markdown">
                  <Markdown content={message.content} />
                  {questions.length > 0 && (
                    <QuestionCard
                      questions={questions}
                      onAnswerSingle={(ans) => handleSendDirectly(ans)}
                      onAnswerAll={(answersText) => handleSendDirectly(answersText)}
                    />
                  )}
                  {showPlanApproval && (
                    <div className="studio-plan-inline-card" aria-label="Plan awaiting approval">
                      <div className="studio-plan-inline-header">
                        <Sparkles size={13} className="studio-plan-inline-icon" aria-hidden="true" />
                        <span>Build Plan Ready for Approval</span>
                      </div>
                      <p className="studio-plan-inline-sub">
                        Review the architecture above. Approve to let Eve generate the files and build the app.
                      </p>
                      <div className="studio-plan-inline-actions">
                        <button
                          type="button"
                          className="secondary-button studio-plan-inline-reject"
                          onClick={() => {
                            setDraft('Please revise the plan: ')
                            textareaRef.current?.focus()
                          }}
                        >
                          <X size={13} />
                          <span>Request Changes</span>
                        </button>
                        <button
                          type="button"
                          className="primary-button studio-plan-inline-approve"
                          onClick={() =>
                            handleSendDirectly('I approve this plan. Please generate the code and build all project files now.')
                          }
                        >
                          <Check size={14} />
                          <span>Approve &amp; Build</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                message.content && <p className="eve-bubble-text">{message.content}</p>
              )}
            </div>
          )
        })}
        {isSending && (
          <div className="eve-chat-bubble assistant sending">
            <div className="eve-typing-indicator" aria-label="Eve is thinking">
              <span /><span /><span />
            </div>
          </div>
        )}
        {error && <p className="studio-form-error" role="alert">{error}</p>}
        <div ref={feedEndRef} />
      </div>

      <form className="builder-chat-composer" onSubmit={handleSubmit}>
        {attachments.length > 0 && (
          <div className="studio-prompt-attachments builder-attachments-row" aria-label="Attached files">
            {attachments.map((file) => (
              <span key={file.id} className="studio-prompt-attachment-chip">
                <Paperclip size={11} aria-hidden="true" />
                <span className="studio-prompt-attachment-name" title={file.name}>{file.name}</span>
                <span className="studio-prompt-attachment-size">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  className="studio-prompt-attachment-remove"
                  onClick={() => removeAttachment(file.id)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="builder-composer-box">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder="Make changes, add new features, ask for anything…"
            rows={1}
            aria-label="Message to Eve"
          />
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleAddFiles} />
          <div className="builder-composer-toolbar">
            <div className="builder-composer-tools">
              <button
                type="button"
                className="builder-composer-icon-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Add files"
                aria-label="Add files"
              >
                <Plus size={15} />
              </button>
              <button
                type="button"
                className="builder-composer-icon-btn"
                onClick={() => {}}
                title="Voice input"
                aria-label="Voice input"
              >
                <Mic size={14} />
              </button>
            </div>
            <button
              type="submit"
              className="builder-chat-submit"
              disabled={(!draft.trim() && attachments.length === 0) || isSending}
              aria-label="Send message to Eve"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
