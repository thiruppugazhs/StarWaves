/** WebRTC hook — single responsibility: peer connection and media management. */
import { useCallback, useRef, useState } from 'react'
import { sendCallSignal } from '../../lib/callsApi'
import { ICE_SERVERS } from '../../utils/callWebRTC'

export function useWebRTC({ callIdRef }) {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [muted, setMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const remoteOfferRef = useRef(null)
  const pendingCandidatesRef = useRef([])
  const processedIdsRef = useRef(new Set())

  const cleanupPeer = useCallback(() => {
    const pc = pcRef.current
    if (pc) {
      try {
        pc.ontrack = null
        pc.onicecandidate = null
        pc.onconnectionstatechange = null
        pc.close()
      } catch {}
      pcRef.current = null
    }
  }, [])

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    setLocalStream(null)
  }, [])

  const createPeer = useCallback(async (setPhase) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc
    localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current))
    pc.ontrack = (event) => {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream()
        setRemoteStream(remoteStreamRef.current)
      }
      remoteStreamRef.current.addTrack(event.track)
    }
    pc.onicecandidate = (event) => {
      if (event.candidate && callIdRef.current) {
        sendCallSignal(callIdRef.current, 'ice-candidate', JSON.stringify(event.candidate)).catch(() => {})
      }
    }
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'connected') {
        setPhase((current) => (current === 'dialing' || current === 'connecting' ? 'active' : current))
      } else if (state === 'closed') {
        setPhase((current) => (current === 'active' ? 'ended' : current))
      } else if (state === 'failed') {
        setPhase('error')
      }
    }
    return pc
  }, [callIdRef])

  const requestMedia = useCallback(async (requestedMode) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: requestedMode === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    })
    localStreamRef.current = stream
    setLocalStream(stream)
    return stream
  }, [])

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current
    if (!pc) return
    const waiting = pendingCandidatesRef.current
    pendingCandidatesRef.current = []
    for (const candidate of waiting) {
      try {
        await pc.addIceCandidate(JSON.parse(candidate))
      } catch {}
    }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next
      })
      return next
    })
  }, [])

  const toggleCamera = useCallback(() => {
    setVideoOff((current) => {
      const next = !current
      localStreamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = !next
      })
      return next
    })
  }, [])

  const resetWebRTC = useCallback(() => {
    cleanupPeer()
    stopLocalMedia()
    setRemoteStream(null)
    setMuted(false)
    setVideoOff(false)
    callIdRef.current = null
    processedIdsRef.current = new Set()
    remoteOfferRef.current = null
    pendingCandidatesRef.current = []
  }, [cleanupPeer, stopLocalMedia, callIdRef])

  return {
    localStream,
    remoteStream,
    muted,
    videoOff,
    pcRef,
    localStreamRef,
    remoteStreamRef,
    remoteOfferRef,
    pendingCandidatesRef,
    processedIdsRef,
    setLocalStream,
    setRemoteStream,
    setMuted,
    setVideoOff,
    cleanupPeer,
    stopLocalMedia,
    createPeer,
    requestMedia,
    flushPendingCandidates,
    toggleMute,
    toggleCamera,
    resetWebRTC,
  }
}
