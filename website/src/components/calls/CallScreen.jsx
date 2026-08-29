import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  CircleStop,
  Loader,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Sparkles,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react'
import {
  formatElapsed,
  otherParticipant,
  participantInitials,
  participantName,
} from '../../utils/callDisplay'

const IN_PROGRESS_PHASES = ['dialing', 'connecting', 'active']

export function CallScreen({ callCenter, myUid }) {
  const {
    phase,
    call,
    incomingCall,
    mode,
    localStream,
    remoteStream,
    muted,
    videoOff,
    error,
    isEveCall,
    userTranscript,
    eveTranscript,
    isEveSpeaking,
    isEveThinking,
    ttsEnabled,
    sttStatus,
    sttRecording,
    sttProvider,
    startSttRecording,
    stopSttRecording,
    hangUp,
    dismiss,
    toggleMute,
    toggleCamera,
    toggleTts,
    sendVoiceToEve,
    interruptEve,
  } = callCenter

  const remote = otherParticipant(call || incomingCall, myUid)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const [elapsed, setElapsed] = useState(0)
  const [textDraft, setTextDraft] = useState('')

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream])

  useEffect(() => {
    if (phase !== 'active') {
      setElapsed(0)
      return undefined
    }
    const startedAt = Date.now()
    setElapsed(0)
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [phase])

  const inProgress = IN_PROGRESS_PHASES.includes(phase)
  const isVideo = mode === 'video'
  const hasRemoteVideo = Boolean(
    remoteStream && remoteStream.getVideoTracks().length > 0,
  )
  const name = isEveCall ? 'Eve AI Assistant' : participantName(remote)
  const initials = isEveCall ? 'EV' : participantInitials(remote)

  let statusText = ''
  if (phase === 'dialing') statusText = 'Ringing…'
  else if (phase === 'connecting') statusText = 'Connecting…'
  else if (phase === 'active') {
    if (isEveCall) {
      if (isEveThinking) statusText = 'Thinking…'
      else if (isEveSpeaking) statusText = 'Speaking…'
      else if (muted) statusText = 'Microphone muted'
      else if (sttStatus === 'unsupported') statusText = 'Voice input not supported here'
      else if (sttStatus === 'permission') statusText = 'Microphone permission needed'
      else if (sttStatus === 'error') statusText = 'Voice input unavailable'
      else if (sttProvider === 'groq') {
        statusText = sttRecording ? 'Listening…' : 'Hold to talk to Eve'
      } else statusText = `Listening… (${formatElapsed(elapsed)})`
    } else {
      statusText = formatElapsed(elapsed)
    }
  } else if (phase === 'declined') statusText = 'Call declined'
  else if (phase === 'missed') statusText = 'Call missed'
  else if (phase === 'ended') statusText = 'Call ended'
  else if (phase === 'error') statusText = 'Call failed'

  let sttHint = ''
  if (isEveCall && inProgress) {
    if (sttProvider === 'groq') {
      sttHint = sttRecording
        ? 'Release to send your message to Eve.'
        : 'Hold the mic button to talk to Eve.'
    } else if (sttStatus === 'unsupported') {
      sttHint = 'Speech recognition is not supported in this browser. Type your message below instead.'
    } else if (sttStatus === 'permission') {
      sttHint = 'Microphone permission was denied. Allow microphone access to use voice commands, or type below.'
    } else if (sttStatus === 'error') {
      sttHint = 'Voice input ran into an error. Type your message below instead.'
    }
  }

  const showTextFallback = isEveCall && inProgress && sttStatus !== 'listening'

  const handleTextSend = (event) => {
    event.preventDefault()
    const text = textDraft.trim()
    if (!text || isEveThinking) return
    sendVoiceToEve(text)
    setTextDraft('')
  }

  if (isEveCall && inProgress) {
    return (
      <div className="call-screen eve-call-screen">
        <div className="call-screen-stage eve-stage">
          <div className="eve-visualizer-container">
            <div
              className={`eve-pulse-avatar ${isEveSpeaking ? 'speaking' : ''} ${
                isEveThinking ? 'thinking' : ''
              }`}
            >
              <div className="eve-pulse-ring ring-1" />
              <div className="eve-pulse-ring ring-2" />
              <div className="eve-pulse-ring ring-3" />
              <div className="eve-pulse-core">
                {isEveThinking ? (
                  <Loader size={36} className="calls-spin" />
                ) : (
                  <Bot size={40} />
                )}
              </div>
            </div>
            <div className="eve-visualizer-badge">
              <Sparkles size={14} />
              <span>Eve AI Voice Session</span>
            </div>
          </div>

          <div className="call-screen-info eve-info">
            <h3 className="call-screen-name">{name}</h3>
            <p className="call-screen-status">{statusText}</p>
            {phase === 'error' && error && (
              <p className="call-screen-error" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* Live Captions Box */}
          <div className="eve-captions-box" role="log" aria-live="polite">
            {userTranscript && (
              <div className="eve-caption-row user">
                <span className="caption-speaker">You:</span>
                <span className="caption-text">{userTranscript}</span>
              </div>
            )}
            <div className="eve-caption-row assistant">
              <span className="caption-speaker">Eve:</span>
              <span className="caption-text">{eveTranscript}</span>
            </div>
          </div>

          {showTextFallback && (
            <form className="eve-text-fallback" onSubmit={handleTextSend}>
              {sttHint && (
                <p className="eve-stt-hint" role="status">
                  {sttHint}
                </p>
              )}
              <label htmlFor="eve-text-input">Type a message to Eve</label>
              <div className="eve-text-fallback-row">
                <input
                  id="eve-text-input"
                  type="text"
                  value={textDraft}
                  onChange={(event) => setTextDraft(event.target.value)}
                  placeholder="Type a message to Eve…"
                  disabled={isEveThinking}
                />
                <button
                  type="submit"
                  disabled={isEveThinking || !textDraft.trim()}
                  title="Send message"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="call-controls">
          {sttProvider === 'groq' ? (
            <button
              type="button"
              className={`call-control-button ${sttRecording ? 'active' : ''}`}
              onPointerDown={(event) => {
                event.preventDefault()
                // Barge-in: pressing the mic while Eve speaks cuts her off.
                if ((isEveSpeaking || isEveThinking) && interruptEve) interruptEve()
                startSttRecording()
              }}
              onPointerUp={stopSttRecording}
              onPointerLeave={stopSttRecording}
              onPointerCancel={stopSttRecording}
              aria-pressed={sttRecording}
              title={sttRecording ? 'Release to send your message' : 'Hold to talk to Eve'}
              disabled={muted}
            >
              <Mic size={22} />
            </button>
          ) : null}
          {(isEveCall && (isEveSpeaking || isEveThinking) && interruptEve) && (
            <button
              type="button"
              className="call-control-button active"
              onClick={interruptEve}
              aria-label="Interrupt Eve"
              title="Interrupt Eve — talk over her"
            >
              <CircleStop size={22} />
            </button>
          )}
          <button
            type="button"
            className={`call-control-button ${muted ? 'active' : ''}`}
            onClick={toggleMute}
            aria-pressed={muted}
            title={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          <button
            type="button"
            className={`call-control-button ${!ttsEnabled ? 'active' : ''}`}
            onClick={toggleTts}
            aria-pressed={ttsEnabled}
            title={ttsEnabled ? 'Mute Eve voice' : 'Enable Eve voice'}
          >
            {ttsEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>
          <button
            type="button"
            className="call-control-button call-control-end"
            onClick={hangUp}
            title="End call"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="call-screen">
      <div className="call-screen-stage">
        {isVideo && inProgress && hasRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            className="call-remote-video"
            autoPlay
            playsInline
          />
        ) : (
          <div className="call-avatar-block">
            <span className="call-avatar" aria-hidden="true">
              {initials}
            </span>
            {!inProgress && (
              <span className="call-state-icon" aria-hidden="true">
                {phase === 'declined' || phase === 'missed' || phase === 'ended' || phase === 'error' ? (
                  <PhoneOff size={20} />
                ) : (
                  <Wifi size={20} />
                )}
              </span>
            )}
          </div>
        )}

        {inProgress && isVideo && localStream && (
          <video
            ref={localVideoRef}
            className="call-local-video"
            autoPlay
            playsInline
            muted
          />
        )}

        <div className="call-screen-info">
          <h3 className="call-screen-name">{name}</h3>
          <p className="call-screen-status">{statusText}</p>
          {phase === 'error' && error && (
            <p className="call-screen-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>

      {inProgress && (
        <div className="call-controls">
          <button
            type="button"
            className={`call-control-button ${muted ? 'active' : ''}`}
            onClick={toggleMute}
            aria-pressed={muted}
            title={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          {isVideo && (
            <button
              type="button"
              className={`call-control-button ${videoOff ? 'active' : ''}`}
              onClick={toggleCamera}
              aria-pressed={videoOff}
              title={videoOff ? 'Turn camera on' : 'Turn camera off'}
            >
              {videoOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}
          <button
            type="button"
            className="call-control-button call-control-end"
            onClick={hangUp}
            title="End call"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      )}

      {!inProgress && (
        <div className="call-controls">
          <button
            type="button"
            className="call-control-button call-control-dismiss"
            onClick={dismiss}
            title="Close"
          >
            <WifiOff size={20} />
            <span>Close</span>
          </button>
        </div>
      )}

      {!inProgress && (phase === 'missed' || phase === 'ended' || phase === 'declined') && (
        <p className="call-screen-hint">
          You can start a new call from the dialer below.
        </p>
      )}
    </div>
  )
}