import { Plus, X } from 'lucide-react'

export function EveModalSessions({
  sessions,
  activeSessionId,
  isLoadingSessions,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}) {
  return (
    <div className="eve-sessions-bar" aria-label="Eve conversations">
      <button
        className={`eve-session-new ${activeSessionId === null ? 'active' : ''}`}
        type="button"
        onClick={onNewChat}
        aria-pressed={activeSessionId === null}
      >
        <Plus size={14} />
        <span>New chat</span>
      </button>
      <div className="eve-session-tabs" role="tablist" aria-label="Saved Eve conversations">
        {isLoadingSessions ? (
          <span className="eve-session-loading">Loading conversations…</span>
        ) : (
          sessions.map((session) => (
            <div
              className={`eve-session-tab ${session.id === activeSessionId ? 'active' : ''}`}
              key={session.id}
            >
              <button
                className="eve-session-tab-select"
                type="button"
                role="tab"
                aria-selected={session.id === activeSessionId}
                onClick={() => onSelectSession(session.id)}
                title={session.title}
              >
                <span>{session.title}</span>
              </button>
              <button
                className="eve-session-tab-delete"
                type="button"
                onClick={() => onDeleteSession(session)}
                aria-label={`Delete conversation ${session.title}`}
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
