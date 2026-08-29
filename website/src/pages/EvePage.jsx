import { useEffect, useRef, useState } from 'react'
import {
  createEveMemory,
  createEveSession,
  deleteEveMemory,
  deleteEveSession,
  getEveSession,
  listEveMemories,
  listEveSessions,
  sendEveMessage,
  streamEveMessage,
} from '../lib/eveApi'
import { loadAiModels, saveAiModelPreference } from '../lib/aiModelsApi'
import { EveChatSection } from './eve/EveChatSection'
import { EveSessionsSection } from './eve/EveSessionsSection'
import { EveMemorySection } from './eve/EveMemorySection'
import { EveSchedulesSection } from './eve/EveSchedulesSection'
import { EveCallSection } from './eve/EveCallSection'

const STARTER_MESSAGES = [
  {
    role: 'assistant',
    content:
      'Hello! I’m Eve, your StarWaves AI workspace assistant. I can read, create, update, soft-delete, and restore records across your workspace, help you with code, and browse the open web for up-to-date information and research.',
  },
]

const EVE_PRESET_PROMPTS = [
  { command: 'web', label: 'Search the web', prompt: 'Search the open web for the latest updates and information on: ', description: 'Browse and search external websites' },
  { command: 'call', label: 'Call me now', prompt: 'Call me right now on voice to review my workspace status.', description: 'Trigger an immediate incoming voice call from Eve' },
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
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [memories, setMemories] = useState([])
  const [memoryDraft, setMemoryDraft] = useState('')
  const [isAddingMemory, setIsAddingMemory] = useState(false)
  const [isLoadingSidebar, setIsLoadingSidebar] = useState(true)
  const [aiProviders, setAiProviders] = useState([])
  const [activeModel, setActiveModel] = useState({ provider: 'openai', model: 'gpt-5-mini', label: 'GPT-5 mini' })

  const refreshSidebar = async () => {
    try {
      const [sessionData, memoryData, modelsData] = await Promise.all([
        listEveSessions().catch(() => ({ sessions: [] })),
        listEveMemories().catch(() => ({ memories: [] })),
        loadAiModels().catch(() => null),
      ])
      setSessions(sessionData.sessions ?? [])
      setMemories(memoryData.memories ?? [])

      if (modelsData?.providers) {
        const available = modelsData.providers.filter((p) => p.available)
        setAiProviders(available)
        const pref = modelsData.preference
        const selectedProv = available.find((p) => p.id === (pref?.provider || '')) || available[0]
        if (selectedProv) {
          const modelObj = selectedProv.models?.find((m) => m.id === (pref?.model || '')) || selectedProv.models?.[0]
          setActiveModel({
            provider: selectedProv.id,
            model: modelObj?.id || pref?.model || selectedProv.default_model || 'gpt-5-mini',
            label: modelObj?.label || modelObj?.id || 'GPT-5 mini',
          })
        }
      }
    } catch (sidebarError) {
      setError(sidebarError.message || 'Could not load Eve sessions and memory.')
    } finally {
      setIsLoadingSidebar(false)
    }
  }

  const handleSelectAiModel = async (providerId, modelId, modelLabel) => {
    setActiveModel({ provider: providerId, model: modelId, label: modelLabel })
    try {
      await saveAiModelPreference({ provider: providerId, model: modelId })
    } catch (err) {
      console.warn('Could not save model preference:', err)
    }
  }

  useEffect(() => {
    setMessages(STARTER_MESSAGES)
    setDraft('')
    setError('')
    setPromptQueue([])
    setActiveSessionId(null)
    refreshSidebar()
  }, [chatResetKey])

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
    nextMessages.map((m) => {
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

  const runNonStreamedTurn = async (apiMessages, nextMessages) => {
    let sessionId = activeSessionId
    if (!sessionId) {
      const createdSession = await createEveSession(nextMessages)
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
    const finalMessages = [
      ...baseMessages,
      {
        role: 'assistant',
        content: assistantContent,
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
          // Stream never produced tokens — fall back once to the classic endpoint.
          fallbackToRest = true
        } else {
          // Partial answer already streamed — keep it visible and report the error.
          setError(streamError.message || 'Eve response was interrupted.')
          return commitTurn(nextMessages, receivedText, [], [], currentThinking, currentToolCalls)
        }
      }

      if (fallbackToRest) {
        const { response, sessionId } = await runNonStreamedTurn(apiMessages, nextMessages)
        if (!activeSessionId && sessionId) setActiveSessionId(sessionId)
        return commitTurn(nextMessages, response.message, response.changed_resources, response.actions)
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
      setMessages(sessionData?.session?.messages || STARTER_MESSAGES)
      setActiveSessionId(session.id)
      setError('')
      setActiveTab('chat')
      onNavigate?.('eve')
    } catch (sessionError) {
      setError(sessionError.message || 'Could not load that Eve session.')
    }
  }

  const removeSession = async (sessionId) => {
    try {
      await deleteEveSession(sessionId)
      if (activeSessionId === sessionId) startNewChat()
      refreshSidebar()
    } catch (sessionError) {
      setError(sessionError.message || 'Could not delete that Eve session.')
    }
  }

  const addMemory = async (e) => {
    e.preventDefault()
    const content = memoryDraft.trim()
    if (!content || isAddingMemory) return
    setIsAddingMemory(true)
    setError('')
    try {
      const memoryData = await createEveMemory(content)
      setMemories(memoryData.memories ?? [])
      setMemoryDraft('')
    } catch (memoryError) {
      setError(memoryError.message || 'Could not save that memory.')
    } finally {
      setIsAddingMemory(false)
    }
  }

  const removeMemory = async (memoryId) => {
    try {
      await deleteEveMemory(memoryId)
      setMemories((current) => current.filter((memory) => memory.id !== memoryId))
    } catch (memoryError) {
      setError(memoryError.message || 'Could not delete that memory.')
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

  return (
    <div className="eve-page-container">
      <div className="eve-active-view-container full-width">
        {activeTab === 'chat' && (
          <EveChatSection
            messages={messages}
            draft={draft}
            setDraft={setDraft}
            isSending={isSending}
            streamText={streamText}
            thinkingText={thinkingText}
            toolCalls={toolCalls}
            activeTool={activeTool}
            onStop={stopGenerating}
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
          />
        )}

        {activeTab === 'call' && (
          <EveCallSection callCenter={callCenter} />
        )}

        {activeTab === 'sessions' && (
          <EveSessionsSection
            sessions={sessions}
            activeSessionId={activeSessionId}
            isLoading={isLoadingSidebar}
            onResumeSession={resumeSession}
            onRemoveSession={removeSession}
            onStartNewChat={startNewChat}
            isSending={isSending}
          />
        )}

        {activeTab === 'memory' && (
          <EveMemorySection
            memories={memories}
            isLoading={isLoadingSidebar}
            onAddMemory={addMemory}
            onRemoveMemory={removeMemory}
            memoryDraft={memoryDraft}
            setMemoryDraft={setMemoryDraft}
            isAddingMemory={isAddingMemory}
            isSending={isSending}
          />
        )}

        {activeTab === 'schedules' && (
          <EveSchedulesSection onScheduleTriggered={refreshSidebar} />
        )}
      </div>
    </div>
  )
}
