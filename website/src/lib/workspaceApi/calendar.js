import { request } from './_shared'

export function loadCalendarData() {
  return request('/calendar-data')
}