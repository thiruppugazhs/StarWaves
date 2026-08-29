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
  const [activeTool, setActiveTool] = useState(null)
  const [error, setError] = useState('')
  const historyRef = useRef([])
  const abortRef = useRef(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const commit = useCallback((content) => {
    historyRef.current = [...historyRef.current, { role: 'assistant', content }]
    setMessages((log) => [...log, { role: 'assistant', content }])
  }, [])

  const send = useCallback(
    async (rawText) => {
      const content = rawText.trim()
      if (!content || sending) return
      setError('')
      setSending(true)
      setStreamText('')
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
            signal: controller.signal,
            onDelta: (delta) => {
              receivedText += delta
              setStreamText((current) => current + delta)
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
            fallbackToRest = true
          } else {
            setError(streamError.message || 'Eve response was interrupted.')
            commit(receivedText)
            return
          }
        }

        if (fallbackToRest) {
          const response = await sendEveMessage(apiMessages, null)
          commit(response.message)
          if (response.changed_resources?.includes(WORKSPACE_CHANGED_RESOURCE)) onFilesChanged?.()
          return
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
        setError(turnError.message || 'Eve is unavailable right now.')
      } finally {
        abortRef.current = null
        setSending(false)
        setStreamText('')
        setActiveTool(null)
      }
    },
    [activeFilePath, commit, onAction, onFilesChanged, sending, workspaceId, workspaceName],
  )

  return { messages, sending, streamText, activeTool, error, send, stop }
}
