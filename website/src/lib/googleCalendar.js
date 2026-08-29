import { apiRequest } from './request'
import { openOAuthPopup } from '../utils/popupOAuth'

const BASE_PATH = '/integrations/google-calendar'
const ERROR_MESSAGE = 'Google Calendar could not be connected.'
const TOKEN_MESSAGE = 'Sign in to connect Google Calendar.'

function request(path, options = {}) {
  return apiRequest(path, {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export async function beginGoogleCalendarOAuth() {
  const { url } = await request('/authorize')
  return openOAuthPopup(url, 'google-calendar-oauth')
}

export function loadGoogleCalendarData() {
  return request('/data')
}

export function removeGoogleCalendarAccount(accountId) {
  return request(`/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' })
}
