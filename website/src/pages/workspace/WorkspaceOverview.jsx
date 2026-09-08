import '../../styles/pages/workspace-overview.css'
import { useMemo, useState } from 'react'
import {
  Clock3,
  Edit2,
  FileText,
  Folder,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react'
import { EmptyState, LoadingState, SearchBar } from '../../components/ui'

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function WorkspaceOverview({
  workspaces = [],
  activeWorkspaceId,
  loading,
  onOpenWorkspace,
  onOpenCreateWorkspace,
  onOpenRenameWorkspace,
  onOpenDeleteWorkspace,
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredWorkspaces = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return workspaces

    return workspaces.filter((workspace) =>
      [workspace.name, workspace.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    )
  }, [searchQuery, workspaces])

  if (loading && workspaces.length === 0) {
    return (
      <div className="ws-overview">
        <LoadingState message="Loading workspaces…" />
      </div>
    )
  }

  return (
    <div className="ws-overview">
      <header className="ws-overview-header">
        <h2>Workspaces</h2>
        <SearchBar
          className="ws-overview-search"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search workspaces"
          ariaLabel="Search workspaces"
        />
      </header>

      {workspaces.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No workspaces yet"
          description="Create your first workspace to start coding — files, folders and Eve coding tools live inside."
          action={
            <button type="button" className="primary-button" onClick={onOpenCreateWorkspace}>
              <Plus size={15} /> New workspace
            </button>
          }
        />
      ) : filteredWorkspaces.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No matching workspaces"
          description="Try a different workspace name or ID."
          action={
            <button type="button" className="secondary-button" onClick={() => setSearchQuery('')}>
              Clear search
            </button>
          }
        />
      ) : (
        <div className="ws-overview-grid">
          {filteredWorkspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId
            const updated = formatDate(ws.updated_at)
            return (
              <div key={ws.id} className={`ws-card${isActive ? ' active' : ''}`}>
                <button
                  type="button"
                  className="ws-card-open"
                  onClick={() => onOpenWorkspace(ws)}
                  aria-label={`Open workspace ${ws.name}`}
                >
                  <span className="ws-card-avatar">{ws.name?.trim()?.[0]?.toUpperCase() || <Folder size={16} />}</span>
                  <span className="ws-card-name">{ws.name}</span>
                  <span className="ws-card-meta">
                    <span className="ws-card-count">
                      <FileText size={12} />
                      {ws.file_count ?? 0} {(ws.file_count ?? 0) === 1 ? 'file' : 'files'}
                    </span>
                    {updated && (
                      <span className="ws-card-updated">
                        <Clock3 size={12} />
                        {updated}
                      </span>
                    )}
                  </span>
                </button>
                <div className="ws-card-actions">
                  <button
                    type="button"
                    onClick={() => onOpenRenameWorkspace(ws)}
                    aria-label={`Rename ${ws.name}`}
                    title="Rename workspace"
                  >
                    <Edit2 size={13} />
                  </button>
                  {workspaces.length > 1 && (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => onOpenDeleteWorkspace(ws)}
                      aria-label={`Delete ${ws.name}`}
                      title="Delete workspace"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                {isActive && <span className="ws-card-flag"><Layers size={11} /> Recent</span>}
              </div>
            )
          })}

          <button type="button" className="ws-card ws-card-create" onClick={onOpenCreateWorkspace}>
            <span className="ws-card-plus"><Plus size={18} /></span>
            <span className="ws-card-name">New workspace</span>
            <span className="ws-card-meta">Isolated folder · like a project root</span>
          </button>
        </div>
      )}
    </div>
  )
}
