/** Composer — single responsibility: message input, attachments and voice. */
import { Mic, Paperclip, Send, Smile, Square, X } from 'lucide-react'
import { Bot } from 'lucide-react'
import { Sparkles } from 'lucide-react'

export function WhatsAppComposer({
  chat,
  isEve,
  isRecording,
  inputText,
  setInputText,
  replyingTo,
  setReplyingTo,
  showEmojiPicker,
  setShowEmojiPicker,
  isDrafting,
  fileInputRef,
  onSendMessage,
  onGenerateEveDraft,
  handleSend,
  handleKeyDown,
  handleFileUpload,
  handleSimulateVoiceNote,
}) {
  const handleApplyEveDraft = async () => {
    if (onGenerateEveDraft) {
      const draft = await onGenerateEveDraft(chat.id)
      if (draft) setInputText(draft)
    }
  }

  return (
    <>
      {!isEve && (
        <div className="whatsapp-eve-prompt-bar">
          <div className="whatsapp-eve-prompt-label">
            <Bot size={16} />
            <span>Need assistance responding?</span>
          </div>
          <button type="button" className="whatsapp-eve-btn" onClick={handleApplyEveDraft} disabled={isDrafting}>
            <Sparkles size={12} />
            {isDrafting ? 'Drafting reply...' : 'Ask Eve to draft reply'}
          </button>
        </div>
      )}

      {replyingTo && (
        <div className="whatsapp-replying-banner">
          <div className="whatsapp-replying-content">
            <span className="whatsapp-replying-title">Replying to {replyingTo.is_from_me ? 'yourself' : replyingTo.sender_name || 'Contact'}</span>
            <p className="whatsapp-replying-text">
              {replyingTo.media && !replyingTo.content ? (
                <span className="whatsapp-quoted-media-tag">
                  {replyingTo.media.type === 'video'
                    ? '🎥 Video'
                    : replyingTo.media.type === 'audio'
                      ? '🎵 Audio'
                      : replyingTo.media.type === 'document'
                        ? `📄 ${replyingTo.media.filename || 'Document'}`
                        : '📷 Photo'}
                </span>
              ) : replyingTo.media && replyingTo.content ? (
                <span>
                  <span className="whatsapp-quoted-media-tag">
                    {replyingTo.media.type === 'video' ? '🎥 ' : replyingTo.media.type === 'audio' ? '🎵 ' : replyingTo.media.type === 'document' ? '📄 ' : '📷 '}
                  </span>
                  {replyingTo.content}
                </span>
              ) : (
                replyingTo.content || 'Message'
              )}
            </p>
          </div>
          {replyingTo.media && (replyingTo.media.url || replyingTo.media.thumbnail_base64) && (
            <div className="whatsapp-quoted-thumb-wrapper whatsapp-quoted-thumb-wrapper--spaced">
              <img src={replyingTo.media.url || replyingTo.media.thumbnail_base64} alt="Attachment preview" className="whatsapp-quoted-thumb" />
            </div>
          )}
          <button type="button" className="whatsapp-icon-btn small" onClick={() => setReplyingTo(null)} title="Cancel reply">
            <X size={14} />
          </button>
        </div>
      )}

      {showEmojiPicker && (
        <div className="whatsapp-media-tray">
          <div className="whatsapp-media-tray-tabs">
            <span className="whatsapp-media-tray-title">Quick Select</span>
          </div>
          <div className="whatsapp-media-tray-emojis">
            {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '😊', '🚀', '✅', '💯', '✨', '👏', '🤝', '💡', '📌', '⚡'].map((emoji) => (
              <button key={emoji} type="button" className="whatsapp-emoji-btn" onClick={() => setInputText((prev) => prev + emoji)}>
                {emoji}
              </button>
            ))}
          </div>
          <div className="whatsapp-media-tray-stickers">
            <span className="whatsapp-tray-label">Quick Mentions / Tags</span>
            <div className="whatsapp-tray-row">
              {['@eve', '@susindran', '@susin', '@mynumber', '@myjid'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="whatsapp-quick-tag-btn"
                  onClick={() => setInputText((prev) => (prev ? `${prev.trim()} ${tag} ` : `${tag} `))}
                  title={`Insert ${tag}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="whatsapp-media-tray-stickers">
            <span className="whatsapp-tray-label">Quick Stickers / Expressions</span>
            <div className="whatsapp-tray-row">
              {['🤖', '🌟', '🎯', '💫', '🪄', '💎', '🚀', '🛡️'].map((stk) => (
                <button
                  key={stk}
                  type="button"
                  className="whatsapp-sticker-btn"
                  onClick={() => {
                    onSendMessage({
                      chatId: chat.id,
                      content: stk,
                      replyToMessageId: replyingTo?.id || null,
                      media: { type: 'sticker', filename: `sticker_${stk}.png` },
                    })
                    setShowEmojiPicker(false)
                  }}
                  title="Send as sticker"
                >
                  {stk}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <form className="whatsapp-composer" onSubmit={handleSend}>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="whatsapp-composer-file-input" />
        <button type="button" className="whatsapp-icon-btn" onClick={() => setShowEmojiPicker((prev) => !prev)} title="Emojis" aria-label="Toggle emoji picker">
          <Smile size={18} />
        </button>
        <button type="button" className="whatsapp-icon-btn" onClick={() => fileInputRef.current?.click()} title="Attach media or document" aria-label="Attach media or document">
          <Paperclip size={18} />
        </button>
        <input
          type="text"
          className="whatsapp-composer-input"
          placeholder={isRecording ? 'Recording voice note...' : isEve ? 'Message Eve or request workspace actions...' : 'Type a message...'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRecording}
        />
        <button
          type="button"
          className={`whatsapp-icon-btn ${isRecording ? 'recording whatsapp-icon-btn--recording' : ''}`}
          onClick={handleSimulateVoiceNote}
          title={isRecording ? 'Stop & send voice note' : 'Record voice note'}
          aria-label={isRecording ? 'Stop recording' : 'Record voice note'}
        >
          {isRecording ? <Square size={16} /> : <Mic size={18} />}
        </button>
        <button type="submit" className="whatsapp-send-btn" disabled={!inputText.trim()} title="Send message">
          <Send size={16} />
        </button>
      </form>
    </>
  )
}
