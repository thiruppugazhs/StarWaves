import { useState } from 'react'
import { ArrowRight, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { EmptyState, LoadingState, SearchBar } from '../../components/ui'

export function EveSessionsSection({
  sessions,
  activeSessionId,
  isLoading,
  onResumeSession,
  onRemoveSession,
  onStartNewChat,
  isSending,
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSessions = sessions.filter((session) => {
    if (!searchQuery.trim()) return true
    const term = searchQuery.toLowerCase()
    return (
      (session.title || '').toLowerCase().includes(term) ||
      (session.preview || '').toLowerCase().includes(term)
    )
  })

  return (
    <section className="eve-subpage-section" aria-label="Eve Chat Sessions">
      <div className="eve-subpage-header">
        <div>
          <h2>Chat Sessions</h2>
          <p>Browse, resume, or manage all your past conversations with Eve.</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={onStartNewChat}
          disabled={isSending}
        >
          <Plus size={14} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="eve-sessions-toolbar">
        <SearchBar
          className="eve-search-field"
          placeholder="Search conversations by topic or message…"
          ariaLabel="Search conversations"
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <span className="eve-sessions-count">
          {filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      {isLoading ? (
        <LoadingState message="Loading past conversations…" />
      ) : filteredSessions.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={searchQuery ? 'No matching conversations' : 'No saved conversations'}
          description={
            searchQuery
              ? 'Try searching with different keywords.'
              : 'Every conversation you have with Eve is saved automatically here.'
          }
          action={
            !searchQuery ? (
              <button
                type="button"
                className="primary-button"
                onClick={onStartNewChat}
                disabled={isSending}
              >
                <Plus size={14} />
                <span>Start New Chat</span>
              </button>
            ) : null
          }
        />
      ) : (
        <div className="eve-sessions-grid" role="list">
          {filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId
            return (
              <div
                key={session.id}
                className={`eve-session-card ${isActive ? 'active' : ''}`}
              >
                <div className="eve-session-card-header">
                  <div className="eve-session-badge">
                    <MessageSquare size={13} />
                    <span>{isActive ? 'Current Chat' : 'Saved Chat'}</span>
                  </div>
                  <button
                    type="button"
                    className="eve-card-delete-btn"
                    onClick={() => onRemoveSession(session.id)}
                    disabled={isSending}
                    aria-label={`Delete conversation ${session.title}`}
                    title="Delete conversation"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <h3 className="eve-session-card-title">{session.title}</h3>
                <p className="eve-session-card-preview">
                  {session.preview || 'No preview available'}
                </p>

                {session.updated_at && (
                  <time className="eve-session-card-time">
                    Updated {new Date(session.updated_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                )}

                <div className="eve-session-card-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onResumeSession(session)}
                    disabled={isSending}
                  >
                    <span>{isActive ? 'Continue Conversation' : 'Resume Chat'}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
