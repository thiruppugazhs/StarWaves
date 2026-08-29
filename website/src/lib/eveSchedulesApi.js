import { apiRequest } from './request'

const BASE_PATH = '/eve/schedules'
const ERROR_MESSAGE = 'Eve schedule request failed.'
const TOKEN_MESSAGE = 'Sign in to manage Eve schedules.'

function request(path = '', options = {}) {
  return apiRequest(path, {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export function listEveSchedules() {
  return request('')
}

export function createEveSchedule(payload) {
  return request('', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateEveSchedule(scheduleId, updates) {
  return request(`/${scheduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export function deleteEveSchedule(scheduleId) {
  return request(`/${scheduleId}`, { method: 'DELETE' })
}

export function runEveScheduleNow(scheduleId) {
  return request(`/${scheduleId}/run`, { method: 'POST' })
}
