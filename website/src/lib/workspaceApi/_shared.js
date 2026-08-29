import { apiRequest } from '../request'

const WORKSPACE_ERROR_MESSAGE = 'Workspace data is unavailable.'
const WORKSPACE_TOKEN_MESSAGE = 'Sign in to access workspace data.'

export function request(path = '', options = {}) {
  return apiRequest(path, {
    errorMessage: WORKSPACE_ERROR_MESSAGE,
    missingTokenMessage: WORKSPACE_TOKEN_MESSAGE,
    ...options,
  })
}