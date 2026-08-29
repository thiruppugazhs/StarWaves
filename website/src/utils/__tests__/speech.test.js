import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_EVE_VOICE_PREFS,
  EVE_VOICE_PREFS_KEY,
  getSpeechVoices,
  isSpeechRecognitionSupported,
  loadEveVoicePrefs,
  normalizeEveVoicePrefs,
  saveEveVoicePrefs,
  selectVoice,
  voicesForLanguage,
} from '../speech'

function createFakeVoice(voiceURI, lang, { isDefault = false } = {}) {
  return { voiceURI, lang, default: isDefault, name: voiceURI, localService: true }
}

function stubWindow({ voices = [], withSpeechRecognition = false } = {}) {
  const storage = new Map()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    speechSynthesis: { getVoices: () => voices },
    ...(withSpeechRecognition ? { SpeechRecognition: class SpeechRecognition {} } : {}),
  })
  return storage
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('normalizeEveVoicePrefs', () => {
  it('returns defaults for null, undefined, or non-object input', () => {
    expect(normalizeEveVoicePrefs(null)).toEqual(DEFAULT_EVE_VOICE_PREFS)
    expect(normalizeEveVoicePrefs(undefined)).toEqual(DEFAULT_EVE_VOICE_PREFS)
    expect(normalizeEveVoicePrefs('nope')).toEqual(DEFAULT_EVE_VOICE_PREFS)
  })

  it('keeps valid fields and drops invalid ones', () => {
    expect(
      normalizeEveVoicePrefs({
        language: 'en-GB',
        voiceURI: 'some-voice',
        rate: 1.25,
        pitch: 0,
      }),
    ).toEqual({ language: 'en-GB', voiceURI: 'some-voice', rate: 1.25, pitch: 0 })
    expect(
      normalizeEveVoicePrefs({ language: '', voiceURI: 42, rate: -2, pitch: 'high' }),
    ).toEqual({ ...DEFAULT_EVE_VOICE_PREFS, voiceURI: '' })
  })
})

describe('loadEveVoicePrefs / saveEveVoicePrefs', () => {
  it('returns defaults when nothing is stored', () => {
    stubWindow()
    expect(loadEveVoicePrefs()).toEqual(DEFAULT_EVE_VOICE_PREFS)
  })

  it('round-trips saved preferences', () => {
    const storage = stubWindow()
    const prefs = { language: 'en-IN', voiceURI: 'voice-2', rate: 1.5, pitch: 0.75 }
    saveEveVoicePrefs(prefs)
    expect(storage.get(EVE_VOICE_PREFS_KEY)).toBe(JSON.stringify(prefs))
    expect(loadEveVoicePrefs()).toEqual(prefs)
  })

  it('falls back to defaults on corrupt stored JSON', () => {
    const storage = stubWindow()
    storage.set(EVE_VOICE_PREFS_KEY, '{not json')
    expect(loadEveVoicePrefs()).toEqual(DEFAULT_EVE_VOICE_PREFS)
  })

  it('is a no-op without a window', () => {
    expect(() => saveEveVoicePrefs({ language: 'en-GB' })).not.toThrow()
    expect(loadEveVoicePrefs()).toEqual(DEFAULT_EVE_VOICE_PREFS)
  })
})

describe('isSpeechRecognitionSupported', () => {
  it('returns false without a window', () => {
    expect(isSpeechRecognitionSupported()).toBe(false)
  })

  it('detects SpeechRecognition and its webkit fallback', () => {
    stubWindow({ withSpeechRecognition: true })
    expect(isSpeechRecognitionSupported()).toBe(true)
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {},
      },
      webkitSpeechRecognition: class {},
    })
    expect(isSpeechRecognitionSupported()).toBe(true)
  })

  it('returns false when neither constructor exists', () => {
    stubWindow()
    expect(isSpeechRecognitionSupported()).toBe(false)
  })
})

describe('getSpeechVoices', () => {
  it('returns an empty array without speechSynthesis', () => {
    stubWindow()
    expect(getSpeechVoices()).toEqual([])
  })

  it('returns the voice list from speechSynthesis', () => {
    stubWindow({ voices: [createFakeVoice('a', 'en-US')] })
    expect(getSpeechVoices()).toHaveLength(1)
  })
})

describe('voicesForLanguage', () => {
  const voices = [
    createFakeVoice('us', 'en-US'),
    createFakeVoice('gb', 'en-GB'),
    createFakeVoice('fr', 'fr-FR'),
  ]

  it('filters by language prefix', () => {
    expect(voicesForLanguage(voices, 'en-US')).toEqual([voices[0]])
    expect(voicesForLanguage(voices, 'en')).toEqual([voices[0], voices[1]])
    expect(voicesForLanguage(voices, 'fr')).toEqual([voices[2]])
  })

  it('returns [] for empty input or unknown languages', () => {
    expect(voicesForLanguage([], 'en-US')).toEqual([])
    expect(voicesForLanguage(voices, '')).toEqual([])
    expect(voicesForLanguage(voices, 'xx-YY')).toEqual([])
  })
})

describe('selectVoice', () => {
  const voices = [
    createFakeVoice('us-other', 'en-US'),
    createFakeVoice('us-default', 'en-US', { isDefault: true }),
    createFakeVoice('gb', 'en-GB'),
  ]
  const prefs = { ...DEFAULT_EVE_VOICE_PREFS }

  it('prefers the saved voiceURI', () => {
    expect(selectVoice({ ...prefs, voiceURI: 'us-other' }, voices)).toEqual(voices[0])
  })

  it('falls back to the default voice for the language', () => {
    expect(selectVoice(prefs, voices)).toEqual(voices[1])
  })

  it('prefers a language match over a default voice in another language', () => {
    expect(selectVoice({ ...prefs, language: 'en-GB' }, voices)).toEqual(voices[2])
  })

  it('returns null when no voice matches the language', () => {
    expect(selectVoice({ ...prefs, language: 'de-DE' }, voices)).toBeNull()
  })

  it('returns null when there are no voices', () => {
    expect(selectVoice(prefs, [])).toBeNull()
  })
})
