import { useEffect, useRef, useState } from 'react'
import {
  fetchWhatsAppStatus,
  fetchWhatsAppChats,
  fetchWhatsAppMessages,
  sendWhatsAppMessage,
  markWhatsAppChatRead,
  initiateWhatsAppPairing,
  confirmWhatsAppPairing,
  generateEveWhatsAppDraft,
  summarizeWhatsAppChat,
  reactToWhatsAppMessage,
  starWhatsAppMessage,
  deleteWhatsAppMessage,
  whatsappSocket,
} from '../lib'
import { WhatsAppChatList } from '../components/whatsapp/WhatsAppChatList'
import { WhatsAppConversation } from '../components/whatsapp/WhatsAppConversation'
import { WhatsAppQrModal } from '../components/whatsapp/WhatsAppQrModal'
import { WhatsAppInfoDrawer } from '../components/whatsapp/WhatsAppInfoDrawer'
import { WhatsAppSummaryModal } from '../components/whatsapp/WhatsAppSummaryModal'
import { MessageSquare, QrCode, RefreshCw, WifiOff, Loader2 } from 'lucide-react'

export function WhatsAppPage() {
  const [status, setStatus] = useState({ connected: false })
  const [chats, setChats] = useState([])
  const [selectedChatId, setSelectedChatId] = useState(null)
  const selectedChatIdRef = useRef(null)
  selectedChatIdRef.current = selectedChatId

  const [messages, setMessages] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [pairingData, setPairingData] = useState({ qr_code: null, pairing_code: null })
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false)
  const [isDrafting, setIsDrafting] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryModalText, setSummaryModalText] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [typingText, setTypingText] = useState('')

  // Sync / Health states: 'syncing' | 'ready' | 'error'
  const [syncStatus, setSyncStatus] = useState('syncing')
  const [syncProgress, setSyncProgress] = useState(15)
  const [syncStepText, setSyncStepText] = useState('Checking WhatsApp server gateway...')
  const [syncError, setSyncError] = useState(null)

  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Request browser notifications permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Sync and load initial status and chats with progressive loading bar — pages after loading all new messages
  const runFullSync = async () => {
    setSyncStatus('syncing')
    setSyncProgress(20)
    setSyncStepText('Connecting to WhatsApp Gateway...')
    setSyncError(null)

    try {
      // Step 1: Health & Connection check
      setSyncProgress(40)
      setSyncStepText('Verifying gateway connection and session status...')
      const stat = await fetchWhatsAppStatus().catch((err) => {
        throw new Error(`Unable to reach WhatsApp gateway: ${err.message || 'Server offline'}`)
      })
      setStatus(stat)

      // Step 2: Sync chats and contacts (server syncs new chats BEFORE returning)
      setSyncProgress(60)
      setSyncStepText('Syncing conversations and contacts...')
      const chatList = await fetchWhatsAppChats().catch((err) => {
        throw new Error(`Failed to sync chat history: ${err.message || 'Database error'}`)
      })

      setChats(chatList)
      const initialChatId = chatList.length > 0 ? chatList[0].id : null
      setSelectedChatId((current) => current || initialChatId)

      // Step 3: Sync latest messages for initial chat BEFORE paging to ready — ensures pagination reflects all new messages
      if (initialChatId) {
        setSyncProgress(85)
        setSyncStepText('Syncing latest messages...')
        try {
          const initialMsgs = await fetchWhatsAppMessages(initialChatId, 50)
          const cleanSelected = initialChatId.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
          const validMsgs = (initialMsgs || []).filter((m) => {
            if (!m.chat_id) return true
            const cleanMsg = m.chat_id.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
            return cleanMsg === cleanSelected || m.chat_id === initialChatId
          })
          setMessages(validMsgs)
          // Page only if full page returned — otherwise no more older messages
          setHasMoreMessages(validMsgs.length >= 50)
          markWhatsAppChatRead(initialChatId).catch(() => {})
        } catch {
          // Non-fatal: messages will be loaded by effect after sync
        }
      }

      // Step 4: Complete — page to app only after all new messages synced
      setSyncProgress(100)
      setSyncStepText('WhatsApp is synced and ready.')
      setTimeout(() => {
        setSyncStatus('ready')
      }, 400)
    } catch (err) {
      console.error('WhatsApp sync error:', err)
      setSyncStatus('error')
      setSyncError(err.message || 'Server connection failed')
    }
  }

  useEffect(() => {
    let mounted = true
    runFullSync()

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
        setPairingData({
          qr_code: event.qr_code,
          pairing_code: event.pairing_code,
        })
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
                icon: '/favicon.ico',
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
              // 2. If it is from me, replace optimistic pending temp message
              if (incomingMsg.is_from_me) {
                const tempIndex = prev.findIndex(
                  (m) => m.is_optimistic && m.content === incomingMsg.content,
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
  }, [])

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

    // If sync already fetched messages for this chat, don't clear/refetch (avoids flicker after runFullSync)
    if (syncStatus !== 'ready') {
      // During initial sync, runFullSync handles the first chat's messages
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
    // messages intentionally excluded — runFullSync populates first chat before this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId, syncStatus])

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

  const [isQrLoading, setIsQrLoading] = useState(false)

  // Auto-poll status when QR modal is open to detect scan instantly or fetch QR if missing
  useEffect(() => {
    if (!isQrModalOpen || status.connected) return

    const timer = setInterval(async () => {
      try {
        const stat = await fetchWhatsAppStatus()
        if (stat.connected) {
          setStatus(stat)
          setIsQrModalOpen(false)
          const chatList = await fetchWhatsAppChats().catch(() => [])
          setChats(chatList)
          if (chatList.length > 0) setSelectedChatId((curr) => curr || chatList[0].id)
        } else if (!pairingData.qr_code && !pairingData.pairing_code) {
          const pair = await initiateWhatsAppPairing().catch(() => null)
          if (pair?.qr_code || pair?.pairing_code) {
            setPairingData(pair)
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [isQrModalOpen, status.connected, pairingData.qr_code, pairingData.pairing_code])

  const handleOpenQrModal = async () => {
    setIsQrModalOpen(true)
    setIsQrLoading(true)
    try {
      const pair = await initiateWhatsAppPairing()
      setPairingData(pair)
    } catch (err) {
      console.error('Pairing error:', err)
    } finally {
      setIsQrLoading(false)
    }
  }

  const handleRequestPairingCode = async (phoneNumber) => {
    try {
      const pair = await initiateWhatsAppPairing(phoneNumber)
      setPairingData((prev) => ({
        ...prev,
        pairing_code: pair.pairing_code,
        qr_code: pair.qr_code || prev.qr_code,
      }))
      return pair
    } catch (err) {
      console.error('Request pairing code error:', err)
      throw err
    }
  }

  const handleCheckStatus = async () => {
    setIsQrLoading(true)
    try {
      const stat = await fetchWhatsAppStatus()
      setStatus(stat)
      if (stat.connected) {
        setIsQrModalOpen(false)
        const chatList = await fetchWhatsAppChats().catch(() => [])
        setChats(chatList)
        if (chatList.length > 0) setSelectedChatId((curr) => curr || chatList[0].id)
      } else {
        const pair = await initiateWhatsAppPairing()
        setPairingData(pair)
      }
    } catch (err) {
      console.error('Check status error:', err)
    } finally {
      setIsQrLoading(false)
    }
  }

  const _handleConfirmPairing = async (phoneNumber, pushName) => {
    try {
      const updated = await confirmWhatsAppPairing(phoneNumber, pushName)
      setStatus(updated)
      setIsQrModalOpen(false)
      const chatList = await fetchWhatsAppChats()
      setChats(chatList)
      if (chatList.length > 0) setSelectedChatId(chatList[0].id)
    } catch (err) {
      console.error('Confirm pairing error:', err)
    }
  }

  const handleSendMessage = async ({ chatId, content, media, replyToMessageId }) => {
    try {
      // Optimistic update
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
      }
      setMessages((prev) => [...prev, optimisticMsg])

      const sentMsg = await sendWhatsAppMessage({ chatId, content, media, replyToMessageId })
      setMessages((prev) => {
        // If WebSocket already replaced or added the sent message, remove any leftover tempId
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
    // Optimistic update
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

  if (syncStatus === 'syncing') {
    return (
      <div className="whatsapp-sync-loading-container">
        <div className="whatsapp-sync-loading-card">
          <div className="whatsapp-sync-logo-wrapper">
            <MessageSquare size={36} className="whatsapp-sync-logo-icon" />
          </div>
          <h2 className="whatsapp-sync-title">Starwaves WhatsApp</h2>
          <p className="whatsapp-sync-step">{syncStepText}</p>

          <div className="whatsapp-sync-progress-bar-bg">
            <div
              className="whatsapp-sync-progress-bar-fill"
              style={{ width: `${syncProgress}%` }}
            />
          </div>

          <div className="whatsapp-sync-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={13} className="spin" />
              <span>Syncing encrypted session & conversations</span>
            </div>
            <span style={{ fontWeight: 600 }}>{syncProgress}%</span>
          </div>
        </div>
      </div>
    )
  }

  if (syncStatus === 'error') {
    return (
      <div className="whatsapp-sync-loading-container">
        <div className="whatsapp-sync-loading-card is-error">
          <div className="whatsapp-sync-logo-wrapper is-error">
            <WifiOff size={36} />
          </div>
          <h2 className="whatsapp-sync-title">WhatsApp Gateway Unavailable</h2>
          <p className="whatsapp-sync-error-desc">
            {syncError || 'The WhatsApp backend server or worker is currently unreachable.'}
          </p>

          <div className="whatsapp-sync-actions">
            <button
              type="button"
              className="primary-button"
              onClick={runFullSync}
              style={{ minHeight: '40px', padding: '8px 20px', gap: '8px' }}
            >
              <RefreshCw size={16} /> Retry Synchronization
            </button>
          </div>
        </div>
      </div>
    )
  }

  const selectedChat = chats.find((c) => c.id === selectedChatId)

  return (
    <>
      <div className="whatsapp-page">
        {/* Chat List Sidebar */}
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

        {/* Conversation View */}
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
          <div className="whatsapp-main-empty">
            <div className="whatsapp-empty-badge-icon">
              <MessageSquare size={28} strokeWidth={1.75} />
            </div>

            <h3 className="whatsapp-empty-title">
              {status.connected ? 'Select a conversation' : 'WhatsApp is not connected'}
            </h3>

            <p className="whatsapp-empty-lead">
              {status.connected
                ? 'Choose a chat from the sidebar to view and send messages.'
                : 'Link your device to start sending and receiving messages in Starwaves.'}
            </p>

            {!status.connected && (
              <div className="whatsapp-empty-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleOpenQrModal}
                >
                  <QrCode size={16} /> Link WhatsApp Account
                </button>
              </div>
            )}
          </div>
        )}

        {/* Info Drawer */}
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

      {/* QR Pairing Modal */}
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

      {/* Interactive Summary & Eve Chat Modal */}
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
