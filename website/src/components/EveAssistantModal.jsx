import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bot, Maximize2, Play, Plus, Send, ShieldCheck, X } from 'lucide-react'
import { ConfirmDialog } from './ui/ConfirmDialog'
import {
  createEveSession,
  deleteEveSession,
  getEveSession,
  listEveSessions,
  sendEveMessage,
} from '../lib/eveApi'
import { Markdown } from './ui/Markdown'

const STARTER_MESSAGES = [{
  role: 'assistant',
  content: 'Hi, I\u2019m Eve. I can read, create, update, delete, and restore your workspace records, help with code, and browse or search the open web with @web.',
}]

const EVE_PRESET_PROMPTS = [
  { command: 'web', label: 'Search the web', prompt: 'Search the open web for the latest updates and information on: ', description: 'Browse and search external websites' },
  { command: 'today', label: 'Plan my day', prompt: 'Plan my day by reviewing tasks, upcoming deadlines, and calendar events.', description: 'Review tasks, deadlines, and calendar events' },
  { command: 'tasks', label: 'Manage tasks & overdue', prompt: 'Find all overdue tasks and suggest next priority actions.', description: 'Audit overdue tasks and list priority items' },
  { command: 'projects', label: 'Work with projects', prompt: 'Review project progress, stale projects, and next steps.', description: 'Review project progress and stale projects' },
  { command: 'jobs', label: 'Track applications', prompt: 'Summarize recent job application statuses and upcoming interview dates.', description: 'Find job application status and interview dates' },
  { command: 'documents', label: 'Search documents', prompt: 'Search workspace documents and summarize key notes.', description: 'Search documents and notes' },
  { command: 'calendar', label: 'Check calendar & contests', prompt: 'Look up upcoming calendar events, competitive coding contests, and deadlines.', description: 'Look up events, contests, and deadlines' },
  { command: 'insights', label: 'Workspace overview', prompt: 'Summarize overall workspace dashboard metrics and suggest next actions.', description: 'Generate overall workspace insights' },
]

const EVE_TOOLS_LIST = [
  { command: 'web', name: 'web', label: 'Web Browsing & Search Tool', description: 'Search the open web, browse external websites, and read URLs' },
  { command: 'todos', name: 'todos', label: 'Tasks & Todos Tool', description: 'Read, create, update, or soft-delete task items' },
  { command: 'projects', name: 'projects', label: 'Projects Tool', description: 'Access project repositories, milestones, and status' },
  { command: 'jobs', name: 'jobs', label: 'Job Tracker Tool', description: 'Access job applications, interview dates, and contacts' },
  { command: 'hackathons', name: 'hackathons', label: 'Hackathons Tool', description: 'Access hackathons, schedules, and prize details' },
  { command: 'documents', name: 'documents', label: 'Documents Tool', description: 'Access notes, project plans, and drive specs' },
  { command: 'notifications', name: 'notifications', label: 'Notifications Tool', description: 'Access workspace notifications and reminders' },
  { command: 'search', name: 'search', label: 'Workspace Search Tool', description: 'Search across all local workspace resources' },
  { command: 'insight', name: 'insight', label: 'Workspace Insights Tool', description: 'Compute deadlines, overdue tasks, or dashboard summary' },
]

const MAX_CHARS = 4000
const MAX_PREVIEW_LENGTH = 60

function previewFor(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const content = messages[index].content
    if (content) {
      return content.length > MAX_PREVIEW_LENGTH
        ? `${content.slice(0, MAX_PREVIEW_LENGTH - 1).trimEnd()}\u2026`
        : content
    }
  }
  return 'New chat'
}

export function EveAssistantModal({ isOpen, onClose, onNavigate, onWorkspaceChanged }) {
  const [messages, setMessages] = useState(STARTER_MESSAGES)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isWide, setIsWide] = useState(false)
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const [promptQueue, setPromptQueue] = useState([])
  const panelRef = useRef(null)
  const composerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  /* Auto-scroll when messages change or typing indicator shows */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  /* Load saved sessions when the panel opens */
  useEffect(() => {
    if (!isOpen) return undefined

    let cancelled = false
    setIsLoadingSessions(true)
    setError('')
    listEveSessions()
      .then(({ sessions: savedSessions }) => {
        if (cancelled) return
        setSessions(savedSessions)
        if (savedSessions.length) {
          setActiveSessionId(savedSessions[0].id)
          return getEveSession(savedSessions[0].id)
        }
        return null
      })
      .then((session) => {
        if (!cancelled) {
          setMessages(session?.messages || STARTER_MESSAGES)
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSessions(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen])

  /* Focus management, body lock, and Escape key */
  useEffect(() => {
    if (!isOpen) return undefined

    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    window.requestAnimationFrame(() => {
      panelRef.current?.querySelector('[data-eve-initial-focus]')?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [isOpen, onClose])

  const startNewChat = () => {
    if (isSending) return
    setError('')
    setActiveSessionId(null)
    setMessages(STARTER_MESSAGES)
    setDraft('')
    setPromptQueue([])
  }

  const selectSession = async (sessionId) => {
    if (sessionId === activeSessionId || isSending) return
    setError('')
    setActiveSessionId(sessionId)
    try {
      const session = await getEveSession(sessionId)
      setMessages(session?.messages || STARTER_MESSAGES)
      setDraft('')
      setPromptQueue([])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const confirmDeleteSession = async () => {
    const sessionId = sessionToDelete?.id
    setSessionToDelete(null)
    if (!sessionId) return
    try {
      await deleteEveSession(sessionId)
    } catch (requestError) {
      setError(requestError.message)
      return
    }
    const remaining = sessions.filter((session) => session.id !== sessionId)
    setSessions(remaining)
    if (sessionId !== activeSessionId) return
    if (remaining.length) {
      const nextSession = remaining[0]
      setActiveSessionId(nextSession.id)
      try {
        const session = await getEveSession(nextSession.id)
        setMessages(session?.messages || STARTER_MESSAGES)
      } catch {
        setMessages(STARTER_MESSAGES)
      }
    } else {
      setActiveSessionId(null)
      setMessages(STARTER_MESSAGES)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const content = draft.trim()
    if (!content) return
    if (isSending) {
      setPromptQueue((current) => [...current, content])
      setDraft('')
      return
    }
    setError('')
    setIsSending(true)
    try {
      await sendPrompt(content, messages, activeSessionId)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSending(false)
    }
  }

  const sendPrompt = async (content, baseMessages, sessionIdOverride = null) => {
    const nextMessages = [...baseMessages, { role: 'user', content }]
    setMessages(nextMessages)
    setDraft('')
    setError('')
    let nextSessionId = sessionIdOverride
    let sessionTitle = sessions.find((session) => session.id === nextSessionId)?.title ?? 'New chat'
    if (!nextSessionId) {
      const created = await createEveSession(nextMessages)
      nextSessionId = created.session.id
      sessionTitle = created.session.title
      setActiveSessionId(nextSessionId)
      setSessions((current) => [
        { id: nextSessionId, title: sessionTitle, updated_at: created.session.updated_at, preview: previewFor(nextMessages) },
        ...current,
      ])
    }
    const response = await sendEveMessage(nextMessages, nextSessionId)
    const assistantMessage = { role: 'assistant', content: response.message }
    const finalMessages = [...nextMessages, assistantMessage]
    setMessages(finalMessages)
    setSessions((current) => [
      { id: nextSessionId, title: sessionTitle, updated_at: new Date().toISOString(), preview: previewFor(finalMessages) },
      ...current.filter((session) => session.id !== nextSessionId),
    ])
    if (response.changed_resources.length) onWorkspaceChanged()
    handleActions(response.actions ?? [])
    return { messages: finalMessages, sessionId: nextSessionId }
  }

  const removeFromQueue = (index) => {
    setPromptQueue((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const clearQueue = () => {
    setPromptQueue([])
  }

  const runQueue = async () => {
    if (isSending || !promptQueue.length) return
    const queuedPrompts = [...promptQueue]
    setPromptQueue([])
    setError('')
    setIsSending(true)
    let conversation = messages
    let nextSessionId = activeSessionId
    try {
      for (const prompt of queuedPrompts) {
        const result = await sendPrompt(prompt, conversation, nextSessionId)
        conversation = result.messages
        nextSessionId = result.sessionId
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSending(false)
    }
  }

  const handleActions = (actions) => {
    actions.forEach((action) => {
      if (action.type === 'navigate_page') {
        onNavigate?.(action.page)
      } else if (action.type === 'open_record') {
        if (action.page === 'project-detail') onNavigate?.('project-detail', action.projectId)
        if (action.page === 'document-opener') onNavigate?.('document-opener', null, action.documentId)
      } else if (action.type === 'refresh_workspace_data') {
        onWorkspaceChanged()
      } else if (action.type === 'apply_ui_overrides' || action.type === 'reset_ui') {
        if (action.preferences) window.dispatchEvent(new CustomEvent('eve-ui-update', { detail: { preferences: action.preferences } }))
      } else if (action.type === 'open_custom_page' && action.slug) {
        if (action.preferences) window.dispatchEvent(new CustomEvent('eve-ui-update', { detail: { preferences: action.preferences } }))
        onNavigate?.(`custom-${action.slug}`)
      }
    })
  }

  const isTypingTool = draft.startsWith('@') && !draft.includes(' ')
  const toolQuery = isTypingTool ? draft.slice(1).toLowerCase() : ''
  const matchingTools = isTypingTool
    ? EVE_TOOLS_LIST.filter((tool) =>
        `${tool.command} ${tool.label} ${tool.name}`.toLowerCase().includes(toolQuery),
      )
    : []

  const isTypingPrompt = draft.startsWith('/') && !draft.includes(' ')
  const promptQuery = isTypingPrompt ? draft.slice(1).toLowerCase() : ''
  const matchingPrompts = isTypingPrompt
    ? EVE_PRESET_PROMPTS.filter((item) =>
        `${item.command} ${item.label}`.toLowerCase().includes(promptQuery),
      )
    : []

  const selectTool = (tool) => {
    setDraft(`@${tool.command} `)
    composerRef.current?.focus()
  }

  const selectPrompt = (item) => {
    setDraft(item.prompt)
    composerRef.current?.focus()
  }

  const hasUserMessages = (messages || []).some((msg) => msg?.role === 'user')
  const charProgress = draft.length / MAX_CHARS

  if (!isOpen) return null

  return (
    <>
      {createPortal(
        <div className="eve-panel-backdrop" onMouseDown={onClose} role="presentation">
          <aside
            ref={panelRef}
            className={`eve-assistant-panel ${isWide ? 'wide' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            data-dialog-managed="true"
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* ── Header ── */}
            <header className="eve-panel-header">
              <div className="eve-panel-heading">
                <div className="eve-avatar" aria-hidden="true"><Bot size={22} /></div>
                <div>
                  <h2 id={titleId}>Eve</h2>
                  <p id={descriptionId}>AI workspace assistant</p>
                </div>
              </div>
              <div className="eve-panel-controls">
                <span className="eve-status"><span className="eve-status-dot" />Connected</span>
                <button className="icon-button" type="button" onClick={() => setIsWide((wide) => !wide)} aria-label={isWide ? 'Reduce Eve assistant width' : 'Expand Eve assistant'}>
                  <Maximize2 size={16} />
                </button>
                <button className="icon-button" type="button" onClick={onClose} aria-label="Close Eve assistant" data-eve-initial-focus>
                  <X size={16} />
                </button>
              </div>
            </header>

            {/* ── Sessions Bar ── */}
            <div className="eve-sessions-bar" aria-label="Eve conversations">
              <button
                className={`eve-session-new ${activeSessionId === null ? 'active' : ''}`}
                type="button"
                onClick={startNewChat}
                aria-pressed={activeSessionId === null}
              >
                <Plus size={14} />
                <span>New chat</span>
              </button>
              <div className="eve-session-tabs" role="tablist" aria-label="Saved Eve conversations">
                {isLoadingSessions ? (
                  <span className="eve-session-loading">Loading conversations…</span>
                ) : (
                  sessions.map((session) => (
                    <div
                      className={`eve-session-tab ${session.id === activeSessionId ? 'active' : ''}`}
                      key={session.id}
                    >
                      <button
                        className="eve-session-tab-select"
                        type="button"
                        role="tab"
                        aria-selected={session.id === activeSessionId}
                        onClick={() => selectSession(session.id)}
                        title={session.title}
                      >
                        <span>{session.title}</span>
                      </button>
                      <button
                        className="eve-session-tab-delete"
                        type="button"
                        onClick={() => setSessionToDelete(session)}
                        aria-label={`Delete conversation ${session.title}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── Context Banner ── */}
            <div className="eve-context-banner" aria-label="Eve workspace access">
              <ShieldCheck size={14} />
              <span>Private workspace access — your integrations and secrets stay protected.</span>
            </div>

            {/* ── Conversation Body ── */}
            <div className="eve-panel-body">
              <div className="eve-messages" aria-live="polite" aria-label="Eve conversation">
                {messages.map((message, index) => (
                  <div className={`eve-message ${message.role}`} key={`${message.role}-${index}`}>
                    {message.role === 'assistant' ? (
                      <div className="eve-message-md">
                        <Markdown content={message.content} />
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                ))}
                {isSending && (
                  <div className="eve-message assistant">
                    <p>
                      <span className="eve-typing-dots" aria-label="Eve is thinking">
                        <span /><span /><span />
                      </span>
                    </p>
                  </div>
                )}
                {error && <p className="eve-error" role="alert">{error}</p>}
                {!hasUserMessages && (
                  <div className="eve-suggestion-chips">
                    {EVE_PRESET_PROMPTS.map((item) => (
                      <button className="eve-chip" type="button" key={item.command} onClick={() => selectPrompt(item)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>
            </div>

            {/* ── Composer ── */}
            <form className="eve-composer" onSubmit={handleSubmit}>
              {promptQueue.length > 0 && (
                <div className="eve-queue-strip" aria-label="Queued messages">
                  <div className="eve-queue-list">
                    {promptQueue.map((queuedPrompt, index) => (
                      <span className="eve-queue-item" key={`${queuedPrompt}-${index}`}>
                        <span className="eve-queue-item-text">{queuedPrompt}</span>
                        <button
                          className="eve-queue-item-remove"
                          type="button"
                          onClick={() => removeFromQueue(index)}
                          aria-label="Remove queued message"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <button className="eve-queue-clear" type="button" onClick={clearQueue}>
                    Clear queue
                  </button>
                </div>
              )}
              <div className="eve-composer-field">
                <label className="eve-composer-label" htmlFor="eve-message">Message Eve</label>

                {draft.startsWith('@') && matchingTools.length > 0 && (
                  <div className="eve-skills-menu" role="listbox" aria-label="Eve tools">
                    <div className="eve-skills-heading">Tools & Resources <span>Use @ to reference</span></div>
                    {matchingTools.map((tool) => (
                      <button className="eve-skill-option" type="button" role="option" key={tool.command} onClick={() => selectTool(tool)}>
                        <span className="eve-skill-command">@{tool.command}</span>
                        <span><strong>{tool.label}</strong><small>{tool.description}</small></span>
                      </button>
                    ))}
                  </div>
                )}

                {draft.startsWith('/') && matchingPrompts.length > 0 && (
                  <div className="eve-skills-menu" role="listbox" aria-label="Eve pre-saved prompts">
                    <div className="eve-skills-heading">Pre-saved Prompts <span>Use / to filter</span></div>
                    {matchingPrompts.map((item) => (
                      <button className="eve-skill-option" type="button" role="option" key={item.command} onClick={() => selectPrompt(item)}>
                        <span className="eve-skill-command">/{item.command}</span>
                        <span><strong>{item.label}</strong><small>{item.description}</small></span>
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  ref={composerRef}
                  id="eve-message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && (draft.startsWith('@') || draft.startsWith('/'))) {
                      event.preventDefault()
                      setDraft('')
                    } else if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                  placeholder="Ask anything… Type @ for tools or / for prompts"
                  rows="2"
                  maxLength={MAX_CHARS}
                />
                <div className="eve-composer-footer">
                  <span className="eve-composer-hint">{isSending ? '⏎ to queue' : '⏎ to send'}</span>
                  <div className="eve-composer-actions">
                    {promptQueue.length > 0 && (
                      <button className="eve-queue-run" type="button" onClick={runQueue} disabled={isSending}>
                        <Play size={13} />
                        Run queue ({promptQueue.length})
                      </button>
                    )}
                    <button className="eve-send-button" type="submit" disabled={!draft.trim()} aria-label={isSending ? 'Queue message' : 'Send message'}>
                      <Send size={15} />
                    </button>
                  </div>
                </div>
                <div className="eve-char-bar" style={{ '--char-progress': charProgress }} />
              </div>
            </form>
          </aside>
        </div>,
        document.body,
      )}
      <ConfirmDialog
        isOpen={Boolean(sessionToDelete)}
        title="Delete Eve conversation"
        message={`Delete "${sessionToDelete?.title ?? ''}"? This conversation will be permanently removed.`}
        confirmLabel="Delete conversation"
        onConfirm={confirmDeleteSession}
        onCancel={() => setSessionToDelete(null)}
      />
    </>
  )
}

