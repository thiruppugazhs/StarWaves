import { apiRequest, API_URL, fetchWithTimeout } from './request'
import { getStoredAuthToken } from './authApi'

const ERROR_MESSAGE = 'Eve is unavailable right now.'
const TOKEN_MESSAGE = 'Sign in to use Eve.'
const STREAM_TIMEOUT_MS = 120_000

function formatStreamDetail(detail, fallback) {
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const hasEmptyContent = detail.some((e) => e?.type === 'string_too_short' && Array.isArray(e.loc) && e.loc.includes('content'))
    if (hasEmptyContent) return 'A message was empty and could not be sent. Please write a message and try again.'
    return detail.map((e) => (e && typeof e === 'object' && typeof e.msg === 'string' ? (Array.isArray(e.loc) ? `${e.loc.slice(1).join('.')}: ${e.msg}` : e.msg) : JSON.stringify(e))).join('; ') || fallback
  }
  if (typeof detail === 'object') {
    try {
      return typeof detail.msg === 'string' ? detail.msg : JSON.stringify(detail)
    } catch {
      return fallback
    }
  }
  return String(detail) || fallback
}

function request(path, options = {}) {
  return apiRequest(path, {
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    notFoundMessage: `Eve endpoint not found (404). Please ensure the backend server at ${API_URL} is updated and running.`,
    ...options,
  })
}

export function sendEveMessage(messages, sessionId, modelSelection = null, editorContext = null) {
  const body = { messages, session_id: sessionId ?? null }
  if (modelSelection?.provider && modelSelection?.model) {
    body.provider = modelSelection.provider
    body.model = modelSelection.model
  }
  if (editorContext) body.editor_context = editorContext
  return request('/eve/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 60_000,
  })
}

/**
 * Stream an Eve chat response via SSE (`POST /eve/chat/stream`).
 *
 * Callbacks:
 * - onDelta(text)      — incremental assistant text
 * - onToolStart(name) / onToolEnd(name) — workspace tool activity
 * - onDone({message, changed_resources, actions, session_id})
 *
 * Throws when the stream cannot be started or fails mid-flight (callers may
 * fall back to sendEveMessage). Abortable via `signal`.
 */
export async function streamEveMessage({
  messages,
  sessionId,
  modelSelection = null,
  editorContext = null,
  signal,
  onDelta,
  onThinking,
  onToolStart,
  onToolEnd,
  onDone,
}) {
  const token = getStoredAuthToken()
  if (!token) throw new Error(TOKEN_MESSAGE)

  const response = await fetchWithTimeout(
    `${API_URL}/eve/chat/stream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        messages,
        session_id: sessionId ?? null,
        ...(modelSelection?.provider && modelSelection?.model
          ? { provider: modelSelection.provider, model: modelSelection.model }
          : {}),
        ...(editorContext ? { editor_context: editorContext } : {}),
      }),
      signal,
    },
    STREAM_TIMEOUT_MS,
  )

  if (!response.ok) {
    const failure = await response.json().catch(() => null)
    const err = new Error(formatStreamDetail(failure?.detail, 'Eve stream could not be started.'))
    err.status = response.status
    err.detail = failure?.detail
    // Heuristic: detect rate limit from status or message for better UX
    if (response.status === 429) err.code = 'rate_limit'
    else if (response.status === 401) err.code = 'auth'
    else if (response.status === 404) err.code = 'model_not_found'
    throw err
  }
  if (!response.body) throw new Error('Streaming is not supported by this browser.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleFrame = (frame) => {
    const dataLine = frame.split('\n').find((line) => line.startsWith('data:'))
    if (!dataLine) return
    const data = dataLine.slice(5).trim()
    if (!data || data === '[DONE]') return
    let event
    try {
      event = JSON.parse(data)
    } catch {
      return // ignore malformed frames
    }
    if (event.type === 'delta') {
      if (event.text) onDelta?.(event.text)
    } else if (event.type === 'thinking') {
      if (event.text) onThinking?.(event.text)
    } else if (event.type === 'tool_start') {
      onToolStart?.(event.name, event.arguments, event.call_id)
    } else if (event.type === 'tool_end') {
      onToolEnd?.(event.name, event.output, event.call_id)
    } else if (event.type === 'done') {
      onDone?.(event)
    } else if (event.type === 'error') {
      const err = new Error(formatStreamDetail(event.detail, 'Eve response failed mid-stream.'))
      err.code = event.code || 'provider_error'
      err.status = event.status || 502
      err.retryAfter = event.retry_after
      throw err
    }
  }

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let separator = buffer.indexOf('\n\n')
    while (separator !== -1) {
      const frame = buffer.slice(0, separator)
      buffer = buffer.slice(separator + 2)
      handleFrame(frame)
      separator = buffer.indexOf('\n\n')
    }
  }
}

/**
 * Ultra low-latency Eve voice turn (`POST /eve/voice/stream`).
 * Fast model, no tool loop; server synthesizes TTS per sentence and streams
 * `delta` + `audio` frames. First audio typically arrives <1s after request.
 *
 * Callbacks:
 * - onDelta(text)  — incremental assistant text
 * - onAudio({sentence, audio_base64, mime, provider, text}) — one playable chunk;
 *   provider 'browser' means speak `text` via SpeechSynthesis locally
 * - onDone({message})
 */
export async function streamEveVoice({
  messages,
  sessionId,
  signal,
  onDelta,
  onAudio,
  onDone,
}) {
  const token = getStoredAuthToken()
  if (!token) throw new Error(TOKEN_MESSAGE)

  const response = await fetchWithTimeout(
    `${API_URL}/eve/voice/stream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ messages, session_id: sessionId ?? null }),
      signal,
    },
    STREAM_TIMEOUT_MS,
  )

  if (!response.ok) {
    const failure = await response.json().catch(() => null)
    const err = new Error(formatStreamDetail(failure?.detail, 'Eve voice stream could not be started.'))
    err.status = response.status
    if (response.status === 429) err.code = 'rate_limit'
    else if (response.status === 401) err.code = 'auth'
    throw err
  }
  if (!response.body) throw new Error('Streaming is not supported by this browser.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleFrame = (frame) => {
    const dataLine = frame.split('\n').find((line) => line.startsWith('data:'))
    if (!dataLine) return
    const data = dataLine.slice(5).trim()
    if (!data || data === '[DONE]') return
    let event
    try {
      event = JSON.parse(data)
    } catch {
      return
    }
    if (event.type === 'delta') {
      if (event.text) onDelta?.(event.text)
    } else if (event.type === 'audio') {
      onAudio?.(event)
    } else if (event.type === 'done') {
      onDone?.(event)
    } else if (event.type === 'error') {
      const err = new Error(formatStreamDetail(event.detail, 'Eve voice failed mid-stream.'))
      err.code = event.code || 'provider_error'
      err.status = event.status || 502
      throw err
    }
  }

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let separator = buffer.indexOf('\n\n')
    while (separator !== -1) {
      const frame = buffer.slice(0, separator)
      buffer = buffer.slice(separator + 2)
      handleFrame(frame)
      separator = buffer.indexOf('\n\n')
    }
  }
}

export function listEveSessions() {
  return request('/eve/sessions')
}

export function createEveSession(messages) {
  return request('/eve/sessions', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  })
}

export function getEveSession(sessionId) {
  return request(`/eve/sessions/${encodeURIComponent(sessionId)}`)
}

export function deleteEveSession(sessionId) {
  return request(`/eve/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}

export function deleteEveRecord(resource, recordId) {
  return request('/eve/delete', {
    method: 'POST',
    body: JSON.stringify({ resource, record_id: recordId }),
  })
}

export function listEveMemories() {
  return request('/eve/memories')
}

export function createEveMemory(content) {
  return request('/eve/memories', {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export function deleteEveMemory(memoryId) {
  return request(`/eve/memories/${encodeURIComponent(memoryId)}`, { method: 'DELETE' })
}
