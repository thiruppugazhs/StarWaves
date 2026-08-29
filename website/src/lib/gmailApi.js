import { apiRequest } from './request'

const BASE_PATH = '/integrations/gmail'
const ERROR_MESSAGE = 'Google Mail is unavailable.'
const TOKEN_MESSAGE = 'Sign in to connect Google Mail.'

function request(path, options = {}) {
  return apiRequest(path, {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export function saveGmailConnection(accessToken) {
  return request('/accounts', {
    method: 'POST',
    body: JSON.stringify({ access_token: accessToken }),
  })
}

export function getGmailStatus() {
  return request('/status')
}

export function getGmailToken(email = null) {
  const path = email ? `/token?email=${encodeURIComponent(email)}` : '/token'
  return request(path)
}

export function getGmailAccounts() {
  return request('/accounts')
}

export function disconnectGmailAccount(accountId) {
  return request(`/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' })
}

export function disconnectGmail() {
  return request('', { method: 'DELETE' })
}
