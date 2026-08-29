import { API_URL } from './request'
import { getStoredAuthToken } from './authApi'

/**
 * Stream TTS audio from POST /eve/synthesize/stream and play progressively.
 * Uses MediaSource + SourceBuffer for true streaming (TTFA ~100ms).
 * Falls back to buffered blob on browsers without MediaSource or on error.
 *
 * Returns { audio, stop } where audio is the HTMLAudioElement and stop() aborts.
 */
export async function streamEveSpeech({ text, language, voice, rate, pitch, preferStream = true }) {
  const token = getStoredAuthToken()
  if (!token) throw new Error('Sign in to stream Eve speech.')

  const response = await fetch(`${API_URL}/eve/synthesize/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, language, voice, rate, pitch }),
  })

  if (!response.ok) {
    const failure = await response.json().catch(() => null)
    throw new Error(failure?.detail || 'Could not stream Eve speech.')
  }

  // Feature-detect MediaSource for progressive MP3 playback
  const canStream =
    preferStream &&
    typeof window !== 'undefined' &&
    'MediaSource' in window &&
    window.MediaSource.isTypeSupported('audio/mpeg') &&
    response.body &&
    typeof response.body.getReader === 'function'

  if (!canStream) {
    // Fallback: wait for full blob
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    const cleanup = () => URL.revokeObjectURL(url)
    audio.addEventListener('ended', cleanup, { once: true })
    audio.addEventListener('error', cleanup, { once: true })
    await audio.play().catch(() => {
      cleanup()
      throw new Error('Could not play Eve speech.')
    })
    return {
      audio,
      stop: () => {
        try {
          audio.pause()
        } catch {}
        cleanup()
      },
    }
  }

  // True streaming via MediaSource
  return new Promise((resolve, reject) => {
    const mediaSource = new MediaSource()
    const audioUrl = URL.createObjectURL(mediaSource)
    const audio = new Audio(audioUrl)
    let sourceBuffer = null
    let reader = null
    let aborted = false

    const cleanup = () => {
      try {
        URL.revokeObjectURL(audioUrl)
      } catch {}
    }

    const stop = () => {
      aborted = true
      try {
        reader?.cancel()
      } catch {}
      try {
        audio.pause()
      } catch {}
      try {
        if (mediaSource.readyState === 'open') mediaSource.endOfStream()
      } catch {}
      cleanup()
    }

    audio.addEventListener('error', () => {
      cleanup()
      reject(new Error('Could not play Eve speech.'))
    })

    mediaSource.addEventListener('sourceopen', async () => {
      try {
        sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg')
      } catch {
        // Fallback if addSourceBuffer fails
        stop()
        try {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const fallback = new Audio(url)
          fallback.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true })
          await fallback.play()
          resolve({ audio: fallback, stop: () => fallback.pause() })
        } catch (e) {
          reject(e)
        }
        return
      }

      // Queue for SourceBuffer appends — must wait for updateend
      const queue = []
      let appending = false

      const processQueue = () => {
        if (aborted || appending || queue.length === 0 || sourceBuffer.updating) return
        appending = true
        const chunk = queue.shift()
        try {
          sourceBuffer.appendBuffer(chunk)
        } catch {
          appending = false
          return
        }
      }

      sourceBuffer.addEventListener('updateend', () => {
        appending = false
        processQueue()
        if (queue.length === 0 && aborted) {
          try {
            if (mediaSource.readyState === 'open') mediaSource.endOfStream()
          } catch {}
        }
      })

      reader = response.body.getReader()

      const pump = async () => {
        try {
          const { done, value } = await reader.read()
          if (done) {
            // Wait for queue drain then end stream
            const waitDrain = () => {
              if (queue.length === 0 && !appending && !sourceBuffer.updating) {
                try {
                  if (mediaSource.readyState === 'open') mediaSource.endOfStream()
                } catch {}
                return
              }
              setTimeout(waitDrain, 50)
            }
            waitDrain()
            return
          }
          if (value && value.byteLength > 0) {
            queue.push(value)
            processQueue()
          }
          pump()
        } catch (e) {
          if (!aborted) {
            try {
              if (mediaSource.readyState === 'open') mediaSource.endOfStream()
            } catch {}
            reject(e)
          }
        }
      }

      // Start playback as soon as we have data — don't wait for endOfStream
      audio.play().catch(() => {})
      resolve({ audio, stop })
      pump()
    })

    // Safety: if sourceopen never fires
    setTimeout(() => {
      if (mediaSource.readyState !== 'open' && !aborted) {
        stop()
        reject(new Error('Could not stream Eve speech.'))
      }
    }, 5000)

    audio.addEventListener('ended', cleanup, { once: true })
  })
}

/** One-shot helper for Settings preview — streams and auto-cleans. */
export function previewStreamEveSpeech(params) {
  return streamEveSpeech(params)
}
