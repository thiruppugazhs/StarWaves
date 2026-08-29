/** Call helpers — single responsibility: media and speech provider resolution. */

export function pickAudioMimeType() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  return candidates.find((type) => window.MediaRecorder.isTypeSupported(type)) || ''
}

export function resolveSpeechProviders(data) {
  const preference = data?.preference || {}
  const stt = (data?.stt_providers || []).find((provider) => provider.id === preference.stt_provider)
  const tts = (data?.tts_providers || []).find((provider) => provider.id === preference.tts_provider)
  return {
    sttProvider: stt?.available ? preference.stt_provider : 'browser',
    sttModel: stt?.available ? preference.stt_model || '' : '',
    ttsProvider: tts?.available ? preference.tts_provider : 'browser',
    ttsVoice: tts?.available ? preference.tts_voice || '' : '',
  }
}
