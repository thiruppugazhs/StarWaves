import { apiRequest } from './request'

export function loadPlatformCodingStats(platform) {
  return apiRequest(`/stats/competitive-coding/${platform}`, {
    errorMessage: 'Could not load coding statistics.',
    missingTokenMessage: 'Sign in to load coding statistics.',
  })
}
