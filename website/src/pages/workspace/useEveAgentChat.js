import { useCallback, useRef, useState } from 'react'
import { sendEveMessage, streamEveMessage } from '../../lib/eveApi'

const FILE_MUTATING_TOOLS = new Set(['write_workspace_file', 'run_workspace_command'])
const WORKSPACE_CHANGED_RESOURCE = 'workspace-files'

function buildContextPrefix(workspaceId, workspaceName, activeFilePath) {
  const lines = [
    `[Context] Active code workspace: "${workspaceName}" (workspace_id: ${workspaceId}). Pass this exact workspace_id to every workspace file tool.`,
  ]
  if (activeFilePath) lines.push(`[Context] File currently open in the editor: ${activeFilePath}`)
  return lines.join('\n')
}

export function useEveAgentChat({ workspaceId, workspaceName, activeFilePath, onFilesChanged, onAction }) {
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [thinkingText, setThinkingText] = useState('')
  const [activeTool, setActiveTool] = useState(null)
  const [error, setError] = useState('')
  const historyRef = useRef([])
  const abortRef = useRef(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const commit = useCallback((content) => {
    const trimmed = typeof content === 'string' ? content.trim() : ''
    if (!trimmed) return
    historyRef.current = [...historyRef.current, { role: 'assistant', content: trimmed }]
    setMessages((log) => [...log, { role: 'assistant', content: trimmed }])
  }, [])

  const send = useCallback(
    async (rawText, modelSelection = null) => {
      const content = rawText.trim()
      if (!content || sending) return
      setError('')
      setSending(true)
      setStreamText('')
      setThinkingText('')
      setActiveTool(null)
      historyRef.current = [...historyRef.current, { role: 'user', content }]
      setMessages((log) => [...log, { role: 'user', content }])

      const contextPrefix = buildContextPrefix(workspaceId, workspaceName, activeFilePath)
      const apiMessages = [
        ...historyRef.current.slice(0, -1),
        { role: 'user', content: `${contextPrefix}\n\n${content}` },
      ]

      const controller = new AbortController()
      abortRef.current = controller
      let receivedText = ''
      let filesTouched = false

      try {
        let donePayload = null
        let fallbackToRest = false
        try {
          await streamEveMessage({
            messages: apiMessages,
            sessionId: null,
            modelSelection,
            signal: controller.signal,
            onDelta: (delta) => {
              receivedText += delta
              setStreamText((current) => current + delta)
            },
            onThinking: (delta) => {
              setThinkingText((current) => current + delta)
            },
            onToolStart: (name) => {
              if (FILE_MUTATING_TOOLS.has(name)) filesTouched = true
              setActiveTool(name)
            },
            onToolEnd: () => setActiveTool(null),
            onDone: (payload) => {
              donePayload = payload
            },
          })
        } catch (streamError) {
          if (controller.signal.aborted) {
            donePayload = { message: receivedText, changed_resources: [], actions: [] }
          } else if (!receivedText) {
            const isRate = streamError.code === 'rate_limit' || streamError.status === 429 || /rate limit/i.test(String(streamError.message || ''))
            if (isRate) {
              setError(String(streamError.message || 'Rate limit exceeded. Please wait a moment and retry.'))
              return
            }
            fallbackToRest = true
          } else {
            setError(String(streamError.message || 'Eve response was interrupted.'))
            commit(receivedText)
            return
          }
        }

        if (fallbackToRest) {
          try {
            const response = await sendEveMessage(apiMessages, null, modelSelection)
            commit(response.message)
            if (response.changed_resources?.includes(WORKSPACE_CHANGED_RESOURCE)) onFilesChanged?.()
            return
          } catch (restError) {
            const status = restError?.status || 502
            const code = restError?.code
            const isRate = status === 429 || code === 'rate_limit' || /rate limit/i.test(String(restError.message || ''))
            const isAuth = status === 401 || code === 'auth' || /authentication|api key/i.test(String(restError.message || ''))
            if (isRate) setError(String(restError.message || 'Rate limit exceeded. Please wait a moment and retry.'))
            else if (isAuth) setError(String(restError.message || 'Authentication failed. Check Settings → AI Models.'))
            else setError(String(restError.message || 'Eve is unavailable right now.'))
            return
          }
        }

        const finalText = donePayload?.message ?? receivedText
        if (finalText) commit(finalText)
        const workspaceChanged =
          filesTouched || Boolean(donePayload?.changed_resources?.includes(WORKSPACE_CHANGED_RESOURCE))
        if (workspaceChanged) onFilesChanged?.()

        for (const action of donePayload?.actions ?? []) {
          onAction?.(action)
          if (action.type === 'apply_ui_overrides' || action.type === 'reset_ui' || action.type === 'open_custom_page') {
            if (action.preferences) window.dispatchEvent(new CustomEvent('eve-ui-update', { detail: { preferences: action.preferences } }))
          }
        }
        if (donePayload?.changed_resources?.includes('ui-preferences') && donePayload?.actions?.length === 0) {
          try {
            const { getUiPreferences } = await import('../../lib/uiPreferencesApi')
            const res = await getUiPreferences()
            if (res?.preferences) window.dispatchEvent(new CustomEvent('eve-ui-update', { detail: { preferences: res.preferences } }))
          } catch {}
        }
      } catch (turnError) {
        setError(String(turnError.message || 'Eve is unavailable right now.'))
      } finally {
        abortRef.current = null
        setSending(false)
        setStreamText('')
        setThinkingText('')
        setActiveTool(null)
      }
    },
    [activeFilePath, commit, onAction, onFilesChanged, sending, workspaceId, workspaceName],
  )

  return { messages, sending, streamText, thinkingText, activeTool, error, send, stop }
}
