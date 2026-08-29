import { useCallback, useEffect, useState } from 'react'
import { useWorkspace } from './workspace/useWorkspace'
import { WorkspaceToolbar } from './workspace/WorkspaceToolbar'
import { WorkspaceOverview } from './workspace/WorkspaceOverview'
import { WorkspaceFileTree } from './workspace/WorkspaceFileTree'
import { WorkspaceEditor } from './workspace/WorkspaceEditor'
import { WorkspaceTerminal } from './workspace/WorkspaceTerminal'
import { WorkspaceBrowser } from './workspace/WorkspaceBrowser'
import { WorkspaceEvePanel } from './workspace/WorkspaceEvePanel'
import { Modal, ConfirmDialog, FormField } from '../components/ui'

export function WorkspacePage() {
  const workspace = useWorkspace()
  const [view, setView] = useState('overview')
  const [evePanelCollapsed, setEvePanelCollapsed] = useState(true)
  const [terminalVisible, setTerminalVisible] = useState(false)
  const [browserVisible, setBrowserVisible] = useState(false)
  const [browserUrl, setBrowserUrl] = useState('')
  const [newFilePrompt, setNewFilePrompt] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFolderPrompt, setNewFolderPrompt] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Workspace management modal states
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [workspaceToRename, setWorkspaceToRename] = useState(null)
  const [renameWorkspaceName, setRenameWorkspaceName] = useState('')
  const [workspaceToDelete, setWorkspaceToDelete] = useState(null)

  useEffect(() => {
    const init = async () => {
      await workspace.fetchWorkspaces()
      await workspace.refreshTree()
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateFile = useCallback(() => {
    setNewFilePrompt(true)
    setNewFileName('')
  }, [])

  const handleCreateFolder = useCallback(() => {
    setNewFolderPrompt(true)
    setNewFolderName('')
  }, [])

  const handleConfirmCreate = useCallback(async () => {
    const name = newFileName.trim()
    if (!name) return
    await workspace.createFile(name)
    setNewFilePrompt(false)
    setNewFileName('')
  }, [newFileName, workspace])

  const handleConfirmCreateFolder = useCallback(async () => {
    const name = newFolderName.trim().replace(/^\/+|\/+$/g, '')
    if (!name) return
    // Create folder via placeholder .keep file
    const placeholder = name.endsWith('/') ? `${name}.keep` : `${name}/.keep`
    await workspace.createFile(placeholder, '')
    setNewFolderPrompt(false)
    setNewFolderName('')
  }, [newFolderName, workspace])

  const handleConfirmCreateWorkspace = useCallback(async () => {
    const name = newWorkspaceName.trim()
    if (!name) return
    try {
      await workspace.createWorkspace(name)
      setCreateWorkspaceOpen(false)
      setNewWorkspaceName('')
    } catch {
      // Error handled by workspace hook
    }
  }, [newWorkspaceName, workspace])

  const handleOpenRenameWorkspace = useCallback((ws) => {
    setWorkspaceToRename(ws)
    setRenameWorkspaceName(ws.name)
  }, [])

  const handleConfirmRenameWorkspace = useCallback(async () => {
    if (!workspaceToRename || !renameWorkspaceName.trim()) return
    try {
      await workspace.renameWorkspace(workspaceToRename.id, renameWorkspaceName.trim())
      setWorkspaceToRename(null)
      setRenameWorkspaceName('')
    } catch {
      // Error handled by workspace hook
    }
  }, [renameWorkspaceName, workspace, workspaceToRename])

  const handleConfirmDeleteWorkspace = useCallback(async () => {
    if (!workspaceToDelete) return
    try {
      await workspace.deleteWorkspace(workspaceToDelete.id)
      setWorkspaceToDelete(null)
    } catch {
      // Error handled by workspace hook
    }
  }, [workspace, workspaceToDelete])

  const handleOpenWorkspace = useCallback(
    async (ws) => {
      await workspace.switchWorkspace(ws.id)
      setView('ide')
    },
    [workspace],
  )

  const handleEveAction = useCallback((action) => {
    if (action?.type === 'open_browser_url' && action.url) {
      setBrowserUrl(action.url)
      setBrowserVisible(true)
    }
  }, [])

  const handleRunHtml = useCallback(() => {
    setBrowserUrl('')
    setBrowserVisible(true)
  }, [])

  const activeHtmlContent = (() => {
    if (!browserVisible) return null
    const tab = workspace.openTabs?.find((t) => t.path === workspace.activeTab)
    if (!tab) return null
    if (!tab.path?.toLowerCase().endsWith('.html')) return null
    return tab.content ?? null
  })()

  const handleKeyboardSave = useCallback(
    (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        if (workspace.activeTab) {
          workspace.saveFile(workspace.activeTab)
        }
      }
    },
    [workspace],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardSave)
    return () => document.removeEventListener('keydown', handleKeyboardSave)
  }, [handleKeyboardSave])

  if (view === 'overview') {
    return (
      <div className="workspace-page">
        {workspace.error && (
          <div className="workspace-error">
            <span>{workspace.error}</span>
            <button onClick={workspace.clearError}>×</button>
          </div>
        )}
        <WorkspaceOverview
          workspaces={workspace.workspaces}
          activeWorkspaceId={workspace.activeWorkspaceId}
          loading={workspace.loading}
          onOpenWorkspace={handleOpenWorkspace}
          onOpenCreateWorkspace={() => {
            setNewWorkspaceName('')
            setCreateWorkspaceOpen(true)
          }}
          onOpenRenameWorkspace={handleOpenRenameWorkspace}
          onOpenDeleteWorkspace={(ws) => setWorkspaceToDelete(ws)}
        />

        {/* Create Workspace Modal */}
        <Modal
          isOpen={createWorkspaceOpen}
          onClose={() => setCreateWorkspaceOpen(false)}
          title="Create New Workspace"
          subtitle="Each workspace is an isolated folder — like a project root"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleConfirmCreateWorkspace()
            }}
          >
            <FormField label="Workspace Name" id="new-workspace-name">
              <input
                id="new-workspace-name"
                type="text"
                className="text-input"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="e.g., Portfolio Website, Backend API, Notes"
                autoFocus
                data-modal-initial-focus
              />
            </FormField>
            <p className="workspace-modal-hint">This will create a folder on disk/cloud. Switch workspaces to open its files in the editor.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCreateWorkspaceOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={!newWorkspaceName.trim()}
              >
                Create Workspace
              </button>
            </div>
          </form>
        </Modal>

        {/* Rename Workspace Modal */}
        <Modal
          isOpen={Boolean(workspaceToRename)}
          onClose={() => setWorkspaceToRename(null)}
          title="Rename Workspace"
          subtitle={`Update display name for workspace`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleConfirmRenameWorkspace()
            }}
          >
            <FormField label="Workspace Name" id="rename-workspace-name">
              <input
                id="rename-workspace-name"
                type="text"
                className="text-input"
                value={renameWorkspaceName}
                onChange={(e) => setRenameWorkspaceName(e.target.value)}
                placeholder="e.g., Project Name"
                autoFocus
                data-modal-initial-focus
              />
            </FormField>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setWorkspaceToRename(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={!renameWorkspaceName.trim()}
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete Workspace Confirmation */}
        <ConfirmDialog
          isOpen={Boolean(workspaceToDelete)}
          title="Delete Workspace"
          message={`Are you sure you want to delete "${workspaceToDelete?.name}"? All files and folders inside this workspace will be permanently removed.`}
          confirmLabel="Delete Workspace"
          destructive={true}
          onConfirm={async () => {
            await handleConfirmDeleteWorkspace()
            const stillExists = workspace.workspaces.some(
              (ws) => ws.id === workspaceToDelete?.id,
            )
            if (!stillExists && view === 'ide') setView('overview')
          }}
          onCancel={() => setWorkspaceToDelete(null)}
        />
      </div>
    )
  }

  return (
    <div className="workspace-page">
      <WorkspaceToolbar
        workspaces={workspace.workspaces}
        activeWorkspace={workspace.activeWorkspace}
        onBackToOverview={() => setView('overview')}
        onSwitchWorkspace={workspace.switchWorkspace}
        onOpenCreateWorkspace={() => {
          setNewWorkspaceName('')
          setCreateWorkspaceOpen(true)
        }}
        onOpenRenameWorkspace={handleOpenRenameWorkspace}
        onOpenDeleteWorkspace={(ws) => setWorkspaceToDelete(ws)}
        isTauri={workspace.isTauri}
        loading={workspace.loading}
        onRefresh={workspace.refreshTree}
        terminalVisible={terminalVisible}
        onToggleTerminal={() => setTerminalVisible(!terminalVisible)}
        browserVisible={browserVisible}
        onToggleBrowser={() => setBrowserVisible(!browserVisible)}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
      />

      {workspace.error && (
        <div className="workspace-error">
          <span>{workspace.error}</span>
          <button onClick={workspace.clearError}>×</button>
        </div>
      )}

      <div className="workspace-layout">
        <WorkspaceFileTree
          files={workspace.fileTree}
          activeFile={workspace.activeTab}
          onFileSelect={workspace.openFile}
          onDelete={workspace.deleteFile}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
        />

        <div className={`workspace-center${browserVisible ? ' browser-open' : ''}`}>
          <div className="workspace-center-stack">
            <WorkspaceEditor
              tabs={workspace.openTabs}
              activeTab={workspace.activeTab}
              onTabSelect={workspace.setActiveTab}
              onTabClose={workspace.closeTab}
              onContentChange={workspace.updateTabContent}
              onSave={workspace.saveFile}
              isFileDirty={workspace.isFileDirty}
              onCreateFile={handleCreateFile}
              onRunHtml={handleRunHtml}
            />
            {terminalVisible && (
              <WorkspaceTerminal isTauri={workspace.isTauri} />
            )}
          </div>
          {browserVisible && (
            <WorkspaceBrowser
              workspaceId={workspace.activeWorkspaceId}
              initialUrl={browserUrl}
              htmlContent={activeHtmlContent}
              onClose={() => setBrowserVisible(false)}
            />
          )}
        </div>

        <WorkspaceEvePanel
          collapsed={evePanelCollapsed}
          onToggle={() => setEvePanelCollapsed(!evePanelCollapsed)}
          workspaceId={workspace.activeWorkspaceId}
          workspaceName={workspace.activeWorkspace?.name}
          activeFilePath={workspace.activeTab}
          onFilesChanged={workspace.refreshTree}
          onAction={handleEveAction}
        />
      </div>

      {newFilePrompt && (
        <div className="workspace-new-file-overlay" onClick={() => setNewFilePrompt(false)}>
          <div
            className="workspace-new-file-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>New File</h3>
            <p className="dialog-subtitle">Creates inside the current workspace folder. Use <code>folder/file.ext</code> to nest.</p>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreate()
                if (e.key === 'Escape') setNewFilePrompt(false)
              }}
              placeholder="path/to/filename.ext  e.g. src/app.js"
              autoFocus
            />
            <div className="workspace-new-file-actions">
              <button onClick={() => setNewFilePrompt(false)}>Cancel</button>
              <button
                className="primary"
                onClick={handleConfirmCreate}
                disabled={!newFileName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {newFolderPrompt && (
        <div className="workspace-new-file-overlay" onClick={() => setNewFolderPrompt(false)}>
          <div
            className="workspace-new-file-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>New Folder</h3>
            <p className="dialog-subtitle">Creates a folder inside the workspace. You can then add files inside it.</p>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreateFolder()
                if (e.key === 'Escape') setNewFolderPrompt(false)
              }}
              placeholder="folder name  e.g. src/components"
              autoFocus
            />
            <div className="workspace-new-file-actions">
              <button onClick={() => setNewFolderPrompt(false)}>Cancel</button>
              <button
                className="primary"
                onClick={handleConfirmCreateFolder}
                disabled={!newFolderName.trim()}
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      <Modal
        isOpen={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
        title="Create New Workspace"
        subtitle="Each workspace is an isolated folder — like a project root"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirmCreateWorkspace()
          }}
        >
          <FormField label="Workspace Name" id="new-workspace-name">
            <input
              id="new-workspace-name"
              type="text"
              className="text-input"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="e.g., Portfolio Website, Backend API, Notes"
              autoFocus
              data-modal-initial-focus
            />
          </FormField>
          <p className="workspace-modal-hint">This will create a folder on disk/cloud. Switch workspaces to open its files in the editor.</p>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setCreateWorkspaceOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={!newWorkspaceName.trim()}
            >
              Create Workspace
            </button>
          </div>
        </form>
      </Modal>

      {/* Rename Workspace Modal */}
      <Modal
        isOpen={Boolean(workspaceToRename)}
        onClose={() => setWorkspaceToRename(null)}
        title="Rename Workspace"
        subtitle={`Update display name for workspace`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirmRenameWorkspace()
          }}
        >
          <FormField label="Workspace Name" id="rename-workspace-name">
            <input
              id="rename-workspace-name"
              type="text"
              className="text-input"
              value={renameWorkspaceName}
              onChange={(e) => setRenameWorkspaceName(e.target.value)}
              placeholder="e.g., Project Name"
              autoFocus
              data-modal-initial-focus
            />
          </FormField>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setWorkspaceToRename(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={!renameWorkspaceName.trim()}
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Workspace Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(workspaceToDelete)}
        title="Delete Workspace"
        message={`Are you sure you want to delete "${workspaceToDelete?.name}"? All files and folders inside this workspace will be permanently removed.`}
        confirmLabel="Delete Workspace"
        destructive={true}
        onConfirm={handleConfirmDeleteWorkspace}
        onCancel={() => setWorkspaceToDelete(null)}
      />
    </div>
  )
}
