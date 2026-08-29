import { useCallback, useMemo } from 'react'
import {
  listWorkspaces as apiListWorkspaces,
  createWorkspace as apiCreateWorkspace,
  renameWorkspace as apiRenameWorkspace,
  deleteWorkspace as apiDeleteWorkspace,
  loadFileTree,
  readFile,
  writeFile,
  deleteFile,
} from '../../lib/workspaceFilesApi'

function isTauriEnvironment() {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined
}

export function useWorkspaceBridge() {
  const isTauri = useMemo(() => isTauriEnvironment(), [])

  const listWorkspaces = useCallback(async () => {
    return apiListWorkspaces()
  }, [])

  const createWorkspace = useCallback(async (name) => {
    return apiCreateWorkspace(name)
  }, [])

  const renameWorkspace = useCallback(async (workspaceId, name) => {
    return apiRenameWorkspace(workspaceId, name)
  }, [])

  const deleteWorkspace = useCallback(async (workspaceId) => {
    return apiDeleteWorkspace(workspaceId)
  }, [])

  const listFiles = useCallback(async (workspaceId = 'default') => {
    if (isTauri) {
      // Tauri native FS — will be implemented when Tauri scaffold is ready
      // For now, fall through to cloud API
    }
    return loadFileTree(workspaceId)
  }, [isTauri])

  const readFileContent = useCallback(
    async (filePath, workspaceId = 'default') => {
      if (isTauri) {
        // Tauri native FS read — future implementation
      }
      const result = await readFile(filePath, workspaceId)
      return result?.content ?? ''
    },
    [isTauri],
  )

  const writeFileContent = useCallback(
    async (filePath, content, encoding = 'utf-8', workspaceId = 'default') => {
      if (isTauri) {
        // Tauri native FS write — future implementation
      }
      return writeFile(filePath, content, encoding, workspaceId)
    },
    [isTauri],
  )

  const removeFile = useCallback(
    async (filePath, workspaceId = 'default') => {
      if (isTauri) {
        // Tauri native FS delete — future implementation
      }
      return deleteFile(filePath, workspaceId)
    },
    [isTauri],
  )

  return useMemo(
    () => ({
      isTauri,
      listWorkspaces,
      createWorkspace,
      renameWorkspace,
      deleteWorkspace,
      listFiles,
      readFile: readFileContent,
      writeFile: writeFileContent,
      deleteFile: removeFile,
    }),
    [
      isTauri,
      listWorkspaces,
      createWorkspace,
      renameWorkspace,
      deleteWorkspace,
      listFiles,
      readFileContent,
      writeFileContent,
      removeFile,
    ],
  )
}

