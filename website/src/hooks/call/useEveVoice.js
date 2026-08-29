/** Eve voice hook — single responsibility: STT/TTS and Eve conversation. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { sendEveMessage, streamEveVoice } from '../../lib/eveApi'
import { loadEveSpeech, transcribeEveAudio } from '../../lib/eveSpeechApi'
import { streamEveSpeech } from '../../lib/eveSpeechStream'
import { isSpeechRecognitionSupported, loadEveVoicePrefs, selectVoice } from '../../utils/speech'
import { ECHO_COOLDOWN_MS } from './callConstants'
import { pickAudioMimeType, resolveSpeechProviders } from './callHelpers'

export function useEveVoice({ isEveCall, phase, muted, localStreamRef, phaseRef }) {
  const [userTranscript, setUserTranscript] = useState('')
  const [eveTranscript, setEveTranscript] = useState('Hello! I’m Eve. How can I help you today?')
  const [isEveSpeaking, setIsEveSpeaking] = useState(false)
  const [isEveThinking, setIsEveThinking] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [sttRecording, setSttRecording] = useState(false)
  const [sttStatus, setSttStatus] = useState(() => (isSpeechRecognitionSupported() ? 'idle' : 'unsupported'))
  const [sttSupported] = useState(() => isSpeechRecognitionSupported())
  const [speechPrefs, setSpeechPrefs] = useState(() => resolveSpeechProviders(null))
  const speechPrefsRef = useRef(speechPrefs)
  speechPrefsRef.current = speechPrefs

  const recognitionRef = useRef(null)
  const permissionBlockedRef = useRef(false)
  const isEveSpeakingRef = useRef(false)
  const lastSpeechEndRef = useRef(0)
  const ttsEnabledRef = useRef(ttsEnabled)
  const eveAudioRef = useRef(null)
  const abortTurnRef = useRef(null)
  const playQueueRef = useRef([])
  const mediaRecorderRef = useRef(null)
  const mediaChunksRef = useRef([])
  const audioStreamRef = useRef(null)
  ttsEnabledRef.current = ttsEnabled
  const isEveThinkingRef = useRef(isEveThinking)
  isEveThinkingRef.current = isEveThinking

  const speakServerResponse = useCallback((text) => {
    const prefs = loadEveVoicePrefs()
    const voice = speechPrefsRef.current.ttsVoice
    const provider = speechPrefsRef.current.ttsProvider
    // Google has no true streaming — use server-side streaming envelope which
    // falls back to single-chunk for google but streams progressively for Fish.
    const useStream = provider === 'openrouter' || provider === 'google'
    if (useStream) {
      // Stop any previous stream
      if (eveAudioRef.current) {
        try {
          eveAudioRef.current.pause()
        } catch {}
        eveAudioRef.current = null
      }
      isEveSpeakingRef.current = true
      setIsEveSpeaking(true)
      streamEveSpeech({
        text,
        language: prefs.language,
        voice,
        rate: prefs.rate,
        pitch: prefs.pitch - 1,
      })
        .then(({ audio }) => {
          eveAudioRef.current = audio
          const finish = () => {
            if (eveAudioRef.current === audio) eveAudioRef.current = null
            isEveSpeakingRef.current = false
            lastSpeechEndRef.current = Date.now()
            setIsEveSpeaking(false)
          }
          audio.onended = finish
          audio.onerror = finish
        })
        .catch(() => {
          isEveSpeakingRef.current = false
          lastSpeechEndRef.current = Date.now()
          setIsEveSpeaking(false)
        })
      return
    }
    // Fallback (should not reach here for server providers)
    isEveSpeakingRef.current = false
    setIsEveSpeaking(false)
  }, [])

  const speakEveResponse = useCallback(
    (text) => {
      if (!text) return
      setEveTranscript(text)
      if (!ttsEnabledRef.current) return

      if (speechPrefsRef.current.ttsProvider === 'google' || speechPrefsRef.current.ttsProvider === 'openrouter') {
        speakServerResponse(text)
        return
      }

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

      const prefs = loadEveVoicePrefs()
      const voices = window.speechSynthesis.getVoices() || []
      const voice = selectVoice(prefs, voices)

      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      if (voice) utterance.voice = voice
      utterance.lang = prefs.language
      utterance.rate = prefs.rate
      utterance.pitch = prefs.pitch
      const stopSpeaking = () => {
        isEveSpeakingRef.current = false
        lastSpeechEndRef.current = Date.now()
        setIsEveSpeaking(false)
      }
      utterance.onstart = () => {
        isEveSpeakingRef.current = true
        setIsEveSpeaking(true)
      }
      utterance.onend = stopSpeaking
      utterance.onerror = stopSpeaking
      window.speechSynthesis.speak(utterance)
    },
    [speakServerResponse],
  )

  const stopPlayback = useCallback(() => {
    playQueueRef.current.length = 0
    if (eveAudioRef.current) {
      try {
        eveAudioRef.current.pause()
      } catch {}
      try {
        eveAudioRef.current.src = ''
      } catch {}
      eveAudioRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {}
    }
  }, [])

  const sendVoiceToEve = useCallback(
    async (text) => {
      if (!text || !text.trim()) return
      const clean = text.trim()
      // Newer speech supersedes an in-flight turn (barge-in semantics):
      // abort the previous stream/playback instead of silently dropping.
      if (abortTurnRef.current) {
        abortTurnRef.current.abort()
        stopPlayback()
        setIsEveThinking(false)
      }
      const controller = new AbortController()
      abortTurnRef.current = controller
      setUserTranscript(clean)
      setIsEveThinking(true)
      setEveTranscript('')

      // Fast path: streaming voice endpoint — first audio <1s.
      // Audio chunks play sequentially; browser-provider chunks speak locally.
      let sawAudio = false
      let streamFailed = false
      const audioQueueRef = playQueueRef.current
      const playNextChunk = () => {
        const next = audioQueueRef.shift()
        if (!next) {
          isEveSpeakingRef.current = false
          lastSpeechEndRef.current = Date.now()
          setIsEveSpeaking(false)
          return
        }
        if (next.audio_base64) {
          try {
            const binary = atob(next.audio_base64)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; ++i) bytes[i] = binary.charCodeAt(i)
            const blob = new Blob([bytes], { type: next.mime || 'audio/mpeg' })
            const url = URL.createObjectURL(blob)
            const audio = new Audio(url)
            eveAudioRef.current = audio
            audio.onended = () => {
              URL.revokeObjectURL(url)
              playNextChunk()
            }
            audio.onerror = () => {
              URL.revokeObjectURL(url)
              playNextChunk()
            }
            audio.play().catch(() => playNextChunk())
          } catch {
            playNextChunk()
          }
        } else if (next.text && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const prefs = loadEveVoicePrefs()
          const voices = window.speechSynthesis.getVoices() || []
          const voice = selectVoice(prefs, voices)
          const utterance = new SpeechSynthesisUtterance(next.text)
          if (voice) utterance.voice = voice
          utterance.lang = prefs.language
          utterance.rate = prefs.rate
          utterance.pitch = prefs.pitch
          utterance.onend = playNextChunk
          utterance.onerror = playNextChunk
          window.speechSynthesis.speak(utterance)
        } else {
          playNextChunk()
        }
      }

      try {
        await streamEveVoice({
          messages: [{ role: 'user', content: clean }],
          sessionId: null,
          signal: controller.signal,
          onDelta: (chunk) => {
            if (controller.signal.aborted) return
            setEveTranscript((current) => (current === chunk ? current : current + chunk))
          },
          onAudio: (event) => {
            if (controller.signal.aborted) return
            sawAudio = true
            isEveSpeakingRef.current = true
            setIsEveSpeaking(true)
            audioQueueRef.push(event)
            if (audioQueueRef.length === 1) playNextChunk()
          },
          onDone: (doneEvent) => {
            if (controller.signal.aborted) return
            setEveTranscript(doneEvent?.message || '')
          },
        })
        if (controller.signal.aborted) return
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') return
        streamFailed = true
      }

      // Fallback to the blocking chat path when the fast path failed or
      // produced no playable audio (e.g. server has no TTS configured).
      if (!controller.signal.aborted && (streamFailed || (!sawAudio && !isEveSpeakingRef.current))) {
        try {
          const response = await sendEveMessage([{ role: 'user', content: clean }])
          const replyText = response?.message || "I heard you, but I couldn't process that request."
          speakEveResponse(replyText)
        } catch {
          if (controller.signal.aborted) return
          setEveTranscript('Sorry, I had trouble reaching the Eve assistant service.')
        }
      }
      if (!controller.signal.aborted) setIsEveThinking(false)
      if (abortTurnRef.current === controller) abortTurnRef.current = null
    },
    [speakEveResponse, stopPlayback],
  )

  // Barge-in: stop Eve mid-sentence - aborts the in-flight stream, drains the
  // queued audio, and cancels local SpeechSynthesis so the caller is heard.
  const interruptEve = useCallback(() => {
    if (abortTurnRef.current) {
      abortTurnRef.current.abort()
      abortTurnRef.current = null
    }
    stopPlayback()
    isEveSpeakingRef.current = false
    // Pre-age the echo timestamp so recognition resumes immediately.
    lastSpeechEndRef.current = Date.now() - ECHO_COOLDOWN_MS
    setIsEveSpeaking(false)
    setIsEveThinking(false)
  }, [stopPlayback])

  const transcribeServerAudio = useCallback(
    async (blob) => {
      const prefs = loadEveVoicePrefs()
      try {
        const data = await transcribeEveAudio(blob, prefs.language)
        const text = (data?.text || '').trim()
        if (text) await sendVoiceToEve(text)
      } catch {
        setEveTranscript('Sorry, I had trouble understanding that audio.')
      } finally {
        setSttStatus('idle')
      }
    },
    [sendVoiceToEve],
  )

  const startSttRecording = useCallback(() => {
    if (speechPrefsRef.current.sttProvider !== 'groq') return
    // Hold-to-talk doubles as barge-in: pressing while Eve speaks cuts her off.
    if (isEveSpeakingRef.current || isEveThinkingRef.current) interruptEve()
    if (mediaRecorderRef.current) return
    const stream = localStreamRef.current
    if (!stream || typeof window === 'undefined' || !window.MediaRecorder) {
      setSttStatus('error')
      return
    }
    const mimeType = pickAudioMimeType()
    if (!mimeType) {
      setSttStatus('error')
      return
    }
    try {
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        setSttStatus('error')
        return
      }
      const audioStream = new MediaStream(audioTracks)
      const recorder = new MediaRecorder(audioStream, { mimeType })
      mediaChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) mediaChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        setSttRecording(false)
        audioStream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(mediaChunksRef.current, { type: mimeType })
        mediaChunksRef.current = []
        if (blob.size > 0) {
          setSttStatus('listening')
          transcribeServerAudio(blob)
        } else {
          setSttStatus('idle')
        }
      }
      recorder.onerror = () => {
        setSttRecording(false)
        setSttStatus('error')
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      audioStreamRef.current = audioStream
      setSttRecording(true)
      setSttStatus('listening')
    } catch {
      setSttStatus('error')
    }
  }, [transcribeServerAudio, localStreamRef, interruptEve])

  const stopSttRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {}
    }
    mediaRecorderRef.current = null
  }, [])

  useEffect(() => {
    if (!isEveCall || phase !== 'active') return undefined
    let active = true
    loadEveSpeech()
      .then((data) => {
        if (active) setSpeechPrefs(resolveSpeechProviders(data))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isEveCall, phase])

  useEffect(() => {
    if (!isEveCall || phase !== 'active' || muted) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
        recognitionRef.current = null
      }
      setSttStatus(speechPrefs.sttProvider === 'groq' || sttSupported ? 'idle' : 'unsupported')
      return
    }

    const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
    if (speechPrefs.sttProvider === 'groq') {
      setSttStatus('idle')
      return
    }
    if (!SpeechRecognition) {
      setSttStatus('unsupported')
      return
    }

    let rec = recognitionRef.current
    if (!rec) {
      const prefs = loadEveVoicePrefs()
      rec = new SpeechRecognition()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = prefs.language

      rec.onresult = (event) => {
        if (isEveSpeakingRef.current || isEveThinkingRef.current || Date.now() - lastSpeechEndRef.current < ECHO_COOLDOWN_MS) {
          return
        }
        let finalResult = ''
        let interimResult = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalResult += event.results[i][0].transcript
          } else {
            interimResult += event.results[i][0].transcript
          }
        }
        if (interimResult) setUserTranscript(interimResult)
        if (finalResult) {
          setUserTranscript(finalResult)
          sendVoiceToEve(finalResult)
        }
      }

      rec.onstart = () => {
        permissionBlockedRef.current = false
        setSttStatus('listening')
      }

      rec.onerror = (event) => {
        const reason = event?.error
        if (reason === 'not-allowed' || reason === 'service-not-allowed') {
          permissionBlockedRef.current = true
          setSttStatus('permission')
        } else if (reason === 'aborted' || reason === 'no-speech') {
          // transient
        } else {
          setSttStatus('error')
        }
      }

      rec.onend = () => {
        if (phaseRef.current === 'active' && recognitionRef.current && !permissionBlockedRef.current) {
          try {
            rec.start()
          } catch {}
        }
      }

      recognitionRef.current = rec
      try {
        rec.start()
      } catch {}
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
        recognitionRef.current = null
      }
    }
  }, [isEveCall, muted, phase, sendVoiceToEve, sttSupported, speechPrefs.sttProvider, phaseRef])

  const toggleTts = useCallback(() => {
    setTtsEnabled((current) => {
      const next = !current
      if (!next) {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel()
        }
        if (eveAudioRef.current) {
          try {
            eveAudioRef.current.pause()
          } catch {}
          eveAudioRef.current = null
        }
        isEveSpeakingRef.current = false
        lastSpeechEndRef.current = Date.now()
        setIsEveSpeaking(false)
      }
      return next
    })
  }, [])

  const stopEveVoice = useCallback(() => {
    if (abortTurnRef.current) {
      abortTurnRef.current.abort()
      abortTurnRef.current = null
    }
    playQueueRef.current.length = 0
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop()
      } catch {}
      mediaRecorderRef.current = null
    }
    audioStreamRef.current?.getTracks().forEach((track) => track.stop())
    audioStreamRef.current = null
    if (eveAudioRef.current) {
      try {
        eveAudioRef.current.pause()
      } catch {}
      eveAudioRef.current = null
    }
    permissionBlockedRef.current = false
    isEveSpeakingRef.current = false
    lastSpeechEndRef.current = Date.now()
    setIsEveSpeaking(false)
    setIsEveThinking(false)
    setSttRecording(false)
    setSttStatus(speechPrefsRef.current.sttProvider === 'groq' || sttSupported ? 'idle' : 'unsupported')
    setUserTranscript('')
    setEveTranscript('Hello! I’m Eve. How can I help you today?')
  }, [sttSupported])

  return {
    userTranscript,
    eveTranscript,
    isEveSpeaking,
    isEveThinking,
    ttsEnabled,
    sttRecording,
    sttStatus,
    sttSupported,
    speechPrefs,
    speechPrefsRef,
    isEveSpeakingRef,
    lastSpeechEndRef,
    eveAudioRef,
    mediaRecorderRef,
    audioStreamRef,
    recognitionRef,
    permissionBlockedRef,
    ttsEnabledRef,
    isEveThinkingRef,
    setUserTranscript,
    setEveTranscript,
    setIsEveSpeaking,
    setIsEveThinking,
    setTtsEnabled,
    setSttRecording,
    setSttStatus,
    setSpeechPrefs,
    sendVoiceToEve,
    interruptEve,
    startSttRecording,
    stopSttRecording,
    toggleTts,
    stopEveVoice,
    speakEveResponse,
  }
}
