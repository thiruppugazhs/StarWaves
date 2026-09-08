import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  Info,
  Loader2,
  Wrench,
} from 'lucide-react'
import { Markdown } from '../../components/ui/Markdown'
import { formatFileSize } from '../../utils/fileSize'
import { EveThoughtHistory } from './EveThoughtHistory'

export function EveMessageFeed({
  messages,
  draft = '',
  isSending,
  streamText = '',
  thinkingText = '',
  toolCalls = [],
  activeTool = null,
  error,
  EVE_PRESET_PROMPTS,
  selectPrompt,
}) {
  const messagesEndRef = useRef(null)
  const [streamThoughtOpen, setStreamThoughtOpen] = useState(true)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending, streamText, thinkingText, toolCalls, activeTool])

  useEffect(() => {
    if (isSending && thinkingText) setStreamThoughtOpen(true)
  }, [isSending, thinkingText])

  return (
    <div className="eve-messages-feed" role="log" aria-live="polite" aria-label="Eve AI conversation feed">
      {messages.map((msg, index) => (
        <div key={index} className={`eve-chat-bubble ${msg.role}`}>
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="eve-bubble-attachments">
              {msg.attachments.map((att) => (
                <div key={att.id} className="eve-bubble-attachment-card">
                  {att.isImage && att.dataUrl ? (
                    <img src={att.dataUrl} alt={att.name} className="eve-bubble-attachment-thumb" />
                  ) : (
                    <div className="eve-bubble-attachment-icon-box">
                      <FileText size={14} />
                    </div>
                  )}
                  <div className="eve-bubble-attachment-meta">
                    <span className="eve-bubble-attachment-name" title={att.name}>{att.name}</span>
                    <span className="eve-bubble-attachment-size">{formatFileSize(att.size)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {msg.role === 'assistant' && msg.thinking && (
            <EveThoughtHistory thinking={msg.thinking} />
          )}
          {msg.role === 'assistant' && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
            <div className="eve-tool-calls-container">
              {msg.toolCalls.map((tc) => (
                <span key={tc.id || tc.name} className={`eve-tool-chip ${tc.status === 'running' ? 'running' : ''}`}>
                  {tc.status === 'done' ? <Check size={11} className="eve-tool-check" /> : <Wrench size={11} />}
                  <span className="eve-tool-chip-name">{tc.name}</span>
                  {tc.arguments && typeof tc.arguments === 'object' ? (
                    <span className="eve-tool-chip-args">{JSON.stringify(tc.arguments).slice(0, 80)}</span>
                  ) : tc.arguments ? (
                    <span className="eve-tool-chip-args">{String(tc.arguments).slice(0, 80)}</span>
                  ) : null}
                </span>
              ))}
            </div>
          )}
          {msg.role === 'assistant' ? (
            <div className="eve-bubble-text eve-bubble-markdown">
              <Markdown content={msg.content} />
            </div>
          ) : (
            msg.content && <p className="eve-bubble-text">{msg.content}</p>
          )}
        </div>
      ))}

      {isSending && (
        <div className="eve-chat-bubble assistant sending" aria-live="polite" aria-busy="true">
          {thinkingText ? (
            <div className={`eve-thought-container live ${streamThoughtOpen ? 'open' : 'collapsed'}`}>
              <button
                type="button"
                className="eve-thought-header"
                onClick={() => setStreamThoughtOpen((v) => !v)}
                aria-expanded={streamThoughtOpen}
                aria-label={streamThoughtOpen ? 'Collapse thinking' : 'Expand thinking'}
              >
                <span className="eve-thought-header-left">
                  <Eye size={13} className={isSending && !streamText ? 'pulse' : ''} />
                  <span>{streamText ? 'Thought' : 'Thinking…'}</span>
                  {!streamThoughtOpen && thinkingText ? (
                    <span className="eve-thought-preview">{thinkingText.slice(0, 64).replace(/\n/g, ' ')}…</span>
                  ) : null}
                </span>
                <span className="eve-thought-toggle" aria-hidden="true">
                  {streamThoughtOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </span>
              </button>
              {streamThoughtOpen && (
                <div className="eve-thought-content eve-thought-stream">
                  <span className="eve-thought-stream-text">{thinkingText}</span>
                  {!streamText && <span className="eve-thinking-cursor" aria-hidden="true" />}
                </div>
              )}
            </div>
          ) : null}

          {toolCalls.length > 0 && (
            <div className="eve-tool-calls-container eve-tool-calls-live">
              {toolCalls.map((tc) => (
                <span key={tc.id} className={`eve-tool-chip ${tc.status === 'running' ? 'running' : ''}`}>
                  {tc.status === 'done' ? <Check size={11} className="eve-tool-check" /> : <Loader2 size={11} className="spin" />}
                  <span className="eve-tool-chip-name">{tc.name}</span>
                  {tc.arguments ? (
                    <span className="eve-tool-chip-args">
                      {typeof tc.arguments === 'object' ? JSON.stringify(tc.arguments).slice(0, 60) : String(tc.arguments).slice(0, 60)}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          )}

          {streamText ? (
            <div className="eve-bubble-text eve-bubble-markdown eve-streaming-text">
              <Markdown content={streamText} />
              {thinkingText && <span className="eve-streaming-thinking">Thinking…</span>}
            </div>
          ) : activeTool ? (
            <div className="eve-tool-activity" role="status">
              <Loader2 size={13} className="spin" />
              <Wrench size={12} />
              <span>Using tool: {activeTool}…</span>
            </div>
          ) : thinkingText ? (
            <div className="eve-bubble-text eve-streaming-thinking-bubble" role="status">
              Thinking…
            </div>
          ) : !thinkingText ? (
            <div className="eve-typing-indicator" aria-label="Eve is thinking">
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </div>
      )}

      {error && (() => {
        const isRate = /rate limit/i.test(error)
        const isAuth = /authentication|api key/i.test(error)
        const isModel = /model.*not found/i.test(error)
        const Icon = isRate ? Clock : Info
        const hint = isRate
          ? ' — please wait a moment, then retry or try a different model.'
          : isAuth
            ? ' — check Settings → AI Models.'
            : isModel
              ? ' — pick an available model in Settings.'
              : ''
        return (
          <div className={`eve-error-banner ${isRate ? 'eve-error-banner--rate' : isAuth ? 'eve-error-banner--auth' : ''}`} role="alert">
            <Icon size={16} />
            <span>{error}{hint}</span>
          </div>
        )
      })()}

      {messages.length <= 1 && !draft?.trim() && (
        <div className="eve-starter-prompts">
          <p className="eve-starter-title">Quick prompts to get started:</p>
          <div className="eve-starter-grid">
            {EVE_PRESET_PROMPTS.slice(0, 6).map((item) => (
              <button
                key={item.command}
                type="button"
                className="eve-starter-chip"
                onClick={() => selectPrompt(item)}
              >
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
