import { apiRequest } from './request'

const ERROR_MESSAGE = 'Studio request failed.'
const TOKEN_MESSAGE = 'Sign in to use Studio.'

function request(path = '', options = {}) {
  return apiRequest(`/studio${path}`, {
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export async function listStudioProjects() {
  const data = await request('/projects')
  return data?.projects ?? []
}

export async function createStudioProject(payload) {
  return request('/projects', { method: 'POST', body: JSON.stringify(payload) })
}

export async function getStudioProject(projectId) {
  return request(`/projects/${encodeURIComponent(projectId)}`)
}

export async function updateStudioProject(projectId, updates) {
  return request(`/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function deleteStudioProject(projectId) {
  return request(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' })
}

export async function saveBuildPlan(projectId, plan) {
  return request(`/projects/${encodeURIComponent(projectId)}/plan`, {
    method: 'PUT',
    body: JSON.stringify(plan),
  })
}

export async function setPlanStatus(projectId, status) {
  return request(`/projects/${encodeURIComponent(projectId)}/plan/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}

export async function runStudioCommand(projectId, command, timeoutSeconds = 300) {
  return request(`/projects/${encodeURIComponent(projectId)}/commands`, {
    method: 'POST',
    timeoutMs: (timeoutSeconds + 15) * 1000,
    body: JSON.stringify({ command, timeout_seconds: timeoutSeconds }),
  })
}

export async function gitStatus(projectId) {
  return request(`/projects/${encodeURIComponent(projectId)}/git/status`)
}

export async function gitCommit(projectId, message) {
  return request(`/projects/${encodeURIComponent(projectId)}/git/commit`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export async function gitConnectGithub(projectId, repoUrl) {
  return request(`/projects/${encodeURIComponent(projectId)}/git/github`, {
    method: 'POST',
    body: JSON.stringify({ repo_url: repoUrl }),
  })
}

export async function gitPushGithub(projectId) {
  return request(`/projects/${encodeURIComponent(projectId)}/git/push`, { method: 'POST' })
}

export async function startPreview(projectId) {
  return request(`/projects/${encodeURIComponent(projectId)}/preview`, { method: 'POST' })
}

export async function listStudioTemplates() {
  const data = await request('/templates')
  return data?.templates ?? []
}

export async function publishStudioTemplate(projectId) {
  return request(`/templates/${encodeURIComponent(projectId)}/publish`, { method: 'POST' })
}

export async function remixStudioTemplate(templateId, newName) {
  return request(
    `/templates/${encodeURIComponent(templateId)}/remix?new_name=${encodeURIComponent(newName)}`,
    { method: 'POST' },
  )
}
