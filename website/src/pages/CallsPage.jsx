import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Bot, Loader, Phone, PhoneCall, PhoneIncoming, RefreshCw, Video } from 'lucide-react'
import { CallScreen } from '../components/calls/CallScreen'
import { ScheduledCallsSection } from '../components/calls/ScheduledCallsSection'
import { PageHeader } from '../components/ui'
import { getRecentCalls, getTwilioConfig } from '../lib/callsApi'
import {
  callStatusLabel,
  callTimeAgo,
  otherParticipant,
  participantInitials,
  participantName,
} from '../utils/callDisplay'

const ACTIVE_CALL_PHASES = [
  'dialing',
  'connecting',
  'active',
  'declined',
  'ended',
  'missed',
  'error',
]

export function CallsPage({ callCenter, user }) {
  const myUid = user?.uid
  const { phase, dial, requestEveCall } = callCenter
  const [calleeIdentifier, setCalleeIdentifier] = useState('')
  const [mode, setMode] = useState('video')
  const [provider, setProvider] = useState('in_app')
  const [twilioPhone, setTwilioPhone] = useState('')
  const [twilioPhoneEve, setTwilioPhoneEve] = useState('')
  const [twilioEnabled, setTwilioEnabled] = useState(false)
  const [recent, setRecent] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [recentError, setRecentError] = useState('')

  const loadRecent = useCallback(() => {
    setLoadingRecent(true)
    setRecentError('')
    getRecentCalls()
      .then((calls) => setRecent(calls || []))
      .catch((err) => setRecentError(err.message || 'Could not load recent calls.'))
      .finally(() => setLoadingRecent(false))
  }, [])

  useEffect(() => {
    loadRecent()
  }, [loadRecent, phase])

  useEffect(() => {
    getTwilioConfig()
      .then((c) => setTwilioEnabled(Boolean(c?.enabled || c?.configured)))
      .catch(() => setTwilioEnabled(false))
  }, [])

  const handleStartCall = (e) => {
    e?.preventDefault()
    if (provider === 'twilio') {
      const phone = twilioPhone.trim()
      if (!phone) return
      dial(phone, mode, 'twilio', phone)
      return
    }
    const identifier = calleeIdentifier.trim()
    if (!identifier) return
    dial(identifier, mode, 'in_app')
  }

  const callBack = (targetIdentifier, callMode) => {
    if (!targetIdentifier) return
    dial(targetIdentifier, callMode, 'in_app')
  }

  const handleCallEve = () => {
    dial('eve@starwaves.app', 'audio', 'in_app')
  }

  const handleRequestEveCall = () => {
    if (provider === 'twilio' && twilioPhoneEve.trim()) {
      requestEveCall?.('audio', 'twilio', twilioPhoneEve.trim(), 'Hello from StarWaves Eve')
    } else {
      requestEveCall?.('audio', 'in_app')
    }
  }

  const inCall = ACTIVE_CALL_PHASES.includes(phase)

  return (
    <section className="calls-page">
      <PageHeader
        eyebrow="Communication"
        title="Calls"
        actions={
          <>
            <button
              type="button"
              className="secondary-button"
              onClick={handleCallEve}
              title="Start voice call with Eve AI Assistant"
            >
              <PhoneCall size={15} />
              <span>Call Eve</span>
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleRequestEveCall}
              title="Have Eve initiate an incoming call to you"
            >
              <PhoneIncoming size={15} />
              <span>Eve Call Me</span>
            </button>
            <button
              className="icon-button"
              onClick={loadRecent}
              disabled={loadingRecent}
              title="Refresh recent calls"
            >
              <RefreshCw size={16} className={loadingRecent ? 'calls-spin' : ''} />
            </button>
          </>
        }
      />

      {inCall && (
        <div className="calls-session-panel">
          <CallScreen callCenter={callCenter} myUid={myUid} />
        </div>
      )}

      <div className="calls-layout">
        <div className="calls-dialer-card">
          <div className="calls-dialer-header">
            <h2>Start a call</h2>
            <p>Call another StarWaves user or Eve AI Assistant (<code>eve</code> or <code>eve@starwaves.app</code>).</p>
          </div>

          <div className="eve-quick-call-box">
            <div className="eve-quick-call-title">
              <Bot size={16} />
              <span>Eve AI Assistant</span>
            </div>
            <p className="eve-quick-call-desc">Have a real-time voice call with your StarWaves AI assistant. Choose in-app (WebRTC) or real phone via Twilio.</p>
            {twilioEnabled && (
              <div className="calls-provider-toggle" role="group" aria-label="Eve call provider">
                <button type="button" className={`calls-mode-option ${provider === 'in_app' ? 'active' : ''}`} onClick={() => setProvider('in_app')} aria-pressed={provider === 'in_app'}>In-App</button>
                <button type="button" className={`calls-mode-option ${provider === 'twilio' ? 'active' : ''}`} onClick={() => setProvider('twilio')} aria-pressed={provider === 'twilio'}>Phone (Twilio)</button>
              </div>
            )}
            {provider === 'twilio' && (
              <input type="tel" className="form-input" placeholder="+14155551234" value={twilioPhoneEve} onChange={(e) => setTwilioPhoneEve(e.target.value)} aria-label="Eve Twilio phone" />
            )}
            <div className="eve-quick-call-buttons">
              <button
                type="button"
                className="primary-button"
                onClick={handleCallEve}
                disabled={phase === 'dialing' || phase === 'connecting'}
              >
                <PhoneCall size={14} />
                <span>Call Eve</span>
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleRequestEveCall}
                disabled={phase === 'dialing' || phase === 'connecting' || (provider === 'twilio' && !twilioPhoneEve.trim())}
                title={provider === 'twilio' ? 'Eve calls your phone' : 'Eve calls you in-app'}
              >
                <PhoneIncoming size={14} />
                <span>{provider === 'twilio' ? 'Eve Call My Phone' : 'Eve Call Me'}</span>
              </button>
            </div>
          </div>

          <div className="calls-mode-toggle" role="group" aria-label="Call type">
            <button
              type="button"
              className={`calls-mode-option ${mode === 'audio' ? 'active' : ''}`}
              onClick={() => setMode('audio')}
              aria-pressed={mode === 'audio'}
            >
              <Phone size={16} />
              <span>Voice</span>
            </button>
            <button
              type="button"
              className={`calls-mode-option ${mode === 'video' ? 'active' : ''}`}
              onClick={() => setMode('video')}
              aria-pressed={mode === 'video'}
            >
              <Video size={16} />
              <span>Video</span>
            </button>
          </div>

          {twilioEnabled && (
            <div className="calls-provider-toggle" role="group" aria-label="Call provider" style={{ marginBottom: 12 }}>
              <button type="button" className={`calls-mode-option ${provider === 'in_app' ? 'active' : ''}`} onClick={() => setProvider('in_app')} aria-pressed={provider === 'in_app'}>In-App</button>
              <button type="button" className={`calls-mode-option ${provider === 'twilio' ? 'active' : ''}`} onClick={() => setProvider('twilio')} aria-pressed={provider === 'twilio'}>Phone (Twilio)</button>
            </div>
          )}
          <form className="calls-dialer-form" onSubmit={handleStartCall}>
            {provider === 'twilio' ? (
              <>
                <label className="input-label" htmlFor="twilio-phone">Phone (E.164)</label>
                <input id="twilio-phone" type="tel" className="form-input" placeholder="+14155551234" value={twilioPhone} onChange={(e) => setTwilioPhone(e.target.value)} autoComplete="tel" />
              </>
            ) : (
              <>
                <label className="input-label" htmlFor="caller-identifier">Recipient</label>
                <input id="caller-identifier" type="text" className="form-input" placeholder="name@example.com or eve" value={calleeIdentifier} onChange={(e) => setCalleeIdentifier(e.target.value)} autoComplete="email" />
              </>
            )}
            <button
              type="submit"
              className="primary-button calls-dial-button"
              disabled={(provider === 'twilio' ? !twilioPhone.trim() : !calleeIdentifier.trim()) || phase === 'dialing' || phase === 'connecting'}
            >
              {phase === 'dialing' || phase === 'connecting' ? (
                <Loader size={16} className="calls-spin" />
              ) : mode === 'video' ? (
                <Video size={16} />
              ) : (
                <Phone size={16} />
              )}
              <span>{provider === 'twilio' ? 'Call Phone' : mode === 'video' ? 'Start video call' : 'Start voice call'}</span>
            </button>
          </form>
        </div>

        <div className="calls-recent-card">
          <div className="calls-recent-header">
            <h2>Recent calls</h2>
          </div>

          {recentError && (
            <div className="calls-recent-error" role="alert">
              <AlertCircle size={16} />
              <span>{recentError}</span>
            </div>
          )}

          {loadingRecent ? (
            <div className="calls-recent-empty">
              <Loader size={22} className="calls-spin" />
              <p>Loading recent calls…</p>
            </div>
          ) : recent.length === 0 ? (
            <div className="calls-recent-empty">
              <Phone size={28} />
              <p>No calls yet. Dial a StarWaves user to get started.</p>
            </div>
          ) : (
            <ul className="calls-recent-list">
              {recent.map((call) => {
                const other = otherParticipant(call, myUid)
                const otherIdentifier = other?.email || other?.uid
                const isOther = call.caller?.uid === myUid ? 'Outgoing' : 'Incoming'
                return (
                  <li key={call.id} className="calls-recent-item">
                    <span className="calls-recent-avatar" aria-hidden="true">
                      {participantInitials(other)}
                    </span>
                    <span className="calls-recent-info">
                      <span className="calls-recent-name">{participantName(other)}</span>
                      <span className="calls-recent-meta">
                        <span className={`calls-recent-direction ${isOther === 'Incoming' ? 'incoming' : ''}`}>
                          {isOther}
                        </span>
                        · {callStatusLabel(call.status)} · {callTimeAgo(call.updated_at || call.created_at)}
                      </span>
                    </span>
                    <span className="calls-recent-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title="Call again (voice)"
                        onClick={() => callBack(otherIdentifier, 'audio')}
                        disabled={!otherIdentifier}
                      >
                        <Phone size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        title="Call again (video)"
                        onClick={() => callBack(otherIdentifier, 'video')}
                        disabled={!otherIdentifier}
                      >
                        <Video size={16} />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <ScheduledCallsSection />
    </section>
  )
}