import { apiRequest, API_URL, fetchWithTimeout } from './request'
import { getStoredAuthToken } from './authApi'

const BASE_PATH = '/settings/eve-speech'
const ERROR_MESSAGE = 'Could not update Eve speech settings.'
const TOKEN_MESSAGE = 'Sign in to update Eve speech settings.'
const PREVIEW_ERROR = 'Could not preview Eve speech.'

function request(options = {}) {
  return apiRequest('', {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export function loadEveSpeech() {
  return request()
}

export function saveEveSpeechPreference(preference) {
  return request({ method: 'PUT', body: JSON.stringify(preference) })
}

export function transcribeEveAudio(blob, language) {
  const token = getStoredAuthToken()
  if (!token) throw new Error(TOKEN_MESSAGE)
  const formData = new FormData()
  formData.append('file', blob, 'eve-audio.webm')
  const shortLanguage = String(language || '').split('-')[0]
  if (shortLanguage) formData.append('language', shortLanguage)
  return fetchWithTimeout(`${API_URL}/eve/transcribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  }).then(async (response) => {
    if (!response.ok) {
      const failure = await response.json().catch(() => null)
      throw new Error(failure?.detail || 'Could not transcribe Eve audio.')
    }
    return response.json()
  })
}

export function synthesizeEveSpeech({ text, language, voice, rate, pitch }) {
  const token = getStoredAuthToken()
  if (!token) throw new Error(TOKEN_MESSAGE)
  return fetchWithTimeout(`${API_URL}/eve/synthesize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, language, voice, rate, pitch }),
  }).then(async (response) => {
    if (!response.ok) {
      const failure = await response.json().catch(() => null)
      throw new Error(failure?.detail || PREVIEW_ERROR)
    }
    return response.blob()
  })
}

export function synthesizeEveSpeechStream({ text, language, voice, rate, pitch }) {
  const token = getStoredAuthToken()
  if (!token) throw new Error(TOKEN_MESSAGE)
  // Chunked transfer — caller should consume response.body as stream.
  return fetchWithTimeout(`${API_URL}/eve/synthesize/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, language, voice, rate, pitch }),
  }).then(async (response) => {
    if (!response.ok) {
      const failure = await response.json().catch(() => null)
      throw new Error(failure?.detail || PREVIEW_ERROR)
    }
    return response
  })
}
