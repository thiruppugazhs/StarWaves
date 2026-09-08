import { apiRequest, API_URL } from './request'
import { getDeviceId, getDeviceName, getStoredAuthToken } from './authStorage'

const PREFIX = '/modeling/projects'

function query(workspaceId) {
  return workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
}

export function listModelingProjects() {
  return apiRequest(PREFIX, { useCache: false })
}

export function createModelingProject(name, workspaceId = 'default') {
  return apiRequest(PREFIX, {
    method: 'POST',
    body: JSON.stringify({ name, workspace_id: workspaceId }),
  })
}

export function getModelingProject(projectId, workspaceId = 'default') {
  return apiRequest(`${PREFIX}/${encodeURIComponent(projectId)}${query(workspaceId)}`, { useCache: false })
}

export function renameModelingProject(projectId, name, workspaceId = 'default') {
  return apiRequest(`${PREFIX}/${encodeURIComponent(projectId)}${query(workspaceId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export function saveModelingVersion(projectId, scene, message = 'Manual save', workspaceId = 'default') {
  return apiRequest(`${PREFIX}/${encodeURIComponent(projectId)}/versions${query(workspaceId)}`, {
    method: 'POST',
    body: JSON.stringify({ scene, message }),
  })
}

export function uploadModelingAsset(projectId, file, options = {}) {
  const form = new FormData()
  form.append('file', file, file.name)
  if (options.relativePath) form.append('relative_path', options.relativePath)
  if (options.assetSetId) form.append('asset_set_id', options.assetSetId)
  form.append('workspace_id', options.workspaceId || 'default')
  return authenticatedBinaryRequest(`${PREFIX}/${encodeURIComponent(projectId)}/assets`, {
    method: 'POST',
    body: form,
  }).then((response) => response.json())
}

export function listModelingAssets(projectId, workspaceId = 'default') {
  return apiRequest(`${PREFIX}/${encodeURIComponent(projectId)}/assets${query(workspaceId)}`, { useCache: false })
}

export function getModelingAssetUrl(projectId, assetId, workspaceId = 'default') {
  return `${API_URL}${PREFIX}/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}${query(workspaceId)}`
}

export async function loadModelingAssetBlob(projectId, assetId, workspaceId = 'default') {
  // Binary responses cannot use apiRequest's JSON parser, so this is the
  // same authenticated request contract with an explicit blob response.
  const response = await authenticatedBinaryRequest(getModelingAssetUrl(projectId, assetId, workspaceId), { method: 'GET' })
  return response.blob()
}

async function authenticatedBinaryRequest(url, options) {
  const token = getStoredAuthToken()
  const headers = { ...options.headers }
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    headers['X-Device-Id'] = getDeviceId()
    headers['X-Device-Name'] = getDeviceName()
  } catch {
    // Storage can be unavailable in private browsing; auth remains sufficient.
  }
  const response = await fetch(url.startsWith('http') ? url : `${API_URL}${url}`, {
    ...options,
    headers,
    credentials: 'omit',
  })
  if (!response.ok) {
    let detail = 'Modeling asset request failed.'
    try { detail = (await response.json())?.detail || detail } catch { /* non-JSON error */ }
    throw Object.assign(new Error(detail), { status: response.status })
  }
  return response
}
