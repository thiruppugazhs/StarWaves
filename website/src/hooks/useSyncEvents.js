import { useEffect } from 'react'
import { clearRequestCache } from '../lib/request'
import { whatsappSocket } from '../lib/whatsappSocket'

export function useSyncEvents({ onInvalidate, user }) {
  useEffect(() => {
    if (!user?.uid) return undefined
    const unsub = whatsappSocket.subscribe(async (event) => {
      if (!event || typeof event.type !== 'string') return
      if (event.type === 'session_revoked' || event.type === 'sessions_revoked_others') {
        const token = localStorage.getItem('starwaves_auth_token')
        if (token) {
          // session_revoked is handled via 401 on next request; sessions_revoked_others is intentionally ignored here
        void event
        }
        // For revoked current session, backend will 401 next request; also force cache clear
        clearRequestCache()
        if (event.type === 'session_revoked') {
          // Only clear if next fetch 401s; avoid premature logout
        }
      }
      if (event.type === 'sync_invalidate') {
        clearRequestCache()
        // Notify app to refetch workspace data
        window.dispatchEvent(new CustomEvent('starwaves:sync-invalidate', { detail: event }))
        if (onInvalidate) onInvalidate(event)
      }
      if (event.type === 'call_updated' || event.type === 'call_signal' || event.type === 'incoming_call') {
        // Let call center handle via callsSocket, but also clear cache
        clearRequestCache()
      }
    })
    return unsub
  }, [user?.uid, onInvalidate])
}
