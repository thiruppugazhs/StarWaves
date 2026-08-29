import { request } from './_shared'

export function loadNotifications(cursor = null) {
  return request(`/notifications?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
}

export function updateNotification(notificationId, unread) {
  return request(`/notifications/${encodeURIComponent(notificationId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ unread }),
  })
}

export function deleteNotification(notificationId) {
  return request(`/notifications/${encodeURIComponent(notificationId)}`, {
    method: 'DELETE',
  })
}

export function markAllNotificationsRead() {
  return request('/notifications/mark-all-read', { method: 'POST' })
}

export function registerDeviceToken(token, deviceName = null) {
  return request('/notifications/device-token', {
    method: 'POST',
    body: JSON.stringify({ token, device_name: deviceName }),
  })
}

export function unregisterDeviceToken(tokenId) {
  return request(`/notifications/device-token/${encodeURIComponent(tokenId)}`, {
    method: 'DELETE',
  })
}

export function getRegisteredDevices() {
  return request('/notifications/devices')
}

export function sendPushNotification(title, body, data = null, targetDeviceToken = null) {
  return request('/notifications/send', {
    method: 'POST',
    body: JSON.stringify({
      title,
      body,
      data,
      target_device_token: targetDeviceToken,
    }),
  })
}