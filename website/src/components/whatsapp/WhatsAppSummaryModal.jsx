import { useState, useRef, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Markdown } from '../ui/Markdown'
import {
  Bot,
  Sparkles,
  Send,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  MessageSquare,
  FileText,
} from 'lucide-react'
import { chatAboutWhatsAppSummary } from '../../lib/whatsappApi'

const QUICK_SUGGESTIONS = [
  '📝 Who has action items?',
  '📅 List all dates and deadlines',
  '✍️ Draft a polite reply to this conversation',
  '💡 Key takeaways in 2 sentences',
]

export function WhatsAppSummaryModal({
  isOpen,
  onClose,
  summary,
  chatId,
  chatName,
}) {
  const [chatMessages, setChatMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'summary' | 'chat'
  const [copied, setCopied] = useState(false)

  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  // Reset chat thread when modal opens or summary changes
  useEffect(() => {
    if (isOpen) {
      setChatMessages([])
      setInputText('')
      setIsLoading(false)
      setIsSummaryCollapsed(false)
      setActiveTab('all')
      setCopied(false)
    }
  }, [isOpen, chatId, summary])

  // Scroll chat messages to bottom
  useEffect(() => {
    if (chatMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, isLoading])

  const handleCopySummary = async () => {
    if (!summary) return
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleSendMessage = async (textToSend) => {
    const text = (typeof textToSend === 'string' ? textToSend : inputText).trim()
    if (!text || isLoading || !chatId) return

    const userMsg = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const updatedHistory = [...chatMessages, userMsg]
    setChatMessages(updatedHistory)
    setInputText('')
    setIsLoading(true)

    // Auto-collapse top summary if viewing in unified mode so chat is front and center
    if (activeTab === 'all' && !isSummaryCollapsed) {
      setIsSummaryCollapsed(true)
    }

    try {
      const response = await chatAboutWhatsAppSummary({
        chatId,
        summary: summary || '',
        messages: updatedHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      })

      const assistantMsg = {
        role: 'assistant',
        content: response?.reply || 'I processed the conversation context but could not form a response.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setChatMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error answering your question: ${err.message || err}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearChat = () => {
    setChatMessages([])
    setIsSummaryCollapsed(false)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Eve Conversation Summary & Chat"
      subtitle={`AI insights and interactive discussion for ${chatName || 'this chat'}`}
      className="whatsapp-summary-modal"
    >
      <div className="whatsapp-summary-container">
        {/* Navigation Tabs Header */}
        <div className="whatsapp-summary-nav-tabs">
          <div className="whatsapp-summary-tab-group">
            <button
              type="button"
              className={`whatsapp-summary-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <Sparkles size={14} />
              Summary & Chat
            </button>
            <button
              type="button"
              className={`whatsapp-summary-tab ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              <FileText size={14} />
              Summary Only
            </button>
            <button
              type="button"
              className={`whatsapp-summary-tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={14} />
              Chat with Eve {chatMessages.length > 0 ? `(${chatMessages.length})` : ''}
            </button>
          </div>

          <div className="whatsapp-summary-actions">
            <button
              type="button"
              className="whatsapp-summary-action-btn"
              onClick={handleCopySummary}
              title="Copy summary text"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            {chatMessages.length > 0 && (
              <button
                type="button"
                className="whatsapp-summary-action-btn"
                onClick={handleClearChat}
                title="Reset conversation thread"
              >
                <RotateCcw size={14} />
                <span>Reset Chat</span>
              </button>
            )}
          </div>
        </div>

        {/* Top Summary Card (Shown in 'all' and 'summary' modes) */}
        {(activeTab === 'all' || activeTab === 'summary') && (
          <div className={`whatsapp-summary-card ${isSummaryCollapsed && activeTab === 'all' ? 'is-collapsed' : ''}`}>
            <div
              className="whatsapp-summary-card-header"
              onClick={() => {
                if (activeTab === 'all') {
                  setIsSummaryCollapsed((prev) => !prev)
                }
              }}
              style={activeTab === 'all' ? { cursor: 'pointer' } : {}}
            >
              <div className="whatsapp-summary-card-title">
                <Sparkles size={15} />
                <span>Key Points & Action Items</span>
              </div>
              {activeTab === 'all' && (
                <button
                  type="button"
                  className="whatsapp-summary-collapse-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsSummaryCollapsed((prev) => !prev)
                  }}
                  title={isSummaryCollapsed ? 'Expand summary' : 'Collapse summary'}
                >
                  {isSummaryCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              )}
            </div>

            {(!isSummaryCollapsed || activeTab === 'summary') && (
              <div className="whatsapp-summary-text-body">
                <Markdown content={summary || 'No summary available for this conversation.'} />
              </div>
            )}
          </div>
        )}

        {/* Interactive Chat Section (Shown in 'all' and 'chat' modes) */}
        {(activeTab === 'all' || activeTab === 'chat') && (
          <div className="whatsapp-summary-chat-section">
            {/* Quick Suggestions Chips */}
            {chatMessages.length === 0 && (
              <div className="whatsapp-summary-suggestions">
                <span className="whatsapp-summary-suggestions-title">Ask Eve about this chat:</span>
                <div className="whatsapp-summary-chips-list">
                  {QUICK_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="whatsapp-summary-chip"
                      onClick={() => handleSendMessage(item.replace(/^[\p{Emoji}\s]+/u, ''))}
                      disabled={isLoading}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Messages Feed */}
            <div className="whatsapp-summary-chat-feed">
              {chatMessages.length === 0 && activeTab === 'chat' && (
                <div className="whatsapp-summary-empty-chat">
                  <div className="whatsapp-summary-empty-icon">
                    <Bot size={24} />
                  </div>
                  <p className="whatsapp-summary-empty-title">Ask Eve Anything About This Chat</p>
                  <p className="whatsapp-summary-empty-desc">
                    Eve has read the full conversation history and summary. Ask to draft replies, clarify details, or track follow-up tasks.
                  </p>
                </div>
              )}

              {chatMessages.map((msg, idx) => {
                const isUser = msg.role === 'user'
                return (
                  <div
                    key={idx}
                    className={`whatsapp-summary-msg-row ${isUser ? 'is-user' : 'is-assistant'}`}
                  >
                    {!isUser && (
                      <div className="whatsapp-summary-bot-avatar">
                        <Bot size={16} />
                      </div>
                    )}
                    <div className="whatsapp-summary-msg-bubble">
                      <div className="whatsapp-summary-msg-text">
                        <Markdown content={msg.content} />
                      </div>
                      <div className="whatsapp-summary-msg-meta">
                        <span>{msg.timestamp}</span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {isLoading && (
                <div className="whatsapp-summary-msg-row is-assistant">
                  <div className="whatsapp-summary-bot-avatar">
                    <Bot size={16} />
                  </div>
                  <div className="whatsapp-summary-msg-bubble is-loading">
                    <div className="whatsapp-summary-typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Bottom Composer Input */}
            <div className="whatsapp-summary-composer">
              <input
                ref={inputRef}
                type="text"
                className="whatsapp-summary-input"
                placeholder="Ask Eve a question or give an instruction..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button
                type="button"
                className="whatsapp-summary-send-btn"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isLoading}
                title="Send to Eve (Enter)"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="whatsapp-summary-footer">
          <span className="whatsapp-summary-footer-hint">
            Press <kbd>Enter</kbd> to ask Eve • Responses grounded in conversation history
          </span>
          <button
            type="button"
            className="primary-button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
