import { apiRequest } from './request'

const BASE_PATH = '/settings/ai-models'
const ERROR_MESSAGE = 'Could not update AI model settings.'
const TOKEN_MESSAGE = 'Sign in to update AI model settings.'

function request(options = {}) {
  return apiRequest('', {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

export function loadAiModels() {
  return request()
}

export async function listProviderModels(provider, apiKey = null) {
  const qs = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : ''
  return apiRequest(`/models/${encodeURIComponent(provider)}${qs}`, {
    basePath: BASE_PATH,
    errorMessage: `Could not list models for ${provider}.`,
    missingTokenMessage: TOKEN_MESSAGE,
    // Idempotent discovery — cache 60s + dedup prevents thundering herd;
    // retry 429 with backoff (request.js handles Retry-After)
    useCache: true,
    useCacheTtl: 60_000,
    retries: 2,
  })
}

export function saveAiModelPreference(preference) {
  return request({ method: 'PUT', body: JSON.stringify(preference) })
}