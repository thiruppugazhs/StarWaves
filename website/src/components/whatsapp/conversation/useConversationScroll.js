/** Scroll hook — single responsibility: feed scroll, pagination and outside-click handling. */
import { useEffect } from 'react'

export function useConversationScroll({
  chatId,
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
}) {
  useEffect(() => {
    initialScrollDoneRef.current = false
    previousScrollHeightRef.current = null
    isFetchingMoreRef.current = false
  }, [chatId, initialScrollDoneRef, isFetchingMoreRef, previousScrollHeightRef])

  useEffect(() => {
    if (!isLoadingMore) {
      isFetchingMoreRef.current = false
    }
  }, [isLoadingMore, isFetchingMoreRef])

  useEffect(() => {
    if (previousScrollHeightRef.current === null && !isSearchOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: initialScrollDoneRef.current ? 'smooth' : 'auto' })
      initialScrollDoneRef.current = true
    }
  }, [messages, isSearchOpen, initialScrollDoneRef, messagesEndRef, previousScrollHeightRef])

  useEffect(() => {
    if (previousScrollHeightRef.current !== null && messagesFeedRef.current) {
      const newScrollHeight = messagesFeedRef.current.scrollHeight
      const diff = newScrollHeight - previousScrollHeightRef.current
      if (diff > 0) {
        messagesFeedRef.current.scrollTop += diff
      }
      previousScrollHeightRef.current = null
      isFetchingMoreRef.current = false
    }
  }, [messages, isFetchingMoreRef, messagesFeedRef, previousScrollHeightRef])

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuMessageId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuRef, setActiveMenuMessageId])

  const handleFeedScroll = (e) => {
    const { scrollTop, scrollHeight } = e.currentTarget
    if (
      scrollTop < 150 &&
      hasMoreMessages &&
      !isLoadingMore &&
      !isFetchingMoreRef.current &&
      messages.length > 0
    ) {
      isFetchingMoreRef.current = true
      previousScrollHeightRef.current = scrollHeight
      onLoadMoreMessages?.()
    }
  }

  return { handleFeedScroll }
}
