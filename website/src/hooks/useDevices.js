import { useCallback, useEffect, useState } from 'react'
import { fetchDeviceSessions, renameDeviceSession, revokeDeviceSession, revokeOtherSessions } from '../lib/authApi'

export function useDevices() {
  const [sessions, setSessions] = useState([])
  const [currentJti, setCurrentJti] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchDeviceSessions()
      setSessions(res.sessions || [])
      setCurrentJti(res.current_jti || null)
    } catch (e) {
      setError(e.message || 'Failed to load devices.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const rename = useCallback(async (id, name) => {
    await renameDeviceSession(id, name)
    await refresh()
  }, [refresh])

  const revoke = useCallback(async (id) => {
    await revokeDeviceSession(id)
    await refresh()
  }, [refresh])

  const revokeOthers = useCallback(async () => {
    const res = await revokeOtherSessions()
    await refresh()
    return res
  }, [refresh])

  return { sessions, currentJti, loading, error, refresh, rename, revoke, revokeOthers }
}
