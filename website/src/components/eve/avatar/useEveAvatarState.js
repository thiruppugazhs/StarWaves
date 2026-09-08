import { useMemo } from 'react'

const TOOL_EMOTION = 'tool'
const SPEAKING_EMOTION = 'speaking'
const THINKING_EMOTION = 'thinking'
const LISTENING_EMOTION = 'listening'
const ERROR_EMOTION = 'error'
const IDLE_EMOTION = 'idle'

export function useEveAvatarState({
  isSending = false,
  isEveSpeaking = false,
  isEveThinking = false,
  thinkingText = '',
  activeTool = null,
  streamText = '',
  sttStatus = 'idle',
  sttRecording = false,
  error = '',
} = {}) {
  const emotion = useMemo(() => {
    if (error) return ERROR_EMOTION
    if (activeTool) return TOOL_EMOTION
    if (isEveThinking || (thinkingText && thinkingText.length > 0)) return THINKING_EMOTION
    if (isEveSpeaking || (isSending && streamText)) return SPEAKING_EMOTION
    if (sttRecording || sttStatus === 'listening') return LISTENING_EMOTION
    return IDLE_EMOTION
  }, [activeTool, error, isEveSpeaking, isEveThinking, isSending, sttRecording, sttStatus, streamText, thinkingText])

  const isSpeaking = emotion === SPEAKING_EMOTION
  const isListening = emotion === LISTENING_EMOTION
  const isThinking = emotion === THINKING_EMOTION

  return { emotion, isSpeaking, isListening, isThinking }
}
