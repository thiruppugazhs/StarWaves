import { useState } from 'react'
import { Brain, Plus, Trash2 } from 'lucide-react'
import { EmptyState, LoadingState, SearchBar } from '../../components/ui'

export function EveMemorySection({
  memories,
  isLoading,
  onAddMemory,
  onRemoveMemory,
  memoryDraft,
  setMemoryDraft,
  isAddingMemory,
  isSending,
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredMemories = memories.filter((memory) => {
    if (!searchQuery.trim()) return true
    return (memory.content || '').toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <section className="eve-subpage-section" aria-label="Eve Memory">
      <div className="eve-subpage-header">
        <div>
          <h2>Eve Memory</h2>
          <p>
            Facts, preferences, and workspace rules Eve remembers about you across chat sessions and voice calls.
          </p>
        </div>
      </div>

      <div className="eve-memory-composer-card">
        <h3>
          <Brain size={16} />
          <span>Teach Eve a Fact or Instruction</span>
        </h3>
        <p>
          Eve references these facts to personalize responses, recall project context, and adapt to your preferences.
        </p>

        <form className="eve-memory-create-form" onSubmit={onAddMemory}>
          <textarea
            value={memoryDraft}
            onChange={(e) => setMemoryDraft(e.target.value)}
            placeholder="e.g. I prefer concise technical summaries. My primary tech stack is React and Python FastAPI."
            rows={2}
            maxLength={500}
            aria-label="New memory fact"
            required
          />
          <div className="eve-memory-form-footer">
            <span className="eve-char-counter">{memoryDraft.length} / 500 characters</span>
            <button
              type="submit"
              className="primary-button"
              disabled={!memoryDraft.trim() || isAddingMemory}
            >
              <Plus size={14} />
              <span>{isAddingMemory ? 'Remembering…' : 'Remember Fact'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="eve-sessions-toolbar">
        <SearchBar
          className="eve-search-field"
          placeholder="Search remembered facts…"
          ariaLabel="Search remembered facts"
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <span className="eve-sessions-count">
          {filteredMemories.length} {filteredMemories.length === 1 ? 'memory' : 'memories'}
        </span>
      </div>

      {isLoading ? (
        <LoadingState message="Loading remembered facts…" />
      ) : filteredMemories.length === 0 ? (
        <EmptyState
          icon={Brain}
          title={searchQuery ? 'No matching memories' : 'No memories saved yet'}
          description={
            searchQuery
              ? 'Try searching with different terms.'
              : 'Add a fact above, or simply tell Eve to “remember that…” during chat.'
          }
        />
      ) : (
        <div className="eve-memory-grid" role="list">
          {filteredMemories.map((memory) => (
            <div key={memory.id} className="eve-memory-card" role="listitem">
              <div className="eve-memory-card-header">
                <span className="eve-memory-tag">Fact</span>
              </div>
              <p className="eve-memory-card-text">{memory.content}</p>
              {memory.created_at && (
                <time className="eve-memory-card-time">
                  {new Date(memory.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>
              )}
              <button
                type="button"
                className="eve-card-delete-btn"
                onClick={() => onRemoveMemory(memory.id)}
                disabled={isSending}
                aria-label="Delete this memory"
                title="Delete memory"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
