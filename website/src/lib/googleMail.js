import { authorizeGmail, clearGmailAuthorization, hasGmailConnection, saveGmailAccountToken } from './firebase'
import { getStoredAuthToken } from './authApi'
import { getGmailToken } from './gmailApi'
import { openOAuthPopup } from '../utils/popupOAuth'

const API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const BACKEND_API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1'

export async function beginGmailOAuth() {
  const token = getStoredAuthToken()
  if (!token) throw new Error('Sign in to connect Gmail.')
  const response = await fetch(`${BACKEND_API_URL}/integrations/gmail/authorize`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const failure = await response.json().catch(() => null)
    throw new Error(failure?.detail || 'Gmail could not be connected.')
  }
  const { url } = await response.json()
  return openOAuthPopup(url, 'gmail-oauth')
}

function header(message, name) {
  return message.payload?.headers?.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  )?.value ?? ''
}

async function gmailFetch(path, token, options, retries = 3, backoff = 500) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  })
  if (response.status === 429 && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, backoff))
    return gmailFetch(path, token, options, retries - 1, backoff * 2)
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) clearGmailAuthorization()
    const failure = await response.json().catch(() => null)
    throw new Error(failure?.error?.message || 'Google Mail could not complete that request.')
  }
  return response.status === 204 ? null : response.json()
}

function decodeBase64Url(value = '') {
  if (!value) return ''
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function findBody(part, mimeType) {
  if (part?.mimeType === mimeType && part.body?.data) return decodeBase64Url(part.body.data)
  for (const child of part?.parts ?? []) {
    const body = findBody(child, mimeType)
    if (body) return body
  }
  return ''
}

function summary(message) {
  const from = header(message, 'From')
  return {
    id: message.id,
    threadId: message.threadId,
    sender: from.replace(/<[^>]+>/, '').replaceAll('"', '').trim() || from,
    from,
    to: header(message, 'To'),
    subject: header(message, 'Subject') || '(no subject)',
    date: header(message, 'Date'),
    snippet: message.snippet,
    unread: message.labelIds?.includes('UNREAD'),
    starred: message.labelIds?.includes('STARRED'),
  }
}

function encodeMessage({ to, cc, bcc, subject, body, inReplyTo, references }) {
  const headers = [
    `To: ${to}`,
    cc && `Cc: ${cc}`,
    bcc && `Bcc: ${bcc}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    inReplyTo && `In-Reply-To: ${inReplyTo}`,
    references && `References: ${references}`,
  ].filter(Boolean)
  const raw = `${headers.join('\r\n')}\r\n\r\n${body}`
  const bytes = new TextEncoder().encode(raw)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export { hasGmailConnection }

/**
 * Returns a valid Gmail access token for the given account email.
 * Tries the sessionStorage cache first; if missing or expired, fetches a
 * fresh token from the backend (which owns the stored refresh token) and
 * caches it for the duration of the session.
 */
async function resolveGmailToken(email = null) {
  try {
    const cached = await authorizeGmail(email)
    return cached
  } catch {
    // Cache miss or expired — fetch a fresh token from the backend
  }
  const { email: accountEmail, access_token: accessToken, expires_in: expiresIn } = await getGmailToken(email)
  const expiresAt = Date.now() + (expiresIn ?? 3599) * 1000
  saveGmailAccountToken(accountEmail, accessToken, expiresAt)
  return accessToken
}

async function mapConcurrent(items, limit, fn) {
  if (!items?.length) return []
  const results = new Array(items.length)
  let index = 0
  async function worker() {
    while (index < items.length) {
      const currentIndex = index++
      results[currentIndex] = await fn(items[currentIndex], currentIndex)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

function sanitizeEmailHtml(html = '') {
  if (!html) return ''
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
}

export async function loadGoogleMail(query = '', folder = 'INBOX', pageToken = '', targetEmail = null, category = '') {
  const token = await resolveGmailToken(targetEmail)
  const params = new URLSearchParams({ maxResults: '40' })
  if (folder) params.set('labelIds', folder)
  const search = [query.trim(), category ? `category:${category}` : ''].filter(Boolean).join(' ')
  if (search) params.set('q', search)
  if (pageToken) params.set('pageToken', pageToken)
  const [profile, list] = await Promise.all([
    gmailFetch('/profile', token),
    gmailFetch(`/messages?${params}`, token),
  ])
  const messages = await mapConcurrent(
    list.messages ?? [],
    6,
    (item) =>
      gmailFetch(`/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, token),
  )
  return {
    email: profile.emailAddress,
    messages: messages.map(summary),
    nextPageToken: list.nextPageToken ?? '',
  }
}

export async function loadGoogleMessage(id, targetEmail = null) {
  const token = await resolveGmailToken(targetEmail)
  const message = await gmailFetch(`/messages/${id}?format=full`, token)
  return {
    ...summary(message),
    messageId: header(message, 'Message-ID'),
    references: header(message, 'References'),
    html: sanitizeEmailHtml(findBody(message.payload, 'text/html')),
    body: findBody(message.payload, 'text/plain') || decodeBase64Url(message.payload?.body?.data),
  }
}

export async function updateGoogleMessage(id, { add = [], remove = [] }, targetEmail = null) {
  const token = await resolveGmailToken(targetEmail)
  return gmailFetch(`/messages/${id}/modify`, token, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
  })
}

export async function sendGoogleMessage(message, targetEmail = null) {
  const token = await resolveGmailToken(targetEmail)
  return gmailFetch('/messages/send', token, {
    method: 'POST',
    body: JSON.stringify({
      raw: encodeMessage(message),
      ...(message.threadId ? { threadId: message.threadId } : {}),
    }),
  })
}
