import { usePersistentState } from './usePersistentState'

const LOCAL_NOTIFICATIONS_KEY = 'starwaves.local_notifications'

function createNotificationId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useLocalNotifications() {
  const [notifications, setNotifications] = usePersistentState(LOCAL_NOTIFICATIONS_KEY, [])

  const addNotification = (title, body) => {
    if (!title.trim() || !body.trim()) return null
    const notification = {
      id: createNotificationId(),
      title: title.trim(),
      body: body.trim(),
      created_at: new Date().toISOString(),
      unread: true,
    }
    setNotifications((current) => [notification, ...current])
    return notification
  }

  const markRead = (id) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, unread: false } : notification,
      ),
    )
  }

  const deleteNotification = (id) => {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== id),
    )
  }

  const clearAll = () => {
    setNotifications([])
  }

  return {
    notifications,
    addNotification,
    markRead,
    deleteNotification,
    clearAll,
  }
}
