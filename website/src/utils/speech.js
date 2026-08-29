// Eve voice preferences and Web Speech API helpers.
// Prefs are stored in localStorage so the call center, CallScreen, and the
// Settings "Eve voice" section share the same configuration.

export const EVE_VOICE_PREFS_KEY = 'starwaves.eve_voice_prefs'

export const DEFAULT_EVE_VOICE_PREFS = {
  language: 'en-US',
  voiceURI: '',
  rate: 1,
  pitch: 1,
}

// Common English voices offered in the Settings picker. Custom values entered
// elsewhere are preserved; this list is only used to populate the <select>.
export const EVE_VOICE_LANGUAGES = [
  'en-US',
  'en-GB',
  'en-AU',
  'en-CA',
  'en-IN',
  'en-NZ',
  'en-ZA',
]

export const EVE_VOICE_RATE_OPTIONS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]
export const EVE_VOICE_PITCH_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export function normalizeEveVoicePrefs(prefs) {
  const base = { ...DEFAULT_EVE_VOICE_PREFS }
  if (!prefs || typeof prefs !== 'object') return base
  if (typeof prefs.language === 'string' && prefs.language) base.language = prefs.language
  if (typeof prefs.voiceURI === 'string') base.voiceURI = prefs.voiceURI
  if (typeof prefs.rate === 'number' && Number.isFinite(prefs.rate) && prefs.rate > 0) {
    base.rate = prefs.rate
  }
  if (typeof prefs.pitch === 'number' && Number.isFinite(prefs.pitch) && prefs.pitch >= 0) {
    base.pitch = prefs.pitch
  }
  return base
}

export function loadEveVoicePrefs() {
  if (typeof window === 'undefined') return { ...DEFAULT_EVE_VOICE_PREFS }
  try {
    const raw = window.localStorage.getItem(EVE_VOICE_PREFS_KEY)
    if (!raw) return { ...DEFAULT_EVE_VOICE_PREFS }
    return normalizeEveVoicePrefs(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_EVE_VOICE_PREFS }
  }
}

export function saveEveVoicePrefs(prefs) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      EVE_VOICE_PREFS_KEY,
      JSON.stringify(normalizeEveVoicePrefs(prefs)),
    )
  } catch {
    // localStorage can be unavailable (private mode / quota); prefs are best-effort.
  }
}

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function isSpeechSynthesisSupported() {
  if (typeof window === 'undefined') return false
  return 'speechSynthesis' in window
}

export function getSpeechVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices() || []
}

export function voicesForLanguage(voices, language) {
  if (!Array.isArray(voices) || voices.length === 0) return []
  const prefix = String(language || '').toLowerCase()
  if (!prefix) return []
  return voices.filter((voice) => String(voice.lang || '').toLowerCase().startsWith(prefix))
}

export function selectVoice(prefs, voices) {
  const matching = voicesForLanguage(voices, prefs.language)
  if (matching.length === 0) return null
  if (prefs.voiceURI) {
    const chosen = matching.find((voice) => voice.voiceURI === prefs.voiceURI)
    if (chosen) return chosen
  }
  return matching.find((voice) => voice.default) || matching[0] || null
}