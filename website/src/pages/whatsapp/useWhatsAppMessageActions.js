import { useRef } from 'react'
import {
  deleteWhatsAppMessage,
  generateEveWhatsAppDraft,
  markWhatsAppChatRead,
  reactToWhatsAppMessage,
  sendWhatsAppMessage,
  starWhatsAppMessage,
  summarizeWhatsAppChat,
} from '../../lib'

export function useWhatsAppMessageActions({
  setMessages,
  setChats,
  setSelectedChatId,
  selectedChatId,
  setSummaryModalText,
  setIsDrafting,
  setIsSummarizing,
}) {
  const inFlightMessages = useRef(new Set())

  const handleSendMessage = async ({ chatId, content, media, replyToMessageId }) => {
    const requestKey = `${chatId}:${content}:${replyToMessageId || ''}:${media?.type || ''}:${media?.filename || ''}`
    if (inFlightMessages.current.has(requestKey)) return
    inFlightMessages.current.add(requestKey)
    try {
      const tempId = `temp-${Date.now()}`
      const optimisticMsg = {
        id: tempId,
        chat_id: chatId,
        sender_id: 'me',
        sender_name: 'Me',
        is_from_me: true,
        is_eve: false,
        content,
        timestamp: new Date().toISOString(),
        status: 'pending',
        media,
        is_optimistic: true,
      }
      setMessages((prev) => [...prev, optimisticMsg])

      const sentMsg = await sendWhatsAppMessage({ chatId, content, media, replyToMessageId })
      setMessages((prev) => {
        const hasRealMessage = prev.some((m) => m.id === sentMsg.id)
        if (hasRealMessage) {
          return prev.filter((m) => m.id !== tempId)
        }
        return prev.map((m) => (m.id === tempId ? sentMsg : m))
      })

      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, last_message: sentMsg, updated_at: sentMsg.timestamp } : c,
        ),
      )
    } catch (err) {
      console.error('Failed to send WhatsApp message:', err)
    } finally {
      inFlightMessages.current.delete(requestKey)
    }
  }

  const handleGenerateEveDraft = async (chatId) => {
    try {
      setIsDrafting(true)
      const res = await generateEveWhatsAppDraft(chatId)
      return res.draft
    } catch (err) {
      console.error('Failed to draft with Eve:', err)
      return null
    } finally {
      setIsDrafting(false)
    }
  }

  const handleSummarizeChat = async (chatId) => {
    setIsSummarizing(true)
    try {
      const res = await summarizeWhatsAppChat(chatId)
      setSummaryModalText(res.summary)
    } catch {
      alert('Could not summarize conversation at this time.')
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleReactToMessage = async (chatId, messageId, emoji) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m
        const existing = (m.reactions || []).filter((r) => r.sender !== 'me')
        if (emoji) existing.push({ emoji, sender: 'me', count: 1 })
        return { ...m, reactions: existing }
      }),
    )
    try {
      await reactToWhatsAppMessage(chatId, messageId, emoji)
    } catch (err) {
      console.error('Failed to react to message:', err)
    }
  }

  const handleStarMessage = async (chatId, messageId, isStarred) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, is_starred: isStarred } : m)),
    )
    try {
      await starWhatsAppMessage(chatId, messageId, isStarred)
    } catch (err) {
      console.error('Failed to star message:', err)
    }
  }

  const handleDeleteMessage = async (chatId, messageId) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    try {
      await deleteWhatsAppMessage(chatId, messageId)
    } catch (err) {
      console.error('Failed to delete message:', err)
    }
  }

  const handleTogglePinChat = (chatId, pinned) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, pinned } : c)),
    )
  }

  const handleToggleMuteChat = (chatId, isMuted) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, is_muted: isMuted } : c)),
    )
  }

  const handleToggleArchiveChat = (chatId, isArchived) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, is_archived: isArchived } : c)),
    )
    if (isArchived && selectedChatId === chatId) {
      setSelectedChatId(null)
    }
  }

  const handleDeleteChat = (chatId) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId))
    if (selectedChatId === chatId) {
      setSelectedChatId(null)
    }
  }

  const handleMarkChatRead = (chatId) => {
    markWhatsAppChatRead(chatId).catch(() => {})
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unread_count: 0 } : c)),
    )
  }

  return {
    handleSendMessage,
    handleGenerateEveDraft,
    handleSummarizeChat,
    handleReactToMessage,
    handleStarMessage,
    handleDeleteMessage,
    handleTogglePinChat,
    handleToggleMuteChat,
    handleToggleArchiveChat,
    handleDeleteChat,
    handleMarkChatRead,
  }
}
