import { apiRequest } from './request'

const ERROR_MESSAGE = 'The contacts database is unavailable.'
const TOKEN_MESSAGE = 'Sign in to access your contacts.'

function authenticatedRequest(path = '', options = {}) {
  return apiRequest(path, {
    basePath: '/contacts',
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

function fromApi(contact) {
  return {
    id: contact.id,
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    company: contact.company || '',
    role: contact.role || '',
    category: contact.category || 'general',
    notes: contact.notes || '',
    avatarUrl: contact.avatar_url || '',
    starred: Boolean(contact.starred),
    createdAt: contact.created_at,
    updatedAt: contact.updated_at,
  }
}

function toApi(contact) {
  return {
    name: contact.name,
    email: contact.email || null,
    phone: contact.phone || null,
    company: contact.company || null,
    role: contact.role || null,
    category: contact.category || 'general',
    notes: contact.notes || null,
    avatar_url: contact.avatarUrl || null,
    starred: Boolean(contact.starred),
  }
}

export async function listContacts() {
  const data = await authenticatedRequest('')
  return (data || []).map(fromApi)
}

export async function getContact(contactId) {
  const data = await authenticatedRequest(`/${encodeURIComponent(contactId)}`)
  return fromApi(data)
}

export async function createContact(payload) {
  const data = await authenticatedRequest('', {
    method: 'POST',
    body: JSON.stringify(toApi(payload)),
  })
  return fromApi(data)
}

export async function updateContact(contactId, payload) {
  const data = await authenticatedRequest(`/${encodeURIComponent(contactId)}`, {
    method: 'PATCH',
    body: JSON.stringify(toApi(payload)),
  })
  return fromApi(data)
}

export function deleteContact(contactId) {
  return authenticatedRequest(`/${encodeURIComponent(contactId)}`, {
    method: 'DELETE',
  })
}

export async function toggleContactStarred(contactId, starred) {
  const data = await authenticatedRequest(`/${encodeURIComponent(contactId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ starred }),
  })
  return fromApi(data)
}
