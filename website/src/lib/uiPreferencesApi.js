import { apiRequest, invalidateCacheForPath } from './request'

export function getUiPreferences() {
  return apiRequest('/ui/preferences', { method: 'GET' })
}

export function getUiHistory() {
  return apiRequest('/ui/preferences/history', { method: 'GET' })
}

export function updateUiTokens(tokens, page = null, reason = null) {
  return apiRequest('/ui/preferences/tokens', {
    method: 'PUT',
    body: JSON.stringify({ tokens, page, reason }),
  }).then((res) => {
    invalidateCacheForPath('/ui/preferences')
    return res
  })
}

export function updateUiCss(css, page = null) {
  return apiRequest('/ui/preferences/css', {
    method: 'PUT',
    body: JSON.stringify({ css, page }),
  }).then((res) => {
    invalidateCacheForPath('/ui/preferences')
    return res
  })
}

export function updateUiVisibility(target, visible, page = null) {
  return apiRequest('/ui/preferences/visibility', {
    method: 'PUT',
    body: JSON.stringify({ target, visible, page }),
  }).then((res) => {
    invalidateCacheForPath('/ui/preferences')
    return res
  })
}

export function resetUiPreferences(page = null, version = null) {
  return apiRequest('/ui/preferences/reset', {
    method: 'POST',
    body: JSON.stringify({ page, version }),
  }).then((res) => {
    invalidateCacheForPath('/ui/preferences')
    return res
  })
}

export function restoreUiVersion(version) {
  return apiRequest('/ui/preferences/restore', {
    method: 'POST',
    body: JSON.stringify({ version }),
  }).then((res) => {
    invalidateCacheForPath('/ui/preferences')
    return res
  })
}

export function clearUiPreferences() {
  return apiRequest('/ui/preferences', { method: 'DELETE' }).then((res) => {
    invalidateCacheForPath('/ui/preferences')
    return res
  })
}
