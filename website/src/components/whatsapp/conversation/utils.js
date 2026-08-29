/** WhatsApp conversation pure helpers — single responsibility: message formatting and parsing. */

export function extractFirstUrl(text) {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const match = text.match(urlRegex)
  if (!match) return null
  try {
    const parsed = new URL(match[0])
    return {
      url: match[0],
      hostname: parsed.hostname.replace(/^www\./, ''),
    }
  } catch {
    return null
  }
}

export function formatSenderName(name, senderId) {
  if (!name && !senderId) return ''
  const raw =
    name && name !== 'Contact' && name !== '1289' && !name.includes('@s.whatsapp.net') && !name.includes('@g.us') && !name.includes('@lid')
      ? name
      : senderId || ''

  if (!raw) return ''
  const clean = raw.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '').trim()
  // Hide numeric JID/phone when no display name exists
  if (/^\+?\d{6,}$/.test(clean)) {
    return ''
  }
  return clean || ''
}

export function formatMessageContent(text) {
  if (!text) return ''
  // Hide raw numeric JID mentions — they are shown as names via participant map; if no name, show nothing
  const stripped = text.replace(/@\+?\d{7,15}\b/g, '').replace(/\s{2,}/g, ' ').trim()
  // If stripping leaves empty but original was only a mention, return empty to avoid showing bare JID
  if (!stripped && /@\+?\d/.test(text)) return ''
  return stripped || text.replace(/@(\d{7,15})/g, '').trim()
}

export function getSenderInitial(name) {
  if (!name) return '?'
  const clean = name.trim().replace(/^[@+~]/, '')
  return (clean[0] || '?').toUpperCase()
}

export function formatReactions(reactions) {
  if (!reactions || reactions.length === 0) return null
  const emojiSet = []
  let totalCount = 0
  for (const r of reactions) {
    if (r && r.emoji) {
      if (!emojiSet.includes(r.emoji)) {
        emojiSet.push(r.emoji)
      }
      totalCount += r.count || 1
    }
  }
  if (emojiSet.length === 0) return null
  return {
    emojis: emojiSet.slice(0, 3),
    totalCount,
  }
}

export function formatMessageTime(isoString) {
  if (!isoString) return ''
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
