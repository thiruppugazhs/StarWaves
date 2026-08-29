import { useEffect, useState } from 'react'
import {
  getSpeechVoices,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
} from '../utils/speech'

// Loads the browser's SpeechSynthesis voice list, including updates after the
// async `voiceschanged` event (Chrome populates voices lazily), and reports
// which Web Speech capabilities this browser exposes.
export function useSpeechVoices() {
  const [voices, setVoices] = useState(() => getSpeechVoices())
  const [voicesLoaded, setVoicesLoaded] = useState(() => voices.length > 0)

  useEffect(() => {
    if (!isSpeechSynthesisSupported()) {
      setVoicesLoaded(true)
      return undefined
    }
    const update = () => {
      setVoices(getSpeechVoices())
      setVoicesLoaded(true)
    }
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  return {
    voices,
    voicesLoaded,
    sttSupported: isSpeechRecognitionSupported(),
    ttsSupported: isSpeechSynthesisSupported(),
  }
}