import "../styles/pages/eve-shell.css"
import "../styles/pages/eve-messages.css"
import "../styles/pages/eve-thoughts.css"
import "../styles/pages/eve-composer.css"
import "../styles/pages/eve-composer-box.css"
import "../styles/pages/eve-skills.css"
import "../styles/pages/eve-subpages.css"
import "../styles/pages/eve-schedules.css"
import "../styles/pages/eve-call-stage.css"
import "../styles/pages/eve-call-live.css"
import { useEffect, useRef, useState } from 'react'
import {
  createEveSession,
  getEveSession,
  sendEveMessage,
  streamEveMessage,
} from '../lib/eveApi'
import { useEveLibrary } from './eve/useEveLibrary'
import { useEveAvatar } from '../components/eve/avatar/EveAvatarProvider'
import { useThemeCustomizer } from '../hooks/useThemeCustomizer'
import { EveActiveView } from './eve/EveActiveView'
import {
  EVE_PRESET_PROMPTS,
  EVE_TOOLS_LIST,
  STARTER_MESSAGES,
  TAB_PAGE_ID,
} from './eve/eveConstants'

export function EvePage({
  activeSubpage = 'chat',
  callCenter,
  onNavigate,
  onWorkspaceChanged,
  chatResetKey,
}) {
  const [activeTab, setActiveTab] = useState(activeSubpage)

  useEffect(() => {
    if (activeSubpage) {
      setActiveTab(activeSubpage)
    }
  }, [activeSubpage])
  const [messages, setMessages] = useState(STARTER_MESSAGES)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [thinkingText, setThinkingText] = useState('')
  const [toolCalls, setToolCalls] = useState([])
  const [activeTool, setActiveTool] = useState(null)
  const abortRef = useRef(null)
  const [error, setError] = useState('')
  const [promptQueue, setPromptQueue] = useState([])
  const { prefs: avatarPrefs, activeModel: avatarModel, setPrefs: setAvatarPrefs } = useEveAvatar()
  const { activePreset } = useThemeCustomizer() || {}
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    memories,
    memoryDraft,
    setMemoryDraft,
    isAddingMemory,
    isLoadingSidebar,
    aiProviders,
    activeModel,
    refreshSidebar,
    handleSelectAiModel,
    removeSession,
    addMemory,
    removeMemory,
  } = useEveLibrary({ notifyError: setError, onActiveSessionDeleted: () => startNewChat() })

  useEffect(() => {
    setMessages(STARTER_MESSAGES)
    setDraft('')
    setError('')
    setPromptQueue([])
    setActiveSessionId(null)
    refreshSidebar()
  }, [chatResetKey, refreshSidebar, setActiveSessionId])

  const handleActions = (actions) => {
    if (!actions || !Array.isArray(actions)) return
    actions.forEach((action) => {
      if (action.type === 'navigate_page') {
        onNavigate?.(action.page)
      } else if (action.type === 'open_record') {
        if (action.page === 'project-detail') onNavigate?.('project-detail', action.projectId)
        if (action.page === 'document-opener') onNavigate?.('document-opener', null, action.documentId)
      } else if (action.type === 'open_studio_project' || action.type === 'show_build_approval') {
        if (action.projectId) onNavigate?.('studio-detail', action.projectId)
        else onNavigate?.('studio')
      } else if (action.type === 'refresh_workspace_data') {
        onWorkspaceChanged?.()
      } else if (action.type === 'trigger_eve_call') {
        callCenter?.requestEveCall?.('audio')
      } else if (action.type === 'refresh_eve_schedules') {
        refreshSidebar()
      } else if (action.type === 'apply_ui_overrides' || action.type === 'reset_ui') {
        if (action.preferences) {
          window.dispatchEvent(new CustomEvent('eve-ui-update', { detail: { preferences: action.preferences } }))
        }
      } else if (action.type === 'open_custom_page' && action.slug) {
        window.dispatchEvent(new CustomEvent('eve-ui-update', { detail: { preferences: action.preferences } }))
        onNavigate?.(`custom-${action.slug}`)
      }
    })
  }

  const stopGenerating = () => {
    abortRef.current?.abort()
  }

  const sendMessage = async (customContent, attachments = []) => {
    const content = (customContent ?? draft).trim()
    if ((!content && (!attachments || attachments.length === 0)) || isSending) return
    try {
      await sendPrompt(content, messages, attachments)
    } catch (requestError) {
      setError(requestError.message || 'Failed to send message to Eve.')
    }
  }

  const buildApiMessages = (nextMessages) =>
    nextMessages
      .map((m) => {
        if (m.role === 'user' && m.attachments?.length) {
          const fileBlocks = m.attachments
            .map((att) => {
              if (att.textContent) {
                return `[Attached file: ${att.name}]\n\`\`\`\n${att.textContent}\n\`\`\``
              }
              return `[Attached file: ${att.name} (${att.type || 'file'})]`
            })
            .join('\n\n')
          return {
            role: 'user',
            content: `${fileBlocks}\n\n${m.content || 'Please review the attached file(s).'}`,
          }
        }
        return { role: m.role, content: m.content }
      })
      .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content.trim() }))

  const runNonStreamedTurn = async (apiMessages, nextMessages) => {
    let sessionId = activeSessionId
    if (!sessionId) {
      const sanitizedForSession = nextMessages.filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
      const createdSession = await createEveSession(sanitizedForSession.length ? sanitizedForSession : nextMessages)
      sessionId = createdSession.session.id
      setActiveSessionId(sessionId)
    }
    const response = await sendEveMessage(apiMessages, sessionId)
    return { response, sessionId }
  }

  const commitTurn = (
    baseMessages,
    assistantContent,
    changedResources,
    actions,
    turnThinking = '',
    turnToolCalls = [],
  ) => {
    const hasAssistantContent = typeof assistantContent === 'string' && assistantContent.trim().length > 0
    if (!hasAssistantContent) {
      if (changedResources?.length) onWorkspaceChanged?.()
      handleActions(actions)
      refreshSidebar()
      return baseMessages
    }
    const finalMessages = [
      ...baseMessages,
      {
        role: 'assistant',
        content: assistantContent.trim(),
        thinking: turnThinking || undefined,
        toolCalls: turnToolCalls?.length ? turnToolCalls : undefined,
      },
    ]
    setMessages(finalMessages)
    if (changedResources?.length) onWorkspaceChanged?.()
    handleActions(actions)
    refreshSidebar()
    return finalMessages
  }

  const sendPrompt = async (content, baseMessages, attachments = []) => {
    const userMessage = {
      role: 'user',
      content: content || 'Please review the attached file(s).',
      attachments: attachments.map((a) => ({
        id: a.id,
        name: a.name,
        size: a.size,
        type: a.type,
        isImage: a.isImage,
        dataUrl: a.dataUrl,
      })),
    }
    const nextMessages = [...baseMessages, userMessage]
    setMessages(nextMessages)
    setDraft('')
    setError('')
    setIsSending(true)
    setStreamText('')
    setThinkingText('')
    setToolCalls([])
    setActiveTool(null)

    const apiMessages = buildApiMessages(nextMessages)

    const controller = new AbortController()
    abortRef.current = controller

    let currentThinking = ''
    const currentToolCalls = []

    try {
      let receivedText = ''
      let donePayload = null
      let fallbackToRest = false

      try {
        await streamEveMessage({
          messages: apiMessages,
          sessionId: activeSessionId,
          signal: controller.signal,
          onDelta: (text) => {
            receivedText += text
            setStreamText((current) => current + text)
          },
          onThinking: (text) => {
            currentThinking += text
            setThinkingText((current) => current + text)
          },
          onToolStart: (name, args, callId) => {
            setActiveTool(name)
            const entry = { id: callId || `${name}-${Date.now()}`, name, arguments: args, status: 'running' }
            currentToolCalls.push(entry)
            setToolCalls([...currentToolCalls])
          },
          onToolEnd: (name, output, callId) => {
            setActiveTool(null)
            const idx = currentToolCalls.findIndex(
              (t) => (callId && t.id === callId) || (!callId && t.name === name && t.status === 'running'),
            )
            if (idx !== -1) {
              currentToolCalls[idx] = { ...currentToolCalls[idx], output, status: 'done' }
              setToolCalls([...currentToolCalls])
            }
          },
          onDone: (payload) => {
            donePayload = payload
          },
        })
      } catch (streamError) {
        if (controller.signal.aborted) {
          if (!receivedText && !currentThinking) return nextMessages
          // User pressed Stop — keep whatever was generated.
          donePayload = { message: receivedText, changed_resources: [], actions: [], session_id: activeSessionId }
        } else if (!receivedText && !currentThinking) {
          // Stream never produced tokens — check if it's a rate-limit that shouldn't fallback to REST (would just 429 again)
          if (streamError.code === 'rate_limit' || streamError.status === 429) {
            const msg = streamError.message || 'Rate limit exceeded. Please wait a moment and retry.'
            setError(msg)
            return commitTurn(nextMessages, '', [], [], currentThinking, currentToolCalls)
          }
          // Stream never produced tokens — fall back once to the classic endpoint.
          fallbackToRest = true
        } else {
          // Partial answer already streamed — keep it visible and report the error.
          setError(streamError.message || 'Eve response was interrupted.')
          return commitTurn(nextMessages, receivedText, [], [], currentThinking, currentToolCalls)
        }
      }

      if (fallbackToRest) {
        try {
          const { response, sessionId } = await runNonStreamedTurn(apiMessages, nextMessages)
          if (!activeSessionId && sessionId) setActiveSessionId(sessionId)
          return commitTurn(nextMessages, response.message, response.changed_resources, response.actions)
        } catch (restError) {
          // Map HTTP status to distinct user-facing messages (rate limit vs other)
          const status = restError?.status || 502
          const code = restError?.code
          const isRate = status === 429 || code === 'rate_limit' || /rate limit/i.test(restError.message || '')
          const isAuth = status === 401 || code === 'auth' || /authentication|api key/i.test(restError.message || '')
          const isNotFound = status === 404 || code === 'model_not_found'
          let friendly = restError.message || 'Eve request failed.'
          if (isRate) friendly = restError.message || 'Rate limit exceeded. Please wait a moment and retry.'
          else if (isAuth) friendly = restError.message || 'Authentication failed. Please check your API key in Settings > AI Models.'
          else if (isNotFound) friendly = restError.message || 'Model not found. Please pick an available model in Settings > AI Models.'
          setError(friendly)
          return commitTurn(nextMessages, '', [], [], currentThinking, currentToolCalls)
        }
      }

      const finalSessionId = donePayload?.session_id ?? activeSessionId
      if (finalSessionId && !activeSessionId) setActiveSessionId(finalSessionId)
      return commitTurn(
        nextMessages,
        donePayload?.message ?? '',
        donePayload?.changed_resources,
        donePayload?.actions,
        currentThinking,
        currentToolCalls,
      )
    } finally {
      abortRef.current = null
      setIsSending(false)
      setStreamText('')
      setThinkingText('')
      setToolCalls([])
      setActiveTool(null)
    }
  }

  const startNewChat = () => {
    setMessages(STARTER_MESSAGES)
    setDraft('')
    setError('')
    setPromptQueue([])
    setActiveSessionId(null)
    setActiveTab('chat')
    onNavigate?.('eve')
  }

  const resumeSession = async (session) => {
    try {
      const sessionData = await getEveSession(session.id)
      const loaded = sessionData?.session?.messages || STARTER_MESSAGES
      const sanitized = Array.isArray(loaded) ? loaded.filter((m) => typeof m.content === 'string' && m.content.trim().length > 0) : loaded
      setMessages(sanitized.length ? sanitized : STARTER_MESSAGES)
      setActiveSessionId(session.id)
      setError('')
      setActiveTab('chat')
      onNavigate?.('eve')
    } catch (sessionError) {
      setError(String(sessionError.message || 'Could not load that Eve session.'))
    }
  }

  const handleSubmit = (e, attachments = []) => {
    e?.preventDefault()
    const content = draft.trim()
    if (!content && (!attachments || attachments.length === 0)) return
    if (isSending) {
      setPromptQueue((current) => [...current, content])
      setDraft('')
      return
    }
    sendMessage(content, attachments)
  }

  const addToQueue = () => {
    const content = draft.trim()
    if (!content) return
    setPromptQueue((current) => [...current, content])
    setDraft('')
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
    let conversation = messages
    for (const prompt of queuedPrompts) {
      try {
        conversation = await sendPrompt(prompt, conversation)
      } catch (requestError) {
        setError(requestError.message || 'Failed to send message to Eve.')
        break
      }
    }
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
  }

  const selectPrompt = (item) => {
    setDraft(item.prompt)
  }

  // Broadcast Eve live state to global companion
  useEffect(() => {
    const detail = { isSending, isEveSpeaking: Boolean(streamText) && isSending, isEveThinking: Boolean(thinkingText) && isSending, thinkingText, activeTool, streamText, error }
    window.dispatchEvent(new CustomEvent('starwaves:eve-state', { detail }))
  }, [isSending, streamText, thinkingText, activeTool, error])

  const switchTab = (tabId) => {
    setActiveTab(tabId)
    onNavigate?.(TAB_PAGE_ID[tabId])
  }

  return (
    <EveActiveView
      activeTab={activeTab}
      onTabChange={switchTab}
      avatarPrefs={avatarPrefs}
      setAvatarPrefs={setAvatarPrefs}
      activePreset={activePreset}
      avatarModel={avatarModel}
      messages={messages}
      draft={draft}
      setDraft={setDraft}
      isSending={isSending}
      streamText={streamText}
      thinkingText={thinkingText}
      toolCalls={toolCalls}
      activeTool={activeTool}
      stopGenerating={stopGenerating}
      error={error}
      promptQueue={promptQueue}
      addToQueue={addToQueue}
      removeFromQueue={removeFromQueue}
      clearQueue={clearQueue}
      runQueue={runQueue}
      handleSubmit={handleSubmit}
      matchingTools={matchingTools}
      matchingPrompts={matchingPrompts}
      selectTool={selectTool}
      selectPrompt={selectPrompt}
      EVE_PRESET_PROMPTS={EVE_PRESET_PROMPTS}
      aiProviders={aiProviders}
      activeModel={activeModel}
      onSelectAiModel={handleSelectAiModel}
      callCenter={callCenter}
      sessions={sessions}
      activeSessionId={activeSessionId}
      isLoadingSidebar={isLoadingSidebar}
      resumeSession={resumeSession}
      removeSession={removeSession}
      startNewChat={startNewChat}
      memories={memories}
      addMemory={addMemory}
      removeMemory={removeMemory}
      memoryDraft={memoryDraft}
      setMemoryDraft={setMemoryDraft}
      isAddingMemory={isAddingMemory}
      refreshSidebar={refreshSidebar}
    />
  )
}
