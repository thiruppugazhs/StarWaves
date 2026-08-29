import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkspaceBridge } from '../workspace/useWorkspaceBridge'

const SDIGNORE_FILENAME = '.sdignore'

export function useStudioFiles(workspaceId) {
  const bridge = useWorkspaceBridge()
  const [fileTree, setFileTree] = useState([])
  const [openTabs, setOpenTabs] = useState([])
  const [activeTab, setActiveTab] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const dirtyFiles = useRef(new Set())

  const refreshTree = useCallback(async () => {
    if (!workspaceId) return
    setIsLoading(true)
    setError('')
    try {
      const files = await bridge.listFiles(workspaceId)
      setFileTree(files.filter((f) => f.name !== SDIGNORE_FILENAME))
    } catch (loadError) {
      setError(loadError.message || 'Failed to load project files.')
    } finally {
      setIsLoading(false)
    }
  }, [bridge, workspaceId])

  useEffect(() => {
    setOpenTabs([])
    setActiveTab(null)
    dirtyFiles.current.clear()
    refreshTree()
  }, [workspaceId, refreshTree])

  const openFile = useCallback(
    async (filePath) => {
      const existing = openTabs.find((tab) => tab.path === filePath)
      if (existing) {
        setActiveTab(filePath)
        return
      }
      try {
        const content = await bridge.readFile(filePath, workspaceId)
        const name = filePath.split('/').pop()
        setOpenTabs((tabs) => [...tabs, { path: filePath, name, content, savedContent: content }])
        setActiveTab(filePath)
      } catch (openError) {
        setError(openError.message || 'Failed to open file.')
      }
    },
    [bridge, openTabs, workspaceId],
  )

  const closeTab = useCallback(
    (filePath) => {
      setOpenTabs((tabs) => tabs.filter((tab) => tab.path !== filePath))
      dirtyFiles.current.delete(filePath)
      setActiveTab((current) => {
        if (current !== filePath) return current
        const remaining = openTabs.filter((tab) => tab.path !== filePath)
        return remaining.length > 0 ? remaining[remaining.length - 1].path : null
      })
    },
    [openTabs],
  )

  const updateTabContent = useCallback((filePath, newContent) => {
    setOpenTabs((tabs) =>
      tabs.map((tab) => {
        if (tab.path !== filePath) return tab
        if (newContent !== tab.savedContent) dirtyFiles.current.add(filePath)
        else dirtyFiles.current.delete(filePath)
        return { ...tab, content: newContent }
      }),
    )
  }, [])

  const saveFile = useCallback(
    async (filePath) => {
      const tab = openTabs.find((t) => t.path === filePath)
      if (!tab) return
      try {
        await bridge.writeFile(filePath, tab.content, 'utf-8', workspaceId)
        dirtyFiles.current.delete(filePath)
        setOpenTabs((tabs) =>
          tabs.map((t) => (t.path === filePath ? { ...t, savedContent: t.content } : t)),
        )
      } catch (saveError) {
        setError(saveError.message || 'Failed to save file.')
      }
    },
    [bridge, openTabs, workspaceId],
  )

  const createFile = useCallback(
    async (filePath) => {
      try {
        await bridge.writeFile(filePath, '', 'utf-8', workspaceId)
        await refreshTree()
        await openFile(filePath)
      } catch (createError) {
        setError(createError.message || 'Failed to create file.')
      }
    },
    [bridge, openFile, refreshTree, workspaceId],
  )

  const deleteFile = useCallback(
    async (filePath) => {
      try {
        await bridge.deleteFile(filePath, workspaceId)
        closeTab(filePath)
        await refreshTree()
      } catch (deleteError) {
        setError(deleteError.message || 'Failed to delete file.')
      }
    },
    [bridge, closeTab, refreshTree, workspaceId],
  )

  const isFileDirty = useCallback((filePath) => dirtyFiles.current.has(filePath), [])

  return {
    fileTree,
    openTabs,
    activeTab,
    isLoading,
    error,
    clearError: () => setError(''),
    refreshTree,
    openFile,
    closeTab,
    updateTabContent,
    saveFile,
    createFile,
    deleteFile,
    isFileDirty,
  }
}
