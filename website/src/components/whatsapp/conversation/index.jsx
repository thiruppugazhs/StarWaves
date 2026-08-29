/** WhatsAppConversation — single responsibility: compose conversation UI from feature subcomponents. */
import { useRef, useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { WhatsAppConversationHeader } from './WhatsAppConversationHeader'
import { WhatsAppMessagesFeed } from './WhatsAppMessagesFeed'
import { WhatsAppComposer } from './WhatsAppComposer'
import { WhatsAppModals } from './WhatsAppModals'
import { useParticipantInfo } from './useParticipantInfo'
import { useConversationScroll } from './useConversationScroll'

export function WhatsAppConversation({
  chat,
  allChats = [],
  messages = [],
  hasMoreMessages = false,
  isLoadingMore = false,
  onLoadMoreMessages,
  onSendMessage,
  onOpenInfoDrawer,
  onGenerateEveDraft,
  onSummarizeChat,
  onReactToMessage,
  onStarMessage,
  onDeleteMessage,
  isDrafting = false,
  isSummarizing = false,
  isTyping = false,
  typingText = '',
}) {
  const [inputText, setInputText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [playingAudioId, setPlayingAudioId] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [hoveredMessageId, setHoveredMessageId] = useState(null)
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null)
  const [menuPlacement, setMenuPlacement] = useState('bottom')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [inChatSearchQuery, setInChatSearchQuery] = useState('')
  const [copiedToast, setCopiedToast] = useState(false)
  const [infoModalMessage, setInfoModalMessage] = useState(null)
  const [activeLightboxMedia, setActiveLightboxMedia] = useState(null)
  const [reactionModalData, setReactionModalData] = useState(null)
  const [selectedReactionTab, setSelectedReactionTab] = useState('all')

  const messagesEndRef = useRef(null)
  const messagesFeedRef = useRef(null)
  const isFetchingMoreRef = useRef(false)
  const previousScrollHeightRef = useRef(null)
  const initialScrollDoneRef = useRef(false)
  const fileInputRef = useRef(null)
  const menuRef = useRef(null)

  const isEve = chat?.is_eve || chat?.id === 'eve'

  const { resolveReactionSender, formatParticipantsSubtitle } = useParticipantInfo({ chat, allChats, messages })

  const { handleFeedScroll } = useConversationScroll({
    chatId: chat?.id,
    messages,
    isSearchOpen,
    isLoadingMore,
    hasMoreMessages,
    onLoadMoreMessages,
    messagesEndRef,
    messagesFeedRef,
    isFetchingMoreRef,
    previousScrollHeightRef,
    initialScrollDoneRef,
    menuRef,
    setActiveMenuMessageId,
  })

  const displayedMessages = useMemo(() => {
    const cleanCurrentChat = chat?.id?.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
    const chatMsgs = (messages || []).filter((m) => {
      if (!m.chat_id || !cleanCurrentChat) return true
      const cleanMsg = m.chat_id.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
      return cleanMsg === cleanCurrentChat || m.chat_id === chat?.id
    })
    const filtered = !inChatSearchQuery.trim()
      ? chatMsgs
      : chatMsgs.filter(
          (m) => m.content?.toLowerCase().includes(inChatSearchQuery.toLowerCase()) || m.sender_name?.toLowerCase().includes(inChatSearchQuery.toLowerCase()),
        )
    return [...filtered].sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
  }, [messages, inChatSearchQuery, chat?.id])

  const handleSend = (e) => {
    e?.preventDefault()
    if (!inputText.trim()) return
    onSendMessage({
      chatId: chat.id,
      content: inputText.trim(),
      replyToMessageId: replyingTo?.id || null,
    })
    setInputText('')
    setReplyingTo(null)
    setShowEmojiPicker(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSimulateVoiceNote = () => {
    if (isRecording) {
      setIsRecording(false)
      onSendMessage({
        chatId: chat.id,
        content: 'Voice note (0:08)',
        replyToMessageId: replyingTo?.id || null,
        media: { type: 'audio', url: '', duration_seconds: 8.0, filename: 'voice_note.ogg' },
      })
      setReplyingTo(null)
    } else {
      setIsRecording(true)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isImg = file.type.startsWith('image/')
    const reader = new FileReader()
    reader.onload = (uploadEvent) => {
      onSendMessage({
        chatId: chat.id,
        content: file.name,
        replyToMessageId: replyingTo?.id || null,
        media: {
          type: isImg ? 'image' : 'document',
          url: uploadEvent.target.result,
          filename: file.name,
          file_size_bytes: file.size,
          mimetype: file.type,
        },
      })
      setReplyingTo(null)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content)
    setCopiedToast(true)
    setTimeout(() => setCopiedToast(false), 2000)
    setActiveMenuMessageId(null)
  }

  const handleAskEveAboutMessage = (msg) => {
    setInputText(`@eve What does this mean or what actions are needed? "${msg.content}"`)
    setActiveMenuMessageId(null)
  }

  const handleForwardMessage = (msg) => {
    setInputText(`Forwarded: ${msg.content}`)
    setCopiedToast('Message copied to composer for forwarding')
    setTimeout(() => setCopiedToast(false), 2000)
    setActiveMenuMessageId(null)
  }

  const handlePinToggle = (msg) => {
    setCopiedToast(msg.is_pinned ? 'Message unpinned' : 'Message pinned')
    setTimeout(() => setCopiedToast(false), 2000)
    setActiveMenuMessageId(null)
  }

  const handleDownloadMedia = (media, defaultName = 'download') => {
    if (!media) return
    const rawUrl = media.url || media.thumbnail_base64
    if (!rawUrl) return
    let rawFilename = media.filename || defaultName
    rawFilename = rawFilename.replace(/\.enc$/i, '')
    if (!rawFilename.includes('.')) {
      if (media.type === 'image') rawFilename += '.jpg'
      else if (media.type === 'video') rawFilename += '.mp4'
      else if (media.type === 'audio') rawFilename += '.ogg'
      else if (media.mimetype?.includes('pdf')) rawFilename += '.pdf'
      else if (media.mimetype?.includes('png')) rawFilename += '.png'
      else if (media.mimetype?.includes('jpeg') || media.mimetype?.includes('jpg')) rawFilename += '.jpg'
    }
    if (rawUrl.startsWith('data:')) {
      const link = document.createElement('a')
      link.href = rawUrl
      link.download = rawFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      window.open(rawUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="whatsapp-main">
      {copiedToast && <div className="whatsapp-toast">{typeof copiedToast === 'string' ? copiedToast : 'Copied to clipboard'}</div>}

      <WhatsAppConversationHeader
        chat={chat}
        isEve={isEve}
        isTyping={isTyping}
        typingText={typingText}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        setInChatSearchQuery={setInChatSearchQuery}
        isSummarizing={isSummarizing}
        onOpenInfoDrawer={onOpenInfoDrawer}
        onSummarizeChat={onSummarizeChat}
        formatParticipantsSubtitle={formatParticipantsSubtitle}
      />

      {isSearchOpen && (
        <div className="whatsapp-inchat-search-bar">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Search in this conversation..." value={inChatSearchQuery} onChange={(e) => setInChatSearchQuery(e.target.value)} autoFocus />
          {inChatSearchQuery && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {displayedMessages.length} match{displayedMessages.length !== 1 ? 'es' : ''}
            </span>
          )}
          <button
            type="button"
            className="whatsapp-icon-btn small"
            onClick={() => {
              setIsSearchOpen(false)
              setInChatSearchQuery('')
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <WhatsAppMessagesFeed
        chat={chat}
        isEve={isEve}
        isTyping={isTyping}
        hasMoreMessages={hasMoreMessages}
        isLoadingMore={isLoadingMore}
        displayedMessages={displayedMessages}
        messages={messages}
        hoveredMessageId={hoveredMessageId}
        setHoveredMessageId={setHoveredMessageId}
        activeMenuMessageId={activeMenuMessageId}
        setActiveMenuMessageId={setActiveMenuMessageId}
        menuPlacement={menuPlacement}
        setMenuPlacement={setMenuPlacement}
        menuRef={menuRef}
        playingAudioId={playingAudioId}
        setPlayingAudioId={setPlayingAudioId}
        messagesFeedRef={messagesFeedRef}
        messagesEndRef={messagesEndRef}
        handleFeedScroll={handleFeedScroll}
        onLoadMoreMessages={onLoadMoreMessages}
        onReactToMessage={onReactToMessage}
        onStarMessage={onStarMessage}
        onDeleteMessage={onDeleteMessage}
        onSetReplyingTo={setReplyingTo}
        onCopyMessage={handleCopyMessage}
        onAskEveAboutMessage={handleAskEveAboutMessage}
        onForwardMessage={handleForwardMessage}
        onPinToggle={handlePinToggle}
        onSetInfoModalMessage={setInfoModalMessage}
        onSetActiveLightboxMedia={setActiveLightboxMedia}
        onSetReactionModalData={setReactionModalData}
        onSetSelectedReactionTab={setSelectedReactionTab}
        resolveReactionSender={resolveReactionSender}
        onDownloadMedia={handleDownloadMedia}
        previousScrollHeightRef={previousScrollHeightRef}
      />

      <WhatsAppComposer
        chat={chat}
        isEve={isEve}
        isRecording={isRecording}
        inputText={inputText}
        setInputText={setInputText}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        isDrafting={isDrafting}
        fileInputRef={fileInputRef}
        onSendMessage={onSendMessage}
        onGenerateEveDraft={onGenerateEveDraft}
        handleSend={handleSend}
        handleKeyDown={handleKeyDown}
        handleFileUpload={handleFileUpload}
        handleSimulateVoiceNote={handleSimulateVoiceNote}
      />

      <WhatsAppModals
        infoModalMessage={infoModalMessage}
        setInfoModalMessage={setInfoModalMessage}
        activeLightboxMedia={activeLightboxMedia}
        setActiveLightboxMedia={setActiveLightboxMedia}
        reactionModalData={reactionModalData}
        setReactionModalData={setReactionModalData}
        selectedReactionTab={selectedReactionTab}
        setSelectedReactionTab={setSelectedReactionTab}
        resolveReactionSender={resolveReactionSender}
        handleDownloadMedia={handleDownloadMedia}
      />
    </div>
  )
}
