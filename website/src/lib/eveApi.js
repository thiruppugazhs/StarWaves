import { apiRequest, API_URL, fetchWithTimeout } from './request'
import { getStoredAuthToken } from './authApi'

const ERROR_MESSAGE = 'Eve is unavailable right now.'
const TOKEN_MESSAGE = 'Sign in to use Eve.'
const STREAM_TIMEOUT_MS = 120_000

function request(path, options = {}) {
  return apiRequest(path, {
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    notFoundMessage: `Eve endpoint not found (404). Please ensure the backend server at ${API_URL} is updated and running.`,
    ...options,
  })
}

export function sendEveMessage(messages, sessionId) {
  return request('/eve/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, session_id: sessionId ?? null }),
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
      body: JSON.stringify({ messages, session_id: sessionId ?? null }),
      signal,
    },
    STREAM_TIMEOUT_MS,
  )

  if (!response.ok) {
    const failure = await response.json().catch(() => null)
    throw new Error(failure?.detail || 'Eve stream could not be started.')
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
      throw new Error(event.detail || 'Eve response failed mid-stream.')
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
    throw new Error(failure?.detail || 'Eve voice stream could not be started.')
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
      throw new Error(event.detail || 'Eve voice failed mid-stream.')
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
