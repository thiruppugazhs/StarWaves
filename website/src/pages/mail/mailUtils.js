import { BellRing, Inbox, MessagesSquare, Megaphone, Send, Star, Trash2, MailOpen } from 'lucide-react'
import DOMPurify from 'dompurify'

export const FOLDERS = [
  { id: 'INBOX', label: 'Inbox', icon: Inbox },
  { id: 'STARRED', label: 'Starred', icon: Star },
  { id: 'SENT', label: 'Sent', icon: Send },
  { id: 'DRAFT', label: 'Drafts', icon: MailOpen },
  { id: 'TRASH', label: 'Trash', icon: Trash2 },
]

export const INBOX_TABS = [
  { id: 'primary', label: 'Primary', icon: Inbox },
  { id: 'promotions', label: 'Promotions', icon: Megaphone },
  { id: 'updates', label: 'Updates', icon: BellRing },
  { id: 'forums', label: 'Forums', icon: MessagesSquare },
]

export function formatMailDate(value, long = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (long) return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function emailAddress(value = '') {
  return value.match(/<([^>]+)>/)?.[1] || value
}

export function sanitizeEmailHtml(html = '') {
  if (!html) return ''
  try {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['style'],
      ALLOW_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    })
  } catch {
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  }
}

export const EMPTY_COMPOSE = { to: '', cc: '', bcc: '', subject: '', body: '', threadId: '', inReplyTo: '', references: '' }

// Shared reply-draft builder: pre-fills a compose draft from a message.
export function buildReplyDraft(message) {
  return {
    to: emailAddress(message.from),
    subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
    threadId: message.threadId,
    inReplyTo: message.messageId,
    references: message.references ? `${message.references} ${message.messageId}` : message.messageId,
    body: `\n\nOn ${message.date}, ${message.from} wrote:\n> ${message.body.replaceAll('\n', '\n> ')}`,
  }
}
