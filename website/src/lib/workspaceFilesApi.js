import { apiRequest } from './request'

const ERROR_MESSAGE = 'Workspace file operation failed.'
const TOKEN_MESSAGE = 'Sign in to access workspace files.'

function request(path = '', options = {}) {
  return apiRequest(`/workspace-files${path}`, {
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export async function listWorkspaces() {
  const data = await request('/workspaces')
  return data?.workspaces ?? []
}

export async function createWorkspace(name) {
  return request('/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function renameWorkspace(workspaceId, name) {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export async function deleteWorkspace(workspaceId) {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: 'DELETE',
  })
}

export async function loadFileTree(workspaceId = 'default') {
  const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
  const data = await request(`/tree${query}`)
  return data?.files ?? []
}

export async function readFile(filePath, workspaceId = 'default') {
  const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
  return request(`/${filePath}${query}`)
}

export async function writeFile(filePath, content, encoding = 'utf-8', workspaceId = 'default') {
  const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
  return request(`/${filePath}${query}`, {
    method: 'PUT',
    body: JSON.stringify({ content, encoding }),
  })
}

export async function deleteFile(filePath, workspaceId = 'default') {
  const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
  return request(`/${filePath}${query}`, { method: 'DELETE' })
}

export async function syncFiles(files, workspaceId = 'default') {
  const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
  return request(`/sync${query}`, {
    method: 'POST',
    body: JSON.stringify({ files }),
  })
}

