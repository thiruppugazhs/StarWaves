import { request } from './_shared'

export function loadContests(cursor = null) {
  return request(
    `/contests?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    { authRequired: false },
  )
}