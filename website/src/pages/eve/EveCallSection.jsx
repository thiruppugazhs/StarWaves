import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  Loader,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  Radio,
  Video,
  User,
  MessageSquare,
} from 'lucide-react'
import { formatElapsed } from '../../utils/callDisplay'

const IN_PROGRESS_PHASES = ['dialing', 'connecting', 'active']

export function EveCallSection({ callCenter }) {
  const {
    phase = 'idle',
    muted = false,
    error,
    isEveCall = false,
    userTranscript = '',
    eveTranscript = '',
    isEveSpeaking = false,
    isEveThinking = false,
    ttsEnabled = true,
    sttStatus = 'listening',
    sttRecording = false,
    sttProvider = 'browser',
    startSttRecording,
    stopSttRecording,
    hangUp,
    toggleMute,
    toggleTts,
    sendVoiceToEve,
    requestEveCall,
  } = callCenter || {}

  const [elapsed, setElapsed] = useState(0)
  const [textDraft, setTextDraft] = useState('')
  const [transcriptLog, setTranscriptLog] = useState([])
  const captionsEndRef = useRef(null)

  useEffect(() => {
    if (phase !== 'active') {
      setElapsed(0)
      return undefined
    }
    const startedAt = Date.now()
    setElapsed(0)
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  // Track conversation turns in transcript log
  useEffect(() => {
    if (userTranscript) {
      setTranscriptLog((prev) => {
        const last = prev[prev.length - 1]
        if (last?.speaker === 'user' && last?.text === userTranscript) return prev
        return [
          ...prev,
          {
            speaker: 'user',
            text: userTranscript,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]
      })
    }
  }, [userTranscript])

  useEffect(() => {
    if (eveTranscript) {
      setTranscriptLog((prev) => {
        const last = prev[prev.length - 1]
        if (last?.speaker === 'eve' && last?.text === eveTranscript) return prev
        return [
          ...prev,
          {
            speaker: 'eve',
            text: eveTranscript,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]
      })
    }
  }, [eveTranscript])

  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcriptLog, userTranscript, eveTranscript, isEveThinking])

  // Reset transcript log on new call
  useEffect(() => {
    if (phase === 'dialing' || phase === 'connecting') {
      setTranscriptLog([])
    }
  }, [phase])

  const inProgress = isEveCall && IN_PROGRESS_PHASES.includes(phase)

  const handleStartCall = (mode = 'audio') => {
    requestEveCall?.(mode)
  }

  const handleTextSend = (event) => {
    event?.preventDefault()
    const text = textDraft.trim()
    if (!text || isEveThinking) return

    setTranscriptLog((prev) => [
      ...prev,
      {
        speaker: 'user',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])

    if (inProgress) {
      sendVoiceToEve?.(text)
    } else {
      // If not currently in a call, start call and send prompt
      requestEveCall?.('audio')
      setTimeout(() => {
        sendVoiceToEve?.(text)
      }, 600)
    }
    setTextDraft('')
  }

  let statusText = 'Ready to start conversation'
  if (phase === 'dialing') statusText = 'Calling Eve…'
  else if (phase === 'connecting') statusText = 'Connecting to Eve…'
  else if (phase === 'active') {
    if (isEveThinking) statusText = 'Eve is thinking…'
    else if (isEveSpeaking) statusText = 'Eve is speaking…'
    else if (muted) statusText = 'Microphone muted'
    else if (sttStatus === 'unsupported') statusText = 'Voice input unsupported in browser (type below)'
    else if (sttStatus === 'permission') statusText = 'Microphone permission needed'
    else if (sttStatus === 'error') statusText = 'Voice input error (type below)'
    else if (sttProvider === 'groq') {
      statusText = sttRecording ? 'Listening to your voice…' : 'Hold to talk or type below'
    } else {
      statusText = `Listening… (${formatElapsed(elapsed)})`
    }
  } else if (phase === 'declined') statusText = 'Call declined'
  else if (phase === 'missed') statusText = 'Call missed'
  else if (phase === 'ended') statusText = 'Call ended · Ready to reconnect'
  else if (phase === 'error') statusText = 'Call failed · Click to retry'

  return (
    <div className="eve-call-section">
      {/* ── Header ── */}
      <div className="eve-call-header">
        <div className="eve-call-header-info">
          <h2>Voice &amp; AI Call</h2>
          <p>Real-time natural bidirectional voice &amp; text conversation with Eve</p>
        </div>
        <div className="eve-call-header-status">
          <div className="eve-call-status-pill">
            <span className={`eve-call-status-dot ${inProgress ? 'active' : ''}`} />
            <span>{inProgress ? `Active Call · ${formatElapsed(elapsed)}` : 'Standby'}</span>
          </div>
          <div className="eve-call-engine-badge">
            <Radio size={13} />
            <span>{sttProvider === 'groq' ? 'Groq Whisper' : 'Web Speech STT'}</span>
          </div>
        </div>
      </div>

      {/* ── Visualizer & Orb Area ── */}
      <div className={`eve-call-visualizer-area ${inProgress ? 'compact' : ''}`}>
        <div
          className={`eve-call-circle-stage ${inProgress ? 'in-call' : 'idle'} ${
            isEveSpeaking ? 'speaking' : ''
          } ${isEveThinking ? 'thinking' : ''} ${
            !isEveSpeaking && !isEveThinking && inProgress && !muted ? 'listening' : ''
          }`}
        >
          {/* Concentric expanding circular wave rings */}
          <div className="eve-call-wave-circle wave-1" />
          <div className="eve-call-wave-circle wave-2" />
          <div className="eve-call-wave-circle wave-3" />
          <div className="eve-call-wave-circle wave-4" />
          <div className="eve-call-wave-circle wave-5" />

          {/* Central Circle Orb Core */}
          <div className="eve-call-orb-core">
            {isEveThinking ? (
              <Loader size={36} className="eve-call-spin-icon" />
            ) : isEveSpeaking ? (
              <Sparkles size={36} className="eve-call-speaking-icon" />
            ) : inProgress ? (
              <Bot size={36} className="eve-call-bot-icon" />
            ) : (
              <PhoneCall size={34} className="eve-call-idle-icon" />
            )}
          </div>
        </div>

        <div className="eve-call-title-group">
          <h3 className="eve-call-title">
            {inProgress ? 'Eve AI Assistant' : 'Call Eve Assistant'}
          </h3>
          <p className="eve-call-subtitle">{statusText}</p>
          {error && <p className="eve-call-error-text" role="alert">{error}</p>}
        </div>

        {!inProgress && (
          <div className="eve-call-idle-actions">
            <button
              type="button"
              className="eve-call-start-btn"
              onClick={() => handleStartCall('audio')}
            >
              <Phone size={16} />
              <span>Start Voice Call</span>
            </button>

            <button
              type="button"
              className="eve-call-start-btn secondary"
              onClick={() => handleStartCall('video')}
            >
              <Video size={16} />
              <span>Start Video Call</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Conversation & Captions Stream ── */}
      <div
        className={`eve-call-captions-drawer ${!inProgress ? 'idle-mode' : ''}`}
        role="log"
        aria-live="polite"
        aria-label="Call conversation stream"
      >
        {transcriptLog.length === 0 && !userTranscript && !eveTranscript ? (
          <div className="eve-call-captions-empty">
            <MessageSquare size={16} />
            <span>
              {inProgress
                ? 'Speak into your microphone or type a message below…'
                : 'Click Start Voice Call or type a message below to converse with Eve.'}
            </span>
          </div>
        ) : (
          <div className="eve-call-captions-list">
            {transcriptLog.map((entry, idx) => (
              <div key={idx} className={`eve-call-caption-bubble ${entry.speaker}`}>
                <div className="caption-avatar">
                  {entry.speaker === 'user' ? <User size={13} /> : <Bot size={13} />}
                </div>
                <div className="caption-content">
                  <div className="caption-meta">
                    <span className="caption-author">{entry.speaker === 'user' ? 'You' : 'Eve'}</span>
                    {entry.time && <span className="caption-time">{entry.time}</span>}
                  </div>
                  <p className="caption-text">{entry.text}</p>
                </div>
              </div>
            ))}

            {isEveThinking && (
              <div className="eve-call-caption-bubble eve thinking">
                <div className="caption-avatar">
                  <Bot size={13} />
                </div>
                <div className="caption-content">
                  <span className="caption-author">Eve</span>
                  <div className="eve-typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={captionsEndRef} />
          </div>
        )}
      </div>

      {/* ── Bottom Controls & Input Footer ── */}
      <div className="eve-call-bottom-toolbar">
        {/* Integrated Text Input Row */}
        <form className="eve-call-text-input-row" onSubmit={handleTextSend}>
          <input
            type="text"
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            placeholder={
              inProgress
                ? 'Type a message to Eve (or speak into your mic)…'
                : 'Type a message to start conversation with Eve…'
            }
            disabled={isEveThinking}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleTextSend(e)
              }
            }}
          />
          <button
            type="submit"
            className="eve-call-text-send-btn"
            disabled={isEveThinking || !textDraft.trim()}
            title="Send message to Eve"
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        </form>

        {/* Live Call Control Actions when in call */}
        {inProgress && (
          <div className="eve-call-controls-row">
            {sttProvider === 'groq' && (
              <button
                type="button"
                className={`eve-call-ctrl-btn ${sttRecording ? 'active-talk' : ''}`}
                onPointerDown={(e) => {
                  e.preventDefault()
                  startSttRecording?.()
                }}
                onPointerUp={stopSttRecording}
                onPointerLeave={stopSttRecording}
                onPointerCancel={stopSttRecording}
                disabled={muted}
                title={sttRecording ? 'Release to send speech' : 'Hold to talk'}
              >
                <Mic size={16} />
                <span>{sttRecording ? 'Recording…' : 'Hold to talk'}</span>
              </button>
            )}

            <button
              type="button"
              className={`eve-call-ctrl-btn ${muted ? 'active-mute' : ''}`}
              onClick={toggleMute}
              title={muted ? 'Unmute microphone' : 'Mute microphone'}
              aria-pressed={muted}
            >
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
              <span>{muted ? 'Muted' : 'Mic On'}</span>
            </button>

            <button
              type="button"
              className={`eve-call-ctrl-btn ${!ttsEnabled ? 'active-mute' : ''}`}
              onClick={toggleTts}
              title={ttsEnabled ? 'Mute Eve voice' : 'Unmute Eve voice'}
              aria-pressed={!ttsEnabled}
            >
              {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{ttsEnabled ? 'Voice On' : 'Voice Off'}</span>
            </button>

            <button
              type="button"
              className="eve-call-hangup-btn"
              onClick={hangUp}
              title="End call session"
              aria-label="End call session"
            >
              <PhoneOff size={16} />
              <span>End Call</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
