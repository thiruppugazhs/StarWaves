import { apiRequest } from './request'
import { openOAuthPopup } from '../utils/popupOAuth'

const BASE_PATH = '/integrations/google-drive'
const ERROR_MESSAGE = 'Google Drive is unavailable.'
const TOKEN_MESSAGE = 'Sign in to connect Google Drive.'

function request(path, options = {}) {
  return apiRequest(path, {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export function getGoogleDriveStatus() {
  return request('/status')
}

export async function beginGoogleDriveOAuth() {
  const { url } = await request('/authorize')
  return openOAuthPopup(url, 'google-drive-oauth')
}

export function loadGoogleDriveFiles() {
  return request('/files')
}

export function loadGoogleWorkspaceEditor(documentId) {
  return request(`/editor-url/${encodeURIComponent(documentId)}`)
}

export function uploadGoogleDriveFile(file) {
  return request('/upload', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-File-Type': file.type || 'application/octet-stream',
    },
    body: file,
  })
}

export function disconnectGoogleDrive() {
  return request('', { method: 'DELETE' })
}
