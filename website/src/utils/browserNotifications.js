export function canNotify() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    window.Notification.permission === 'granted'
  )
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return window.Notification.permission
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Browser notifications are not supported in this browser.')
  }
  if (window.Notification.permission === 'granted') {
    return 'granted'
  }
  try {
    const permission = await window.Notification.requestPermission()
    return permission
  } catch {
    return new Promise((resolve) => {
      try {
        window.Notification.requestPermission((permission) => {
          resolve(permission)
        })
      } catch {
        resolve('denied')
      }
    })
  }
}

let autoPromptAttached = false

export function autoPromptNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (window.Notification.permission !== 'default') return
  if (autoPromptAttached) return

  autoPromptAttached = true

  const handleUserInteraction = () => {
    window.removeEventListener('click', handleUserInteraction)
    window.removeEventListener('keydown', handleUserInteraction)
    window.removeEventListener('touchstart', handleUserInteraction)

    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'default') {
      requestNotificationPermission().catch(() => {})
    }
  }

  window.addEventListener('click', handleUserInteraction, { once: true })
  window.addEventListener('keydown', handleUserInteraction, { once: true })
  window.addEventListener('touchstart', handleUserInteraction, { once: true })
}

export function notify(title, body, tag = null, options = {}) {
  if (!canNotify()) return false
  try {
    const notificationOptions = {
      body,
      tag,
      requireInteraction: true,
      renotify: true,
      ...options,
    }
    const n = new window.Notification(title, notificationOptions)
    n.onclick = () => {
      if (typeof window !== 'undefined') {
        window.focus()
      }
      n.close()
    }
    return true
  } catch {
    return false
  }
}
