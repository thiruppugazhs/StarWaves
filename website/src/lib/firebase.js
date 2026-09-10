import { GMAIL_ACCOUNTS_KEY, GMAIL_CONNECTED_KEY, GMAIL_SESSION_KEY } from './storageKeys'
// Connection helpers for multi-account Gmail authorization cache

export function clearGmailAuthorization(email = null) {
  if (email) {
    try {
      const map = JSON.parse(sessionStorage.getItem(GMAIL_ACCOUNTS_KEY) ?? '{}')
      delete map[email.toLowerCase()]
      sessionStorage.setItem(GMAIL_ACCOUNTS_KEY, JSON.stringify(map))
    } catch {
      // ignore
    }
  } else {
    sessionStorage.removeItem(GMAIL_SESSION_KEY)
    sessionStorage.removeItem(GMAIL_ACCOUNTS_KEY)
    localStorage.removeItem(GMAIL_CONNECTED_KEY)
  }
  window.dispatchEvent(new Event('starwaves:gmail-change'))
}

export function saveGmailAccountToken(email, token, expiresAt) {
  try {
    const map = JSON.parse(sessionStorage.getItem(GMAIL_ACCOUNTS_KEY) ?? '{}')
    map[email.toLowerCase()] = { accessToken: token, expiresAt }
    sessionStorage.setItem(GMAIL_ACCOUNTS_KEY, JSON.stringify(map))
    sessionStorage.setItem(GMAIL_SESSION_KEY, JSON.stringify({ accessToken: token, expiresAt }))
    localStorage.setItem(GMAIL_CONNECTED_KEY, 'true')
    window.dispatchEvent(new Event('starwaves:gmail-change'))
  } catch {
    // ignore
  }
}

export function hasGmailConnection() {
  return localStorage.getItem(GMAIL_CONNECTED_KEY) === 'true'
}

export async function authorizeGmail(email = null) {
  try {
    if (email) {
      const map = JSON.parse(sessionStorage.getItem(GMAIL_ACCOUNTS_KEY) ?? '{}')
      const account = map[email.toLowerCase()]
      if (account?.accessToken && account.expiresAt > Date.now()) {
        return account.accessToken
      }
    }
    const cached = JSON.parse(sessionStorage.getItem(GMAIL_SESSION_KEY) ?? 'null')
    if (cached?.accessToken && cached.expiresAt > Date.now()) {
      return cached.accessToken
    }
  } catch {
    // ignore
  }
  throw new Error('Google Mail authorization is required.')
}
