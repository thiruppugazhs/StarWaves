import { useEffect, useState } from 'react'
import { clearRequestCache } from '../lib/request'
import { consumeAuthTokenFromHash, fetchCurrentUser, getStoredUser } from '../lib/authApi'

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser())
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let mounted = true

    async function checkAuth() {
      consumeAuthTokenFromHash()
      const user = await fetchCurrentUser()
      if (mounted) {
        setCurrentUser(user)
        setAuthReady(true)
      }
    }

    checkAuth()

    const handleAuthChange = () => {
      if (mounted) {
        setCurrentUser(getStoredUser())
      }
    }

    const handleStorage = (e) => {
      if (!e.key || e.key === 'starwaves_auth_token' || e.key === 'starwaves_auth_user') {
        if (mounted) setCurrentUser(getStoredUser())
      }
      if (e.key && e.key.startsWith('starwaves:')) {
        clearRequestCache()
      }
    }

    window.addEventListener('starwaves:auth-change', handleAuthChange)
    window.addEventListener('storage', handleStorage)
    const bc = (() => {
      try {
        if (typeof BroadcastChannel === 'undefined') return null
        const ch = new BroadcastChannel('starwaves-auth')
        ch.onmessage = (msg) => {
          if (msg?.data?.type === 'auth-change' && mounted) setCurrentUser(getStoredUser())
        }
        return ch
      } catch { return null }
    })()
    return () => {
      mounted = false
      window.removeEventListener('starwaves:auth-change', handleAuthChange)
      window.removeEventListener('storage', handleStorage)
      try { bc?.close() } catch {}
    }
  }, [])

  return { currentUser, authReady }
}
