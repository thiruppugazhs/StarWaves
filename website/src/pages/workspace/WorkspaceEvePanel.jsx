import '../../styles/pages/workspace-eve.css'
import { useEffect, useRef, useState } from 'react'
import { Bot, Send, PanelRightClose, PanelRightOpen, Square, Wrench } from 'lucide-react'
import { ModelSelectorDropdown } from '../../components/ui/ModelSelectorDropdown'
import { useEveAgentChat } from './useEveAgentChat'
import { EveInlineAvatar } from '../../components/eve/avatar/EveInlineAvatar'
import { useEveAvatar } from '../../components/eve/avatar/EveAvatarProvider'
import { useThemeCustomizer } from '../../hooks/useThemeCustomizer'

export function WorkspaceEvePanel({
  collapsed,
  onToggle,
  workspaceId,
  workspaceName,
  activeFilePath,
  onFilesChanged,
  onAction,
}) {
  const { messages, sending, streamText, thinkingText, activeTool, error, send, stop } = useEveAgentChat({
    workspaceId,
    workspaceName,
    activeFilePath,
    onFilesChanged,
    onAction,
  })
  const [draft, setDraft] = useState('')
  const chatRef = useRef(null)
  const { prefs: avatarPrefs, activeModel: avatarModel } = useEveAvatar()
  const { activePreset } = useThemeCustomizer() || {}
  const [selectedModel, setSelectedModel] = useState({ provider: 'openrouter', model: 'openrouter/free' })

  useEffect(() => {
    const node = chatRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, streamText, thinkingText, activeTool])

  if (collapsed) {
    return (
      <div className="workspace-eve-collapsed">
        {avatarPrefs?.enabled !== false && (
          <div className="workspace-eve-micro-avatar" aria-hidden="true">
            <EveInlineAvatar
              size="sm"
              presetId={activePreset}
              prefs={avatarPrefs}
              activeModel={avatarModel}
              isEveSpeaking={sending}
              isSending={sending}
              streamText={streamText}
              activeTool={activeTool}
            />
          </div>
        )}
        <button
          className="workspace-eve-toggle"
          onClick={onToggle}
          title="Open Eve panel"
          aria-label="Open Eve panel"
        >
          <PanelRightOpen size={16} />
        </button>
      </div>
    )
  }

  const submit = () => {
    if (!draft.trim() || sending) return
    const text = draft
    setDraft('')
    send(text, selectedModel)
  }

  return (
    <div className="workspace-eve-panel">
      <div className="workspace-eve-header">
        <div className="workspace-eve-header-left">
          <Bot size={16} />
          <span>Eve Agent</span>
        </div>
        <button
          className="workspace-eve-toggle"
          onClick={onToggle}
          title="Close Eve panel"
          aria-label="Close Eve panel"
        >
          <PanelRightClose size={16} />
        </button>
      </div>
      <div className="workspace-eve-chat" ref={chatRef}>
        {messages.length === 0 && !streamText ? (
          <div className="workspace-eve-empty">
            <Bot size={24} />
            <p>Ask Eve to help with your code</p>
            <span>Eve can read, edit, search, and run commands in this workspace.</span>
          </div>
        ) : (
          <>
            {messages.map((entry, index) => (
              <div key={index} className={`workspace-eve-message ${entry.role}`}>
                {entry.content}
              </div>
            ))}
            {thinkingText && (
              <div className="workspace-eve-thinking">
                <span className="workspace-eve-thinking-label">Thinking…</span>
                <span className="workspace-eve-thinking-text">{thinkingText}</span>
                {!streamText && <span className="eve-thinking-cursor" aria-hidden="true" />}
              </div>
            )}
            {activeTool && (
              <div className="workspace-eve-tool">
                <Wrench size={12} />
                <span>Using tool: {activeTool}</span>
              </div>
            )}
            {streamText && (
              <div className="workspace-eve-message assistant streaming">
                {streamText}
                <span className="eve-streaming-cursor" aria-hidden="true" />
              </div>
            )}
          </>
        )}
      </div>
      {error && <div className="workspace-eve-error">{error}</div>}
      <div className="workspace-eve-input">
        <div className="workspace-eve-model-row">
          <ModelSelectorDropdown
            className="workspace-eve-model-selector"
            value={selectedModel.model}
            onChange={(selection) => setSelectedModel({
              provider: selection.provider,
              model: selection.model || selection.value,
            })}
            direction="up"
            showIcon={false}
            placeholder="Select model"
            disabled={sending}
          />
        </div>
        <div className="workspace-eve-compose-row">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Ask Eve..."
            aria-label="Ask Eve"
            disabled={sending}
          />
          {sending ? (
            <button
              className="workspace-eve-send"
              onClick={stop}
              title="Stop Eve"
              aria-label="Stop Eve"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              className="workspace-eve-send"
              onClick={submit}
              disabled={!draft.trim()}
              title="Send to Eve"
              aria-label="Send to Eve"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
