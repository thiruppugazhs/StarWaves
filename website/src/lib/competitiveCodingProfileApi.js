import { apiRequest } from './request'

const BASE_PATH = '/settings/competitive-coding'
const ERROR_MESSAGE = 'Could not save competitive coding IDs.'
const TOKEN_MESSAGE = 'Sign in to update competitive coding IDs.'

function request(options = {}) {
  return apiRequest('', {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export function loadCompetitiveCodingProfile() {
  return request()
}

export function saveCompetitiveCodingProfile(profile) {
  return request({ method: 'PUT', body: JSON.stringify(profile) })
}
