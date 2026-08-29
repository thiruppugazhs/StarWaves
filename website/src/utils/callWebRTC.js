// WebRTC helpers for the Calls feature: public STUN configuration and a
// monochrome-agnostic ring tone generated with the Web Audio API.

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

let ringContext = null
let ringOscillator = null
let ringGain = null
let ringStopRequested = false
let ringTimer = null

const RING_FREQUENCY = 880
const RING_TONE_SECONDS = 1.1
const RING_PAUSE_SECONDS = 0.8

function playRingTone() {
  if (ringStopRequested || !ringContext) return
  ringOscillator = ringContext.createOscillator()
  ringGain = ringContext.createGain()
  ringOscillator.type = 'sine'
  ringOscillator.frequency.value = RING_FREQUENCY
  ringGain.gain.setValueAtTime(0.07, ringContext.currentTime)
  ringGain.gain.exponentialRampToValueAtTime(0.0001, ringContext.currentTime + RING_TONE_SECONDS)
  ringOscillator.connect(ringGain)
  ringGain.connect(ringContext.destination)
  ringOscillator.start()
  ringOscillator.stop(ringContext.currentTime + RING_TONE_SECONDS)
}

export function startRingtone() {
  try {
    stopRingtone()
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    ringContext = new AudioContext()
    ringStopRequested = false
    playRingTone()
    ringTimer = window.setInterval(playRingTone, (RING_TONE_SECONDS + RING_PAUSE_SECONDS) * 1000)
  } catch {
    // Ring tone is decorative; a missing or blocked AudioContext is not fatal.
  }
}

export function stopRingtone() {
  ringStopRequested = true
  if (ringTimer) {
    window.clearInterval(ringTimer)
    ringTimer = null
  }
  try {
    ringOscillator?.stop()
    ringContext?.close()
  } catch {
    // ignore
  }
  ringOscillator = null
  ringContext = null
  ringGain = null
}