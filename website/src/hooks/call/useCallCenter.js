/** Call center hook — single responsibility: orchestrate call lifecycle and signaling. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createCall, createTwilioCall, sendCallSignal, triggerEveCall, triggerEveTwilioCall, updateCallStatus } from '../../lib/callsApi'
import { callsSocket } from '../../lib/callsSocket'
import { startRingtone, stopRingtone } from '../../utils/callWebRTC'
import { notify, requestNotificationPermission } from '../../utils/browserNotifications'
import { BUSY_PHASES, RING_TIMEOUT_MS } from './callConstants'
import { useEveVoice } from './useEveVoice'
import { useWebRTC } from './useWebRTC'

export function useCallCenter({ user }) {
  const [callProvider, setCallProvider] = useState('in_app')
  const [phase, setPhase] = useState('idle')
  const [call, setCall] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [mode, setMode] = useState('video')
  const [error, setError] = useState('')

  const phaseRef = useRef('idle')
  const callIdRef = useRef(null)
  const ringTimerRef = useRef(null)
  const userRef = useRef(user)
  userRef.current = user

  const {
    localStream,
    remoteStream,
    muted,
    videoOff,
    pcRef,
    localStreamRef,
    remoteOfferRef,
    pendingCandidatesRef,
    processedIdsRef,
    cleanupPeer,
    stopLocalMedia,
    createPeer,
    requestMedia,
    flushPendingCandidates,
    toggleMute,
    toggleCamera,
    resetWebRTC,
  } = useWebRTC({ callIdRef })

  const activeCallObj = call || incomingCall
  const isEveCall = Boolean(
    activeCallObj &&
      (activeCallObj.callee?.uid === 'eve-bot' ||
        activeCallObj.caller?.uid === 'eve-bot' ||
        activeCallObj.callee?.email === 'eve@starwaves.app' ||
        activeCallObj.caller?.email === 'eve@starwaves.app'),
  )

  const eveVoice = useEveVoice({ isEveCall, phase, muted, localStreamRef, phaseRef })

  useEffect(() => {
    phaseRef.current = phase
    if (phase === 'incoming' || phase === 'dialing') startRingtone()
    if (phase !== 'incoming' && phase !== 'dialing') stopRingtone()
  }, [phase])

  const teardown = useCallback(
    (nextPhase) => {
      if (ringTimerRef.current) {
        window.clearTimeout(ringTimerRef.current)
        ringTimerRef.current = null
      }
      cleanupPeer()
      stopLocalMedia()
      stopRingtone()
      eveVoice.stopEveVoice()
      resetWebRTC()
      setCall(null)
      setIncomingCall(null)
      setError('')
      setPhase(nextPhase)
    },
    [cleanupPeer, stopLocalMedia, eveVoice, resetWebRTC],
  )

  useEffect(
    () => () => {
      if (ringTimerRef.current) window.clearTimeout(ringTimerRef.current)
      cleanupPeer()
      stopRingtone()
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
    },
    [cleanupPeer, localStreamRef],
  )

  const processMessages = useCallback(
    async (callData) => {
      const myUid = userRef.current?.uid
      const answered = { value: false }
      for (const message of callData.messages || []) {
        if (processedIdsRef.current.has(message.id)) continue
        processedIdsRef.current.add(message.id)
        if (message.from_uid === myUid) continue
        const pc = pcRef.current
        if (message.type === 'offer') {
          remoteOfferRef.current = message.payload
        } else if (message.type === 'answer') {
          if (!pc || !pc.localDescription) continue
          try {
            await pc.setRemoteDescription({ type: 'answer', sdp: message.payload })
            answered.value = true
          } catch {}
        } else if (message.type === 'ice-candidate') {
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(JSON.parse(message.payload))
            } catch {}
          } else {
            pendingCandidatesRef.current.push(message.payload)
          }
        }
      }
      if (answered.value) {
        await flushPendingCandidates()
        setPhase((current) => (current === 'dialing' || current === 'connecting' ? 'active' : current))
      }
    },
    [flushPendingCandidates, pcRef, pendingCandidatesRef, processedIdsRef, remoteOfferRef],
  )

  const handleCallEvent = useCallback(
    async (callData) => {
      if (callData.status === 'declined') {
        notify('Call Declined', `${callData.callee?.name || 'User'} declined your call.`, `call-declined-${callData.id}`)
        teardown('declined')
        return
      }
      if (callData.status === 'missed') {
        notify('Missed Call', `Missed call from ${callData.caller?.name || 'Someone'}.`, `call-missed-${callData.id}`)
        teardown('missed')
        return
      }
      if (callData.status === 'ended') {
        teardown('ended')
        return
      }
      if (callData.status === 'active') {
        // E: answer on another device — incoming should stop ringing everywhere
        if (phaseRef.current === 'incoming') {
          teardown('active')
          return
        }
        setPhase((current) => (current === 'dialing' || current === 'connecting' ? 'active' : current))
      }
      if (callData.status === 'ringing' && phaseRef.current === 'incoming') {
        setCall(callData)
      }
      await processMessages(callData)
    },
    [processMessages, teardown],
  )

  const startRingTimeout = useCallback(() => {
    if (ringTimerRef.current) window.clearTimeout(ringTimerRef.current)
    ringTimerRef.current = window.setTimeout(async () => {
      if (phaseRef.current === 'dialing' && callIdRef.current) {
        try {
          await updateCallStatus(callIdRef.current, 'missed')
        } catch {}
        teardown('missed')
      }
    }, RING_TIMEOUT_MS)
  }, [teardown])

  const dial = useCallback(
    async (calleeIdentifier, requestedMode, provider = 'in_app', phoneNumber = null) => {
      // Dual provider: in_app (WebRTC) or twilio (PSTN)
      if (provider === 'twilio' && phoneNumber) {
        try {
          setError('')
          setCallProvider('twilio')
          const tw = await createTwilioCall(phoneNumber, `Call from ${userRef.current?.displayName || 'StarWaves user'}`, requestedMode)
          callIdRef.current = tw.id
          setCall(tw)
          setMode(requestedMode === 'video' ? 'video' : 'audio')
          setPhase('dialing')
          notify('Calling via Twilio', `Calling ${phoneNumber}…`, `twilio-${tw.id}`)
          return
        } catch (err) {
          setError(err.message || 'Twilio call failed. Check TWILIO config.')
          setPhase('error')
          return
        }
      }
      requestNotificationPermission().catch(() => {})
      const requestMode = requestedMode === 'video' ? 'video' : 'audio'
      setError('')
      setCallProvider('in_app')
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Voice and video calls are not supported in this browser.')
        setPhase('error')
        return
      }
      try {
        await requestMedia(requestMode)
        setMode(requestMode)
        const created = await createCall(calleeIdentifier, requestMode)
        callIdRef.current = created.id
        processedIdsRef.current = new Set()
        remoteOfferRef.current = null
        pendingCandidatesRef.current = []
        setCall(created)

        const targetIsEve = created.callee?.uid === 'eve-bot' || calleeIdentifier.toLowerCase().includes('eve')
        if (targetIsEve || created.status === 'active') {
          setPhase('active')
        } else {
          setPhase('dialing')
          const pc = await createPeer(setPhase)
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          await sendCallSignal(created.id, 'offer', offer.sdp)
          startRingTimeout()
        }
      } catch (err) {
        stopLocalMedia()
        setError(err.message || 'The call could not be started.')
        setPhase('error')
      }
    },
    [createPeer, requestMedia, startRingTimeout, stopLocalMedia, pendingCandidatesRef, processedIdsRef, remoteOfferRef],
  )

  const accept = useCallback(async () => {
    requestNotificationPermission().catch(() => {})
    const callId = callIdRef.current
    const requestedMode = mode
    if (!callId) return
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Voice and video calls are not supported in this browser.')
      setPhase('error')
      return
    }
    try {
      await requestMedia(requestedMode)
      stopRingtone()
      const currentCall = call || incomingCall
      const targetIsEve = currentCall?.caller?.uid === 'eve-bot' || currentCall?.callee?.uid === 'eve-bot'
      if (targetIsEve) {
        await updateCallStatus(callId, 'active')
        setPhase('active')
      } else {
        setPhase('connecting')
        await createPeer(setPhase)
        if (remoteOfferRef.current) {
          await pcRef.current.setRemoteDescription({ type: 'offer', sdp: remoteOfferRef.current })
          const answer = await pcRef.current.createAnswer()
          await pcRef.current.setLocalDescription(answer)
          await sendCallSignal(callId, 'answer', answer.sdp)
          await flushPendingCandidates()
        }
        await updateCallStatus(callId, 'active')
      }
    } catch (err) {
      stopLocalMedia()
      setError(err.message || 'The call could not be answered.')
      setPhase('error')
    }
  }, [createPeer, flushPendingCandidates, mode, requestMedia, stopLocalMedia, call, incomingCall, pcRef, remoteOfferRef])

  const requestEveCall = useCallback(
    async (requestedMode = 'audio', provider = 'in_app', phoneNumber = null, prompt = null) => {
      try {
        setError('')
        let created
        if (provider === 'twilio' && phoneNumber) {
          created = await triggerEveTwilioCall(phoneNumber, prompt, requestedMode)
          setCallProvider('twilio')
        } else {
          created = await triggerEveCall(requestedMode)
          setCallProvider('in_app')
        }
        callIdRef.current = created.id
        setIncomingCall(created)
        setMode(requestedMode)
        setPhase('incoming')
        notify('Incoming Eve Call', provider === 'twilio' ? `Eve calling ${phoneNumber} via phone` : 'Incoming voice call from Eve AI Assistant', `call-incoming-${created.id}`)
      } catch (err) {
        setError(err.message || 'Could not request call from Eve.')
        setPhase('error')
      }
    },
    [],
  )

  const decline = useCallback(async () => {
    const callId = callIdRef.current
    if (!callId) return
    try {
      await updateCallStatus(callId, 'declined')
    } catch {}
    teardown('declined')
  }, [teardown])

  const hangUp = useCallback(async () => {
    const callId = callIdRef.current
    if (!callId) return
    try {
      await updateCallStatus(callId, 'ended')
    } catch {}
    teardown('ended')
  }, [teardown])

  const dismiss = useCallback(() => {
    teardown('idle')
  }, [teardown])

  useEffect(() => {
    if (!user && phaseRef.current !== 'idle') {
      teardown('idle')
    }
  }, [teardown, user])

  const handleCallEventRef = useRef(handleCallEvent)
  handleCallEventRef.current = handleCallEvent

  // E: cross-tab sync via BroadcastChannel for instant local propagation
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined
    let ch
    try {
      ch = new BroadcastChannel('starwaves-call')
      ch.onmessage = async (msg) => {
        const ev = msg?.data
        if (!ev) return
        if (ev.type === 'call_updated' && ev.call?.id === callIdRef.current) {
          await handleCallEventRef.current(ev.call)
        }
      }
    } catch { return undefined }
    return () => { try { ch?.close() } catch {} }
  }, [])

  const userUid = user?.uid
  useEffect(() => {
    if (!userUid) return undefined
    const unsubscribe = callsSocket.subscribe(async (event) => {
      // Also rebroadcast to local tabs via BroadcastChannel for instant sync
      try {
        if (event.type === 'call_updated' && typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('starwaves-call')
          ch.postMessage(event)
          ch.close()
        }
      } catch {}
      if (event.type === 'incoming_call') {
        const ringing = event.call
        // E: ring on ALL devices — even if busy, still surface if not same id
        if (ringing.id !== callIdRef.current) {
          if (!BUSY_PHASES.includes(phaseRef.current)) {
            callIdRef.current = ringing.id
            processedIdsRef.current = new Set()
            remoteOfferRef.current = null
            pendingCandidatesRef.current = []
            setCall(null)
            setIncomingCall(ringing)
            setMode(ringing.mode === 'video' ? 'video' : 'audio')
            setPhase('incoming')
            notify('Incoming Call', `Incoming ${ringing.mode || 'video'} call from ${ringing.caller?.name || 'Someone'}`, `call-incoming-${ringing.id}`)
          } else {
            // BUSY on this device — still notify as missed-like but don't overwrite current call
            notify('Incoming Call (busy)', `${ringing.caller?.name || 'Someone'} is calling… (busy on this device)`, `call-incoming-busy-${ringing.id}`)
          }
        }
      } else if (event.type === 'call_signal' || event.type === 'call_updated') {
        const callData = event.call
        if (callData.id === callIdRef.current) {
          await handleCallEventRef.current(callData)
        }
      }
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUid])

  return {
    phase,
    call,
    incomingCall,
    mode,
    callProvider,
    setCallProvider,
    localStream,
    remoteStream,
    muted,
    videoOff,
    error,
    isEveCall,
    userTranscript: eveVoice.userTranscript,
    eveTranscript: eveVoice.eveTranscript,
    isEveSpeaking: eveVoice.isEveSpeaking,
    isEveThinking: eveVoice.isEveThinking,
    ttsEnabled: eveVoice.ttsEnabled,
    sttSupported: eveVoice.sttSupported,
    sttStatus: eveVoice.sttStatus,
    sttRecording: eveVoice.sttRecording,
    sttProvider: eveVoice.speechPrefs.sttProvider,
    ttsProvider: eveVoice.speechPrefs.ttsProvider,
    dial,
    accept,
    decline,
    hangUp,
    dismiss,
    toggleMute,
    toggleCamera,
    toggleTts: eveVoice.toggleTts,
    requestEveCall,
    sendVoiceToEve: eveVoice.sendVoiceToEve,
    interruptEve: eveVoice.interruptEve,
    startSttRecording: eveVoice.startSttRecording,
    stopSttRecording: eveVoice.stopSttRecording,
  }
}
