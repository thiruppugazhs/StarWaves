import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkspaceBridge } from './useWorkspaceBridge'
import { createIgnoreMatcher, parseSdIgnore } from './sdIgnore'

const SDIGNORE_FILENAME = '.sdignore'
const ACTIVE_WORKSPACE_STORAGE_KEY = 'starwaves.workspace.active_id'

export function useWorkspace() {
  const bridge = useWorkspaceBridge()
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY) || 'default'
  })
  const [fileTree, setFileTree] = useState([])
  const [openTabs, setOpenTabs] = useState([])
  const [activeTab, setActiveTab] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dirtyFiles = useRef(new Set())
  const ignoreMatcherRef = useRef(() => false)

  const activeWorkspaceIdRef = useRef(activeWorkspaceId)
  useEffect(() => {
    activeWorkspaceIdRef.current = activeWorkspaceId
    try {
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, activeWorkspaceId)
    } catch {
      // Ignore localStorage failure
    }
  }, [activeWorkspaceId])

  const fetchWorkspaces = useCallback(async () => {
    try {
      const list = await bridge.listWorkspaces()
      setWorkspaces(list)
      // If current active workspace is not in list, fallback to first or default
      if (list.length > 0) {
        const found = list.find((ws) => ws.id === activeWorkspaceIdRef.current)
        if (!found) {
          setActiveWorkspaceId(list[0].id)
        }
      }
      return list
    } catch (err) {
      console.error('Failed to load workspaces:', err)
      return []
    }
  }, [bridge])

  const refreshTree = useCallback(
    async (targetWorkspaceId = activeWorkspaceIdRef.current) => {
      setLoading(true)
      setError('')
      try {
        const files = await bridge.listFiles(targetWorkspaceId)
        // Find .sdignore and parse it
        const sdIgnoreFile = files.find((f) => f.name === SDIGNORE_FILENAME && !f.is_directory)
        if (sdIgnoreFile) {
          try {
            const content = await bridge.readFile(sdIgnoreFile.path, targetWorkspaceId)
            const patterns = parseSdIgnore(content)
            ignoreMatcherRef.current = createIgnoreMatcher(patterns)
          } catch {
            ignoreMatcherRef.current = createIgnoreMatcher([])
          }
        } else {
          ignoreMatcherRef.current = createIgnoreMatcher([])
        }
        // Filter ignored files
        const filtered = files.filter((f) => !ignoreMatcherRef.current(f.path))
        setFileTree(filtered)
      } catch (err) {
        setError(err.message || 'Failed to load workspace files.')
      } finally {
        setLoading(false)
      }
    },
    [bridge],
  )

  const switchWorkspace = useCallback(
    async (newWorkspaceId) => {
      if (newWorkspaceId === activeWorkspaceIdRef.current) return
      setActiveWorkspaceId(newWorkspaceId)
      setOpenTabs([])
      setActiveTab(null)
      dirtyFiles.current.clear()
      await refreshTree(newWorkspaceId)
    },
    [refreshTree],
  )

  const createNewWorkspace = useCallback(
    async (name) => {
      try {
        setLoading(true)
        const created = await bridge.createWorkspace(name)
        await fetchWorkspaces()
        if (created?.id) {
          setActiveWorkspaceId(created.id)
          setOpenTabs([])
          setActiveTab(null)
          dirtyFiles.current.clear()
          await refreshTree(created.id)
        }
        return created
      } catch (err) {
        setError(err.message || 'Failed to create workspace.')
        throw err
      } finally {
        setLoading(false)
      }
    },
    [bridge, fetchWorkspaces, refreshTree],
  )

  const renameExistingWorkspace = useCallback(
    async (workspaceId, newName) => {
      try {
        setLoading(true)
        const updated = await bridge.renameWorkspace(workspaceId, newName)
        await fetchWorkspaces()
        return updated
      } catch (err) {
        setError(err.message || 'Failed to rename workspace.')
        throw err
      } finally {
        setLoading(false)
      }
    },
    [bridge, fetchWorkspaces],
  )

  const deleteExistingWorkspace = useCallback(
    async (workspaceId) => {
      try {
        setLoading(true)
        await bridge.deleteWorkspace(workspaceId)
        const list = await fetchWorkspaces()
        const nextId = list.length > 0 ? list[0].id : 'default'
        setActiveWorkspaceId(nextId)
        setOpenTabs([])
        setActiveTab(null)
        dirtyFiles.current.clear()
        await refreshTree(nextId)
      } catch (err) {
        setError(err.message || 'Failed to delete workspace.')
        throw err
      } finally {
        setLoading(false)
      }
    },
    [bridge, fetchWorkspaces, refreshTree],
  )

  const openFile = useCallback(
    async (filePath) => {
      const existing = openTabs.find((tab) => tab.path === filePath)
      if (existing) {
        setActiveTab(filePath)
        return
      }
      try {
        const content = await bridge.readFile(filePath, activeWorkspaceIdRef.current)
        const name = filePath.split('/').pop()
        setOpenTabs((tabs) => [...tabs, { path: filePath, name, content, savedContent: content }])
        setActiveTab(filePath)
      } catch (err) {
        setError(err.message || 'Failed to open file.')
      }
    },
    [bridge, openTabs],
  )

  const closeTab = useCallback(
    (filePath) => {
      setOpenTabs((tabs) => tabs.filter((tab) => tab.path !== filePath))
      dirtyFiles.current.delete(filePath)
      if (activeTab === filePath) {
        setActiveTab(() => {
          const remaining = openTabs.filter((tab) => tab.path !== filePath)
          return remaining.length > 0 ? remaining[remaining.length - 1].path : null
        })
      }
    },
    [activeTab, openTabs],
  )

  const updateTabContent = useCallback((filePath, newContent) => {
    setOpenTabs((tabs) =>
      tabs.map((tab) => {
        if (tab.path !== filePath) return tab
        const isDirty = newContent !== tab.savedContent
        if (isDirty) {
          dirtyFiles.current.add(filePath)
        } else {
          dirtyFiles.current.delete(filePath)
        }
        return { ...tab, content: newContent }
      }),
    )
  }, [])

  const saveFile = useCallback(
    async (filePath) => {
      const tab = openTabs.find((t) => t.path === filePath)
      if (!tab) return
      try {
        await bridge.writeFile(filePath, tab.content, 'utf-8', activeWorkspaceIdRef.current)
        dirtyFiles.current.delete(filePath)
        setOpenTabs((tabs) =>
          tabs.map((t) => (t.path === filePath ? { ...t, savedContent: t.content } : t)),
        )
      } catch (err) {
        setError(err.message || 'Failed to save file.')
      }
    },
    [bridge, openTabs],
  )

  const deleteWorkspaceFile = useCallback(
    async (filePath) => {
      try {
        await bridge.deleteFile(filePath, activeWorkspaceIdRef.current)
        closeTab(filePath)
        await refreshTree(activeWorkspaceIdRef.current)
      } catch (err) {
        setError(err.message || 'Failed to delete file.')
      }
    },
    [bridge, closeTab, refreshTree],
  )

  const createFile = useCallback(
    async (filePath, content = '') => {
      try {
        await bridge.writeFile(filePath, content, 'utf-8', activeWorkspaceIdRef.current)
        await refreshTree(activeWorkspaceIdRef.current)
        await openFile(filePath)
      } catch (err) {
        setError(err.message || 'Failed to create file.')
      }
    },
    [bridge, refreshTree, openFile],
  )

  const isFileDirty = useCallback((filePath) => dirtyFiles.current.has(filePath), [])

  const activeWorkspace =
    workspaces.find((ws) => ws.id === activeWorkspaceId) || {
      id: activeWorkspaceId,
      name: activeWorkspaceId === 'default' ? 'Default Workspace' : activeWorkspaceId,
    }

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    fileTree,
    openTabs,
    activeTab,
    loading,
    error,
    isTauri: bridge.isTauri,
    fetchWorkspaces,
    switchWorkspace,
    createWorkspace: createNewWorkspace,
    renameWorkspace: renameExistingWorkspace,
    deleteWorkspace: deleteExistingWorkspace,
    setActiveTab,
    refreshTree,
    openFile,
    closeTab,
    updateTabContent,
    saveFile,
    deleteFile: deleteWorkspaceFile,
    createFile,
    isFileDirty,
    clearError: () => setError(''),
  }
}

