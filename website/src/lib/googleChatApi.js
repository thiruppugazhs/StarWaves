import { apiRequest } from './request'
import { openOAuthPopup } from '../utils/popupOAuth'

const BASE_PATH = '/integrations/google-chat'
const ERROR_MESSAGE = 'Google Chat service unavailable.'
const TOKEN_MESSAGE = 'Sign in to connect Google Chat.'

function request(path, options = {}) {
  return apiRequest(path, {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export async function beginGoogleChatOAuth() {
  const data = await request('/authorize')
  if (data?.url) {
    return openOAuthPopup(data.url, 'google-chat-oauth')
  }
  throw new Error('Could not initiate Google Chat OAuth authorization.')
}

export function getGoogleChatAccounts() {
  return request('/accounts')
}

export function saveGoogleChatAccount(accessToken) {
  return request('/accounts', {
    method: 'POST',
    body: JSON.stringify({ access_token: accessToken }),
  })
}

export function disconnectGoogleChatAccount(accountId) {
  return request(`/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' })
}

export function getGoogleChatSpaces(accountEmail) {
  const query = accountEmail ? `?account_email=${encodeURIComponent(accountEmail)}` : ''
  return request(`/spaces${query}`)
}

export function sendGoogleChatMessage(spaceId, text, accountEmail) {
  return request('/messages', {
    method: 'POST',
    body: JSON.stringify({
      space_id: spaceId,
      text,
      account_email: accountEmail,
    }),
  })
}
