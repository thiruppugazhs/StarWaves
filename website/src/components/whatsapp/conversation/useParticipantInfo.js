/** Participant info hook — single responsibility: resolve participant names/avatars. */
import { useMemo } from 'react'
import { getSenderInitial } from './utils'

export function useParticipantInfo({ chat, allChats, messages }) {
  const participantInfoMap = useMemo(() => {
    const nameMap = new Map()
    const avatarMap = new Map()

    const register = (id, name, avatar) => {
      if (!id) return
      const raw = String(id).trim()
      const clean = raw.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '').trim()
      const userPart = clean.includes('@') ? clean.split('@')[0] : clean

      const isValidName =
        name &&
        name !== 'Contact' &&
        name !== 'Group conversation' &&
        name !== '1289' &&
        !name.includes('@s.whatsapp.net') &&
        !name.includes('@g.us') &&
        !name.includes('@lid')

      if (isValidName) {
        nameMap.set(raw, name)
        nameMap.set(clean, name)
        nameMap.set(userPart, name)
        if (/^\d+$/.test(userPart)) {
          nameMap.set(`+${userPart}`, name)
        }
      }
      if (avatar) {
        avatarMap.set(raw, avatar)
        avatarMap.set(clean, avatar)
        avatarMap.set(userPart, avatar)
      }
    }

    if (chat) {
      register(chat.id, chat.name, chat.avatar_url)
      if (chat.phone_number) {
        register(chat.phone_number, chat.name, chat.avatar_url)
      }
      if (Array.isArray(chat.participants)) {
        for (const p of chat.participants) {
          if (p) register(p, null, null)
        }
      }
    }

    for (const c of allChats || []) {
      if (!c) continue
      register(c.id, c.name, c.avatar_url)
      if (c.phone_number) {
        register(c.phone_number, c.name, c.avatar_url)
      }
      if (Array.isArray(c.participants)) {
        for (const p of c.participants) {
          if (p) register(p, null, null)
        }
      }
    }

    for (const m of messages || []) {
      if (!m) continue
      register(m.sender_id, m.sender_name, m.sender_avatar_url)
      if (Array.isArray(m.reactions)) {
        for (const r of m.reactions) {
          if (r?.sender_name && r.sender_name !== 'Contact') {
            register(r.sender || r.sender_id, r.sender_name, r.sender_avatar_url)
          }
        }
      }
    }

    return { nameMap, avatarMap }
  }, [chat, allChats, messages])

  const participantNameMap = useMemo(() => participantInfoMap.nameMap, [participantInfoMap])

  const resolveReactionSender = (rx) => {
    if (!rx) return { name: 'Contact', avatar: null, initial: '?' }

    const isMe =
      rx.sender === 'You' ||
      rx.sender === 'me' ||
      rx.is_from_me ||
      rx.sender_id === 'me' ||
      rx.senderId === 'me' ||
      rx.sender_name === 'You' ||
      rx.senderName === 'You'
    if (isMe) {
      return { name: 'You', isMe: true, avatar: null, initial: 'Y' }
    }

    const explicitName = rx.sender_name || rx.senderName
    if (
      explicitName &&
      explicitName !== 'Contact' &&
      explicitName !== '1289' &&
      !explicitName.includes('@s.whatsapp.net') &&
      !explicitName.includes('@lid') &&
      !explicitName.includes('@g.us')
    ) {
      const avatar =
        rx.sender_avatar_url ||
        rx.senderAvatarUrl ||
        participantInfoMap.avatarMap.get(rx.sender) ||
        participantInfoMap.avatarMap.get(rx.sender_id) ||
        null
      return { name: explicitName, isMe: false, avatar, initial: getSenderInitial(explicitName) }
    }

    const rawSender = String(rx.sender || rx.sender_id || rx.senderId || '').trim()
    const cleanSender = rawSender.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '').trim()
    const userPart = cleanSender.includes('@') ? cleanSender.split('@')[0] : cleanSender

    if (rawSender && participantInfoMap.nameMap.has(rawSender)) {
      const name = participantInfoMap.nameMap.get(rawSender)
      return { name, isMe: false, avatar: participantInfoMap.avatarMap.get(rawSender) || null, initial: getSenderInitial(name) }
    }
    if (cleanSender && participantInfoMap.nameMap.has(cleanSender)) {
      const name = participantInfoMap.nameMap.get(cleanSender)
      return { name, isMe: false, avatar: participantInfoMap.avatarMap.get(cleanSender) || null, initial: getSenderInitial(name) }
    }
    if (userPart && participantInfoMap.nameMap.has(userPart)) {
      const name = participantInfoMap.nameMap.get(userPart)
      return { name, isMe: false, avatar: participantInfoMap.avatarMap.get(userPart) || null, initial: getSenderInitial(name) }
    }

    if (!chat?.is_group && chat?.name && chat.name !== 'Contact' && chat.name !== chat.id) {
      return { name: chat.name, isMe: false, avatar: chat.avatar_url || null, initial: getSenderInitial(chat.name) }
    }

    if (Array.isArray(chat?.participants)) {
      for (const p of chat.participants) {
        if (!p) continue
        const cleanP = String(p).replace(/@s\.whatsapp\.net|@lid/g, '').trim()
        if (cleanP === cleanSender || cleanP === userPart || (userPart && cleanP.includes(userPart))) {
          const isNum = /^\+?\d+$/.test(cleanP)
          if (isNum) {
            return { name: '', isMe: false, avatar: participantInfoMap.avatarMap.get(cleanP) || null, initial: '?' }
          }
          return {
            name: cleanP,
            isMe: false,
            avatar: participantInfoMap.avatarMap.get(cleanP) || null,
            initial: getSenderInitial(cleanP),
          }
        }
      }
    }

    if (userPart || rawSender) {
      const matchedMsg = (messages || []).find(
        (m) =>
          m.sender_id &&
          (m.sender_id === rawSender ||
            m.sender_id === cleanSender ||
            m.sender_id.startsWith(userPart) ||
            userPart.startsWith(m.sender_id.replace(/@s\.whatsapp\.net|@lid/g, ''))),
      )
      if (matchedMsg && matchedMsg.sender_name && matchedMsg.sender_name !== 'Contact') {
        return {
          name: matchedMsg.sender_name,
          isMe: false,
          avatar: matchedMsg.sender_avatar_url || null,
          initial: getSenderInitial(matchedMsg.sender_name),
        }
      }
    }

    if (userPart) {
      const cleanUserPart = userPart.replace(/\D/g, '')
      const matchedContact = (allChats || []).find((c) => {
        if (!c || !c.name || c.name === 'Contact') return false
        if (c.id === rawSender || c.id === cleanSender || c.id?.includes(userPart)) return true
        if (cleanUserPart && c.phone_number && c.phone_number.replace(/\D/g, '') === cleanUserPart) return true
        return false
      })
      if (matchedContact) {
        return { name: matchedContact.name, isMe: false, avatar: matchedContact.avatar_url || null, initial: getSenderInitial(matchedContact.name) }
      }
    }

    if (/^\+?\d{6,}$/.test(cleanSender || userPart)) {
      return { name: '', isMe: false, avatar: participantInfoMap.avatarMap.get(userPart) || null, initial: '?' }
    }

    if (cleanSender && cleanSender !== 'Contact' && cleanSender !== '1289') {
      if (/^\+?\d{6,}$/.test(cleanSender)) return { name: '', isMe: false, avatar: null, initial: '?' }
      return { name: cleanSender, isMe: false, avatar: null, initial: getSenderInitial(cleanSender) }
    }

    return { name: '', isMe: false, avatar: null, initial: '?' }
  }

  const formatParticipantsSubtitle = (participants) => {
    if (!participants || participants.length === 0) return 'Group conversation'
    const formatted = participants
      .map((p) => {
        if (!p) return ''
        const raw = String(p).trim()
        if (participantNameMap.has(raw)) {
          const v = participantNameMap.get(raw)
          if (v && v !== 'Contact' && !/^\+?\d{6,}$/.test(v.replace(/\D/g, ''))) return v
        }
        const clean = raw.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '').trim()
        if (participantNameMap.has(clean)) {
          const v = participantNameMap.get(clean)
          if (v && v !== 'Contact') return v
        }
        // Numeric JID without display name — hide per requirement
        if (/^\+?\d{6,}$/.test(clean)) return ''
        return clean || ''
      })
      .filter(Boolean)
    if (formatted.length === 0) return 'Group conversation'
    return formatted.slice(0, 4).join(', ') + (formatted.length > 4 ? ` and ${formatted.length - 4} more...` : '')
  }

  return { participantInfoMap, participantNameMap, resolveReactionSender, formatParticipantsSubtitle }
}
