import { useEffect, useRef, useState } from 'react'
import {
  fetchWhatsAppStatus,
  fetchWhatsAppChats,
  fetchWhatsAppMessages,
  markWhatsAppChatRead,
  whatsappSocket,
} from '../lib'
import { WhatsAppChatList } from '../components/whatsapp/WhatsAppChatList'
import { WhatsAppConversation } from '../components/whatsapp/WhatsAppConversation'
import { WhatsAppQrModal } from '../components/whatsapp/WhatsAppQrModal'
import { WhatsAppInfoDrawer } from '../components/whatsapp/WhatsAppInfoDrawer'
import { WhatsAppSummaryModal } from '../components/whatsapp/WhatsAppSummaryModal'
import { useWhatsAppMessageActions } from './whatsapp/useWhatsAppMessageActions'
import { useWhatsAppPairing } from './whatsapp/useWhatsAppPairing'
import { WhatsAppEmptyPane } from './whatsapp/WhatsAppEmptyPane'
import '../styles/pages/whatsapp-shell.css'
import '../styles/pages/whatsapp-sync.css'
import '../styles/pages/whatsapp-polish.css'

export function WhatsAppPage() {
  const [status, setStatus] = useState({ connected: false })
  const [chats, setChats] = useState([])
  const [selectedChatId, setSelectedChatId] = useState(null)
  const selectedChatIdRef = useRef(null)
  selectedChatIdRef.current = selectedChatId

  const [messages, setMessages] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false)
  const [isDrafting, setIsDrafting] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryModalText, setSummaryModalText] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [typingText, setTypingText] = useState('')

  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const {
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
  } = useWhatsAppMessageActions({
    setMessages,
    setChats,
    setSelectedChatId,
    selectedChatId,
    setSummaryModalText,
    setIsDrafting,
    setIsSummarizing,
  })

  const {
    pairingData,
    isQrLoading,
    handleQrUpdate,
    handleOpenQrModal,
    handleRequestPairingCode,
    handleCheckStatus,
  } = useWhatsAppPairing({
    status,
    setStatus,
    setChats,
    setSelectedChatId,
    isQrModalOpen,
    setIsQrModalOpen,
  })

  // Request browser notifications permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  const loadInitialData = async () => {
    try {
      const stat = await fetchWhatsAppStatus().catch(() => ({ connected: false }))
      setStatus(stat)

      const chatList = await fetchWhatsAppChats().catch(() => [])
      setChats(chatList)
      const initialChatId = chatList.length > 0 ? chatList[0].id : null
      setSelectedChatId((current) => current || initialChatId)

      if (initialChatId) {
        try {
          const initialMsgs = await fetchWhatsAppMessages(initialChatId, 50)
          const cleanSelected = initialChatId.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
          const validMsgs = (initialMsgs || []).filter((m) => {
            if (!m.chat_id) return true
            const cleanMsg = m.chat_id.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
            return cleanMsg === cleanSelected || m.chat_id === initialChatId
          })
          setMessages(validMsgs)
          setHasMoreMessages(validMsgs.length >= 50)
          markWhatsAppChatRead(initialChatId).catch(() => {})
        } catch {
          // Non-fatal: messages will be loaded by effect
        }
      }
    } catch (err) {
      console.error('WhatsApp initial load error:', err)
    }
  }

  useEffect(() => {
    let mounted = true
    loadInitialData()

    // Subscribe to WebSocket
    const unsubscribe = whatsappSocket.subscribe((event) => {
      if (!mounted || !event || !event.type) return

      if (event.type === 'connection_state' || event.type === 'status_update') {
        setStatus((prev) => ({
          ...prev,
          connected: event.connected,
          phone_number: event.phone_number,
          push_name: event.push_name,
        }))
        if (event.connected) {
          setIsQrModalOpen(false)
          fetchWhatsAppChats().then((list) => {
            setChats(list)
            setSelectedChatId((curr) => curr || (list.length > 0 ? list[0].id : null))
          }).catch(() => {})
        }
      } else if (event.type === 'chats_synced') {
        fetchWhatsAppChats().then((list) => {
          setChats(list)
          setSelectedChatId((curr) => curr || (list.length > 0 ? list[0].id : null))
        }).catch(() => {})
      } else if (event.type === 'qr_update') {
        handleQrUpdate(event.qr_code, event.pairing_code)
      } else if (event.type === 'new_message') {
        const incomingMsg = event.message
        if (incomingMsg) {
          const currentSelected = selectedChatIdRef.current
          const cleanSelected = currentSelected?.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
          const cleanMsgChat = incomingMsg.chat_id?.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')

          // Browser Push Notification if page hidden or unfocused
          if (!incomingMsg.is_from_me && typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted' && document.hidden) {
              const sender = incomingMsg.sender_name || 'WhatsApp Contact'
              const body = incomingMsg.content || (incomingMsg.media ? `[${incomingMsg.media.type}]` : 'New message')
              new Notification(`WhatsApp: ${sender}`, {
                body,
                icon: '/logo.png',
              })
            }
          }

          // Update messages if this chat is active
          if (
            !incomingMsg.chat_id ||
            cleanMsgChat === cleanSelected ||
            incomingMsg.chat_id === currentSelected
          ) {
            setMessages((prev) => {
              // 1. If message with same real ID already exists, update it
              const exists = prev.some((m) => m.id === incomingMsg.id)
              if (exists) {
                return prev.map((m) => (m.id === incomingMsg.id ? incomingMsg : m))
              }
              // 2. If it is from me, replace the matching optimistic message
              if (incomingMsg.is_from_me) {
                const tempIndex = prev.findIndex(
                  (m) => m.is_optimistic && m.chat_id === incomingMsg.chat_id && m.content === incomingMsg.content,
                )
                if (tempIndex !== -1) {
                  const updated = [...prev]
                  updated[tempIndex] = incomingMsg
                  return updated
                }
              }
              // 3. Otherwise append as new message
              return [...prev, incomingMsg]
            })
          }
          // Update chat list last message
          setChats((prev) =>
            prev.map((c) =>
              c.id === incomingMsg.chat_id
                ? {
                    ...c,
                    last_message: incomingMsg,
                    unread_count:
                      incomingMsg.chat_id === currentSelected ? 0 : (c.unread_count || 0) + 1,
                    updated_at: incomingMsg.timestamp,
                  }
                : c,
            ),
          )
        }
      } else if (event.type === 'typing_indicator' || event.type === 'presence') {
        const targetChat = event.chatId || event.chat_id
        const currentSelected = selectedChatIdRef.current
        const cleanSelected = currentSelected?.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
        const cleanTargetChat = targetChat?.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')

        if (targetChat && (cleanTargetChat === cleanSelected || targetChat === currentSelected)) {
          setIsTyping(Boolean(event.isTyping || event.state === 'composing'))
          setTypingText(event.senderName ? `${event.senderName} is typing...` : 'typing...')
          if (event.isTyping || event.state === 'composing') {
            setTimeout(() => setIsTyping(false), 5000)
          }
        }
      } else if (event.type === 'message_reaction') {
        const targetChat = event.chat_id || event.chatId
        const targetMsg = event.message_id || event.messageId
        const targetSender = event.sender || event.senderId || 'other'
        const targetSenderName = event.senderName || event.sender_name || null
        const currentSelected = selectedChatIdRef.current
        const cleanSelected = currentSelected?.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
        const cleanTargetChat = targetChat?.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')

        if (!targetChat || cleanTargetChat === cleanSelected || targetChat === currentSelected) {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== targetMsg) return m
              const existingReactions = (m.reactions || []).filter(
                (r) => r.sender !== targetSender && r.sender_id !== targetSender && r.senderId !== targetSender,
              )
              if (event.emoji) {
                existingReactions.push({
                  emoji: event.emoji,
                  sender: targetSender,
                  sender_id: targetSender,
                  sender_name: targetSenderName,
                  count: 1,
                })
              }
              return { ...m, reactions: existingReactions }
            }),
          )
        }
      } else if (event.type === 'receipt_update') {
        const targetIds = event.messageIds || event.message_ids || []
        const newStatus = event.status || 'delivered'
        const ts = event.timestamp || new Date().toISOString()
        setMessages((prev) =>
          prev.map((m) => {
            if (targetIds.includes(m.id)) {
              return {
                ...m,
                status: newStatus,
                read_at: newStatus === 'read' ? (m.read_at || ts) : m.read_at,
                delivered_at: (newStatus === 'delivered' || newStatus === 'read') ? (m.delivered_at || ts) : m.delivered_at,
              }
            }
            return m
          }),
        )
      } else if (event.type === 'message_deleted') {
        const targetMsg = event.message_id || event.messageId
        setMessages((prev) => prev.filter((m) => m.id !== targetMsg))
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [handleQrUpdate])

  useEffect(() => {
    if (!chats.length) {
      if (selectedChatId !== null) {
        setSelectedChatId(null)
      }
      return
    }

    const hasSelectedChat = chats.some((chat) => chat.id === selectedChatId)
    if (!selectedChatId || !hasSelectedChat) {
      setSelectedChatId(chats[0].id)
    }
  }, [chats, selectedChatId])

  // Load messages when selectedChatId changes — pages only after all new messages synced
  useEffect(() => {
    if (!selectedChatId) {
      setMessages([])
      setHasMoreMessages(false)
      return
    }

    const cleanSelectedEarly = selectedChatId.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
    const hasMessagesForChat =
      messages.length > 0 &&
      messages.some((m) => {
        if (!m.chat_id) return true
        const cm = m.chat_id.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
        return cm === cleanSelectedEarly || m.chat_id === selectedChatId
      })
    if (hasMessagesForChat && selectedChatIdRef.current === selectedChatId) {
      // Messages already synced for this chat — keep them, just ensure pagination reflects limit
      if (messages.length >= 50) setHasMoreMessages(true)
      return
    }

    // Immediately clear previous chat messages so they do not leak into newly selected chat
    setMessages([])
    setHasMoreMessages(true)

    let isCurrent = true
    fetchWhatsAppMessages(selectedChatId, 50)
      .then((msgs) => {
        if (isCurrent && selectedChatIdRef.current === selectedChatId) {
          const cleanSelected = selectedChatId.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
          const validMsgs = (msgs || []).filter((m) => {
            if (!m.chat_id) return true
            const cleanMsg = m.chat_id.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
            return cleanMsg === cleanSelected || m.chat_id === selectedChatId
          })
          setMessages(validMsgs)
          setHasMoreMessages(validMsgs.length >= 50)
          markWhatsAppChatRead(selectedChatId).catch(() => {})
          setChats((prev) =>
            prev.map((c) => (c.id === selectedChatId ? { ...c, unread_count: 0 } : c)),
          )
        }
      })
      .catch((err) => {
        if (isCurrent) {
          console.error('Could not load messages:', err)
          setMessages([])
          setHasMoreMessages(false)
        }
      })

    return () => {
      isCurrent = false
    }
    // Messages are intentionally excluded: this effect owns the initial load
    // for each selected chat and also updates the messages state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId])

  const handleLoadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || messages.length === 0 || !selectedChatId) return
    setIsLoadingMore(true)
    try {
      const sorted = [...messages].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
      const earliestMsg = sorted[0]
      const beforeTimestamp = earliestMsg?.timestamp
      // Server now syncs all new messages BEFORE paging, so beforeTimestamp pagination is correct
      const olderMsgs = await fetchWhatsAppMessages(selectedChatId, 50, beforeTimestamp)
      const cleanSelected = selectedChatId.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
      const validOlder = (olderMsgs || []).filter((m) => {
        if (!m.chat_id) return true
        const cleanMsg = m.chat_id.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
        return cleanMsg === cleanSelected || m.chat_id === selectedChatId
      })
      if (validOlder.length === 0) {
        setHasMoreMessages(false)
      } else {
        // If server returned less than full page, no more older messages after this
        const hasMore = validOlder.length >= 50
        setMessages((prev) => {
          const prevIds = new Set(prev.map((m) => m.id))
          const fresh = validOlder.filter((m) => !prevIds.has(m.id))
          if (fresh.length === 0) {
            setHasMoreMessages(false)
            return prev
          }
          if (!hasMore) setHasMoreMessages(false)
          else if (fresh.length < validOlder.length) {
            // Some duplicates — still keep hasMore based on server response
            setHasMoreMessages(hasMore)
          } else {
            setHasMoreMessages(hasMore)
          }
          return [...fresh, ...prev]
        })
        if (!hasMore) setHasMoreMessages(false)
      }
    } catch (err) {
      console.error('Failed to load older WhatsApp messages:', err)
      setHasMoreMessages(false)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const selectedChat = chats.find((c) => c.id === selectedChatId)

  return (
    <>
      <div className="whatsapp-page">
        <WhatsAppChatList
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={setSelectedChatId}
          onOpenQrModal={handleOpenQrModal}
          onTogglePinChat={handleTogglePinChat}
          onToggleMuteChat={handleToggleMuteChat}
          onToggleArchiveChat={handleToggleArchiveChat}
          onDeleteChat={handleDeleteChat}
          onMarkChatRead={handleMarkChatRead}
          isConnected={status.connected}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {selectedChat ? (
          <WhatsAppConversation
            key={selectedChat.id}
            chat={selectedChat}
            allChats={chats}
            messages={messages}
            hasMoreMessages={hasMoreMessages}
            isLoadingMore={isLoadingMore}
            onLoadMoreMessages={handleLoadMoreMessages}
            onSendMessage={handleSendMessage}
            onOpenInfoDrawer={() => setIsInfoDrawerOpen(true)}
            onToggleInfoDrawer={() => setIsInfoDrawerOpen((prev) => !prev)}
            onGenerateEveDraft={handleGenerateEveDraft}
            onSummarizeChat={handleSummarizeChat}
            onReactToMessage={handleReactToMessage}
            onStarMessage={handleStarMessage}
            onDeleteMessage={handleDeleteMessage}
            isDrafting={isDrafting}
            isSummarizing={isSummarizing}
            isTyping={isTyping}
            typingText={typingText}
          />
        ) : (
          <WhatsAppEmptyPane connected={status.connected} onLink={handleOpenQrModal} />
        )}

        {isInfoDrawerOpen && selectedChat && (
          <WhatsAppInfoDrawer
            chat={selectedChat}
            messages={messages}
            onClose={() => setIsInfoDrawerOpen(false)}
            onSummarizeChat={handleSummarizeChat}
            onToggleEveAutoReply={(chatId, enabled) => {
              setChats((prev) =>
                prev.map((c) => (c.id === chatId ? { ...c, eve_auto_reply: enabled } : c)),
              )
            }}
          />
        )}
      </div>

      <WhatsAppQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        qrCode={pairingData.qr_code}
        pairingCode={pairingData.pairing_code}
        onRefresh={handleOpenQrModal}
        onRequestPairingCode={handleRequestPairingCode}
        onCheckStatus={handleCheckStatus}
        loading={isQrLoading}
      />

      <WhatsAppSummaryModal
        isOpen={Boolean(summaryModalText)}
        onClose={() => setSummaryModalText(null)}
        summary={summaryModalText}
        chatId={selectedChatId}
        chatName={selectedChat?.name || 'this conversation'}
      />
    </>
  )
}
