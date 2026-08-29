import { useCallback, useEffect, useState } from 'react'
import {
  createStudioProject,
  deleteStudioProject,
  listStudioProjects,
} from '../../lib/studioApi'

export function useStudioProjects() {
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setProjects(await listStudioProjects())
    } catch (loadError) {
      setError(loadError.message || 'Could not load Studio projects.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(
    async (payload) => {
      const created = await createStudioProject(payload)
      await refresh()
      return created
    },
    [refresh],
  )

  const remove = useCallback(
    async (projectId) => {
      await deleteStudioProject(projectId)
      setProjects((current) => current.filter((p) => p.id !== projectId))
    },
    [],
  )

  return { projects, isLoading, error, refresh, create, remove }
}
