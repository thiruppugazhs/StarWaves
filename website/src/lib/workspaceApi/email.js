import { request } from './_shared'

export function sendCalendarReminderTest(window = '1h', eventTitle = 'Team Sync & Code Review') {
  return request('/email/send-calendar-reminder-test', {
    method: 'POST',
    body: JSON.stringify({ window, event_title: eventTitle }),
  })
}