import { apiRequest, invalidateCacheForPath } from './request'

export function getAvatarPreferences() {
  return apiRequest('/eve/avatar/preferences', { method: 'GET' })
}

export function saveAvatarPreferences(prefs) {
  return apiRequest('/eve/avatar/preferences', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  }).then((res) => {
    invalidateCacheForPath('/eve/avatar/preferences')
    invalidateCacheForPath('/ui/preferences')
    return res
  })
}

export function listAvatarModels(cursor = null, limit = 20) {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiRequest(`/eve/avatar/models${qs}`, { method: 'GET', useCache: true })
}

export function uploadAvatarModel(file, onProgress) {
  // file is File from <input>; we send as base64 JSON to reuse apiRequest (no multipart handler yet)
  // For multipart, fall back to raw fetch with Bearer
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file for upload.'))
    reader.onload = async () => {
      try {
        const base64 = String(reader.result || '').split(',')[1] || ''
        const res = await apiRequest('/eve/avatar/upload', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, content_base64: base64 }),
          timeoutMs: 60000,
        })
        invalidateCacheForPath('/eve/avatar/models')
        if (onProgress) onProgress(100)
        resolve(res)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsDataURL(file)
  })
}

export function deleteAvatarModel(modelId) {
  return apiRequest(`/eve/avatar/models/${encodeURIComponent(modelId)}`, { method: 'DELETE' }).then((res) => {
    invalidateCacheForPath('/eve/avatar/models')
    return res
  })
}
