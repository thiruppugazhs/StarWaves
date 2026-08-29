import { apiRequest } from './request'

const BASE_PATH = '/settings/eve-memory'
const ERROR_MESSAGE = 'Could not update Eve memory settings.'
const TOKEN_MESSAGE = 'Sign in to update Eve memory settings.'

function request(options = {}) {
  return apiRequest('', {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export function loadEveMemorySettings() {
  return request()
}

export function saveEveMemorySettings(settings) {
  return request({ method: 'PUT', body: JSON.stringify(settings) })
}
