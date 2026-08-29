import { Phone, PhoneOff, Video } from 'lucide-react'
import {
  participantInitials,
  participantName,
  otherParticipant,
} from '../../utils/callDisplay'

// Global overlay that appears when the signed-in user has a ringing incoming
// call, rendered from App.jsx so it is visible on every workspace page.
export function IncomingCallOverlay({ callCenter, myUid }) {
  const { phase, incomingCall, accept, decline } = callCenter
  if (phase !== 'incoming' || !incomingCall) return null

  const caller = otherParticipant(incomingCall, myUid) || incomingCall.caller
  const name = participantName(caller)
  const initials = participantInitials(caller)
  const isVideo = incomingCall.mode === 'video'

  return (
    <div className="incoming-call-backdrop" role="dialog" aria-modal="true" aria-label="Incoming call">
      <div className="incoming-call-card">
        <div className="incoming-call-ring" aria-hidden="true">
          <span className="call-avatar call-avatar-large">{initials}</span>
        </div>

        <p className="incoming-call-label">Incoming call</p>
        <h2 className="incoming-call-name">{name}</h2>
        <p className="incoming-call-meta">
          {isVideo ? <Video size={14} /> : <Phone size={14} />}
          {isVideo ? 'Video call' : 'Voice call'}
        </p>

        <div className="incoming-call-actions">
          <button
            type="button"
            className="incoming-call-action incoming-call-decline"
            onClick={decline}
            title="Decline call"
          >
            <PhoneOff size={24} />
            <span>Decline</span>
          </button>
          <button
            type="button"
            className="incoming-call-action incoming-call-accept"
            onClick={accept}
            title="Accept call"
          >
            <Phone size={24} />
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  )
}