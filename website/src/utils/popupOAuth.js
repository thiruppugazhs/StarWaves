/**
 * Opens an OAuth authorization URL in a centered popup window and waits for
 * completion or popup closure.
 *
 * @param {string} url - The OAuth authorization URL to open in the popup window.
 * @param {string} title - Title/name for the popup window.
 * @returns {Promise<void>} Resolves when the popup closes or signals success.
 */
export function openOAuthPopup(url, title = 'google-oauth-popup') {
  return new Promise((resolve, reject) => {
    const width = 500
    const height = 650
    const left = window.screenX + (window.innerWidth - width) / 2
    const top = window.screenY + (window.innerHeight - height) / 2

    const popup = window.open(
      url,
      title,
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`,
    )

    if (!popup) {
      reject(new Error('Popup window was blocked by browser. Please allow popups for this site.'))
      return
    }

    let isDone = false
    let broadcastChannel = null

    const cleanup = () => {
      isDone = true
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', handleFocus)
      if (broadcastChannel) {
        try {
          broadcastChannel.close()
        } catch {
          // Ignore
        }
      }
    }

    const processOAuthData = (data) => {
      if (isDone) return
      cleanup()
      if (data?.status === 'error') {
        reject(new Error(data.error || 'OAuth authorization failed.'))
      } else {
        resolve(data)
      }
    }

    const allowedOrigins = (() => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || ''
        if (apiUrl.startsWith('http')) return [new URL(apiUrl).origin]
      } catch {}
      return []
    })()
    const handleMessage = (event) => {
      if (allowedOrigins.length && !allowedOrigins.includes(event.origin) && event.origin !== window.location.origin) return
      if (
        event.data &&
        typeof event.data === 'object' &&
        event.data.type === 'STARWAVES_OAUTH_CALLBACK'
      ) {
        processOAuthData(event.data)
      }
    }

    const handleStorage = (event) => {
      if (event.key === 'starwaves_oauth_event' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue)
          if (parsed?.payload?.type === 'STARWAVES_OAUTH_CALLBACK') {
            processOAuthData(parsed.payload)
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        broadcastChannel = new BroadcastChannel('starwaves_oauth')
        broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'STARWAVES_OAUTH_CALLBACK') {
            processOAuthData(event.data)
          }
        }
      } catch {
        broadcastChannel = null
      }
    }

    const handleFocus = () => {
      if (isDone) return
      // When the main window regains focus, check after a short delay if popup was closed
      setTimeout(() => {
        if (isDone) return
        try {
          if (popup && popup.closed) {
            cleanup()
            resolve()
          }
        } catch {
          // Cross-Origin-Opener-Policy (COOP) can restrict access to popup.closed; ignore silently
        }
      }, 500)
    }

    window.addEventListener('message', handleMessage)
    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', handleFocus)
  })
}
