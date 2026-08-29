import { apiRequest } from './request'

export function getUsageSummary(days) {
  const qs = days ? `?days=${days}` : ''
  return apiRequest(`/usage/summary${qs}`, { method: 'GET', useCache: false })
}

export function getUsageLogs({ limit = 50, provider, days } = {}) {
  const p = new URLSearchParams()
  if (limit) p.set('limit', String(limit))
  if (provider) p.set('provider', String(provider))
  if (days) p.set('days', String(days))
  const qs = p.toString() ? `?${p.toString()}` : ''
  return apiRequest(`/usage/logs${qs}`, { method: 'GET', useCache: false })
}
