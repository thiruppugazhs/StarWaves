import { useEffect, useRef, useState } from 'react'
import {
  FolderOpen,
  Folder,
  RefreshCw,
  Cloud,
  Globe,
  Monitor,
  Terminal,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  Edit2,
  FilePlus,
  FolderPlus,
  Layers,
} from 'lucide-react'

export function WorkspaceToolbar({
  workspaces = [],
  activeWorkspace,
  onSwitchWorkspace,
  onOpenCreateWorkspace,
  onOpenRenameWorkspace,
  onOpenDeleteWorkspace,
  isTauri,
  loading,
  onRefresh,
  terminalVisible,
  onToggleTerminal,
  browserVisible,
  onToggleBrowser,
  onCreateFile,
  onCreateFolder,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const fileCountLabel = `${activeWorkspace?.file_count ?? 0} ${activeWorkspace?.file_count === 1 ? 'file' : 'files'}`

  return (
    <div className="workspace-toolbar-v2">
      <div className="workspace-toolbar-left">
        <div className="workspace-selector-container" ref={dropdownRef}>
          <button
            type="button"
            className="workspace-selector-trigger-v2"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
            title="Switch workspace"
          >
            <span className="workspace-avatar">
              {activeWorkspace?.name?.trim()?.[0]?.toUpperCase() || <Folder size={14} />}
            </span>
            <span className="workspace-trigger-text">
              <span className="workspace-trigger-name">{activeWorkspace?.name || 'Default Workspace'}</span>
              <span className="workspace-trigger-meta">
                <Folder size={11} /> Folder · {fileCountLabel}
              </span>
            </span>
            <ChevronDown size={14} className={`chevron-icon ${dropdownOpen ? 'open' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="workspace-selector-menu" role="menu">
              <div className="workspace-menu-header">
                <span><Layers size={11} /> Workspaces</span>
                <button
                  type="button"
                  className="workspace-menu-add-btn"
                  onClick={() => {
                    setDropdownOpen(false)
                    onOpenCreateWorkspace()
                  }}
                  title="Create new workspace"
                >
                  <Plus size={14} />
                  <span>New</span>
                </button>
              </div>

              <div className="workspace-menu-list">
                {workspaces.map((ws) => {
                  const isActive = ws.id === activeWorkspace?.id
                  return (
                    <div
                      key={ws.id}
                      className={`workspace-menu-item ${isActive ? 'active' : ''}`}
                    >
                      <button
                        type="button"
                        className="workspace-menu-item-select"
                        onClick={() => {
                          onSwitchWorkspace(ws.id)
                          setDropdownOpen(false)
                        }}
                      >
                        <div className="workspace-menu-item-info">
                          <span className="workspace-item-title">
                            <FolderOpen size={12} /> {ws.name}
                          </span>
                          <span className="workspace-item-count">
                            {ws.file_count ?? 0} {ws.file_count === 1 ? 'file' : 'files'} · {ws.id}
                          </span>
                        </div>
                        {isActive && <Check size={14} className="workspace-active-check" />}
                      </button>

                      <div className="workspace-menu-item-actions">
                        <button
                          type="button"
                          className="workspace-item-action-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDropdownOpen(false)
                            onOpenRenameWorkspace(ws)
                          }}
                          title="Rename workspace"
                        >
                          <Edit2 size={13} />
                        </button>
                        {workspaces.length > 1 && (
                          <button
                            type="button"
                            className="workspace-item-action-btn delete"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDropdownOpen(false)
                              onOpenDeleteWorkspace(ws)
                            }}
                            title="Delete workspace"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="workspace-menu-footer">
                Each workspace is an isolated folder. Switch to open its files in the editor.
              </div>
            </div>
          )}
        </div>

        <div className="workspace-toolbar-divider" />

        <div className="workspace-quick-actions">
          <button className="workspace-quick-btn" onClick={onCreateFile} title="New file">
            <FilePlus size={14} /> New File
          </button>
          <button className="workspace-quick-btn secondary" onClick={onCreateFolder} title="New folder">
            <FolderPlus size={14} /> Folder
          </button>
        </div>
      </div>

      <div className="workspace-toolbar-right">
        <span className="workspace-toolbar-badge">
          {isTauri ? <Monitor size={13} /> : <Cloud size={13} />}
          <span>{isTauri ? 'Local disk' : 'Cloud folder'}</span>
          <span className="badge-dot" />
        </span>
        <button
          className={`workspace-toolbar-btn${terminalVisible ? ' active' : ''}`}
          onClick={onToggleTerminal}
          title="Toggle Terminal"
          aria-label="Toggle terminal"
          aria-pressed={terminalVisible}
        >
          <Terminal size={15} />
        </button>
        <button
          className={`workspace-toolbar-btn${browserVisible ? ' active' : ''}`}
          onClick={onToggleBrowser}
          title="Toggle Browser"
          aria-label="Toggle browser"
          aria-pressed={browserVisible}
        >
          <Globe size={15} />
        </button>
        <button
          className="workspace-toolbar-btn"
          onClick={() => onRefresh()}
          disabled={loading}
          title="Refresh file tree"
          aria-label="Refresh"
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
        </button>
      </div>
    </div>
  )
}
