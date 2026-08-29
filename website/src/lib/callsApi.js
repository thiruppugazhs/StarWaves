import { apiRequest } from './request'

const BASE_PATH = '/calls'
const ERROR_MESSAGE = 'Call request failed.'
const TOKEN_MESSAGE = 'Sign in to make calls.'

function request(path, options = {}) {
  return apiRequest(path, {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export function createCall(calleeIdentifier, mode) {
  return request('', {
    method: 'POST',
    body: JSON.stringify({ callee_identifier: calleeIdentifier, mode }),
  })
}

export function getCall(callId) {
  return request(`/${callId}`)
}

export function updateCallStatus(callId, status) {
  return request(`/${callId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function sendCallSignal(callId, type, payload) {
  return request(`/${callId}/signals`, {
    method: 'POST',
    body: JSON.stringify({ type, payload }),
  })
}

export function getIncomingCalls() {
  return request('/incoming')
}

export function getRecentCalls() {
  return request('/recent')
}

export function triggerEveCall(mode = 'audio') {
  return request(`/trigger-eve?mode=${mode}`, {
    method: 'POST',
  })
}

export function triggerEveTwilioCall(phoneNumber, prompt, mode = 'audio') {
  return request('/trigger-eve-twilio', {
    method: 'POST',
    body: JSON.stringify({ phone_number: phoneNumber, prompt, mode }),
  })
}

export function createTwilioCall(phoneNumber, message, mode = 'audio') {
  return request('/twilio', {
    method: 'POST',
    body: JSON.stringify({ phone_number: phoneNumber, message, mode }),
  })
}

export function getTwilioConfig() {
  return request('/twilio/config')
}
