import { getStoredAuthToken } from './authApi'
import { openOAuthPopup } from '../utils/popupOAuth'

const BACKEND_API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1'

export async function beginGoogleContactsOAuth() {
  const token = getStoredAuthToken()
  if (!token) throw new Error('Sign in to connect Google Contacts.')
  const response = await fetch(`${BACKEND_API_URL}/integrations/google-contacts/authorize`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const failure = await response.json().catch(() => null)
    throw new Error(failure?.detail || 'Google Contacts could not be connected.')
  }
  const { url } = await response.json()
  return openOAuthPopup(url, 'google-contacts-oauth')
}

export async function getGoogleContactsAccounts() {
  const token = getStoredAuthToken()
  if (!token) return { accounts: [] }
  const response = await fetch(`${BACKEND_API_URL}/integrations/google-contacts/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return { accounts: [] }
  return response.json()
}

export async function importGoogleContacts(accountId = null) {
  const token = getStoredAuthToken()
  if (!token) throw new Error('Sign in to import Google Contacts.')
  const url = accountId
    ? `${BACKEND_API_URL}/integrations/google-contacts/import?account_id=${encodeURIComponent(accountId)}`
    : `${BACKEND_API_URL}/integrations/google-contacts/import`
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const failure = await response.json().catch(() => null)
    throw new Error(failure?.detail || 'Failed to import contacts from Google.')
  }
  return response.json()
}

/**
 * Parse Google Contacts CSV export format
 */
export function parseGoogleContactsCsv(csvText = '') {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  // Helper to split CSV row taking quotes into account
  const parseRow = (text) => {
    const result = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim())
        cur = ''
      } else {
        cur += char
      }
    }
    result.push(cur.trim())
    return result
  }

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().trim())
  const nameIndex = headers.findIndex((h) => h === 'name' || h === 'display name' || h.includes('full name'))
  const givenIndex = headers.findIndex((h) => h === 'given name' || h === 'first name')
  const familyIndex = headers.findIndex((h) => h === 'family name' || h === 'last name')
  const emailIndex = headers.findIndex((h) => h.startsWith('e-mail') || h === 'email' || h.includes('email 1'))
  const phoneIndex = headers.findIndex((h) => h.startsWith('phone') || h === 'phone' || h.includes('phone 1'))
  const orgIndex = headers.findIndex((h) => h.includes('organization 1 - name') || h === 'company' || h === 'organization')
  const roleIndex = headers.findIndex((h) => h.includes('organization 1 - title') || h === 'title' || h === 'job title')
  const notesIndex = headers.findIndex((h) => h === 'notes' || h.includes('note'))

  const contacts = []
  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i])
    if (!row || row.length === 0) continue

    let name = (nameIndex >= 0 ? row[nameIndex] : '') || ''
    if (!name) {
      const given = givenIndex >= 0 ? row[givenIndex] : ''
      const family = familyIndex >= 0 ? row[familyIndex] : ''
      name = `${given} ${family}`.trim()
    }

    const email = emailIndex >= 0 ? row[emailIndex] : ''
    const phone = phoneIndex >= 0 ? row[phoneIndex] : ''
    const company = orgIndex >= 0 ? row[orgIndex] : ''
    const role = roleIndex >= 0 ? row[roleIndex] : ''
    const notes = notesIndex >= 0 ? row[notesIndex] : ''

    if (!name && !email && !phone) continue
    if (!name) name = email ? email.split('@')[0] : phone

    contacts.push({
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      role: role || null,
      category: 'general',
      notes: notes || null,
      starred: false,
    })
  }
  return contacts
}

/**
 * Parse vCard (.vcf) format
 */
export function parseVCard(vcardText = '') {
  const cards = vcardText.split(/BEGIN:VCARD/i).slice(1)
  const contacts = []

  for (const card of cards) {
    let name = ''
    let email = ''
    let phone = ''
    let company = ''
    let role = ''
    let notes = ''

    const lines = card.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('FN:')) {
        name = trimmed.slice(3).trim()
      } else if (trimmed.startsWith('N:') && !name) {
        const parts = trimmed.slice(2).split(';')
        name = `${parts[1] || ''} ${parts[0] || ''}`.trim()
      } else if (trimmed.includes('EMAIL') && trimmed.includes(':')) {
        email = trimmed.split(':').slice(1).join(':').trim()
      } else if (trimmed.includes('TEL') && trimmed.includes(':')) {
        phone = trimmed.split(':').slice(1).join(':').trim()
      } else if (trimmed.startsWith('ORG:')) {
        company = trimmed.slice(4).split(';')[0].trim()
      } else if (trimmed.startsWith('TITLE:')) {
        role = trimmed.slice(6).trim()
      } else if (trimmed.startsWith('NOTE:')) {
        notes = trimmed.slice(5).trim()
      }
    }

    if (!name && !email && !phone) continue
    if (!name) name = email ? email.split('@')[0] : phone

    contacts.push({
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      role: role || null,
      category: 'general',
      notes: notes || null,
      starred: false,
    })
  }

  return contacts
}
