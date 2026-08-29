import { apiRequest } from './request'

const BASE_PATH = '/email'
const ERROR_MESSAGE = 'Email request failed.'
const TOKEN_MESSAGE = 'Sign in to continue.'

function request(path, options = {}) {
  return apiRequest(path, {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    onFetchError: (error) =>
      new Error(error.message || 'Unable to connect to email service server. Please try again.'),
    ...options,
  })
}

export function fetchEmailStatus() {
  return request('/status')
}

export function sendTestEmail(toEmail = null) {
  return request('/send-test', {
    method: 'POST',
    body: JSON.stringify({ to_email: toEmail }),
  })
}

export function resendWelcomeEmail() {
  return request('/resend-welcome', { method: 'POST' })
}

export function sendVerificationEmail() {
  return request('/send-verification', { method: 'POST' })
}

export function confirmEmailVerification(token) {
  return request('/verify-email/confirm', {
    method: 'POST',
    body: JSON.stringify({ token }),
    authRequired: false,
  })
}

export function sendReminderEmail({ title, type = 'Task Reminder', dueTime = 'Today', description = '', toEmail = null }) {
  return request('/send-reminder', {
    method: 'POST',
    body: JSON.stringify({
      reminder_title: title,
      reminder_type: type,
      due_time: dueTime,
      description,
      to_email: toEmail,
    }),
  })
}
