import { useEffect, useRef } from 'react'
import { invalidateCacheForPath } from '../lib/request'
import { whatsappSocket } from '../lib/whatsappSocket'

export function useSyncEvents({ onInvalidate, user }) {
  const onInvalidateRef = useRef(onInvalidate)
  onInvalidateRef.current = onInvalidate
  const debounceTimerRef = useRef(null)

  useEffect(() => {
    if (!user?.uid) return undefined
    const scheduleInvalidate = (event) => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null
        window.dispatchEvent(new CustomEvent('starwaves:sync-invalidate', { detail: event }))
        onInvalidateRef.current?.(event)
      }, 300)
    }

    const unsub = whatsappSocket.subscribe(async (event) => {
      if (!event || typeof event.type !== 'string') return
      if (event.type === 'session_revoked' || event.type === 'sessions_revoked_others') {
        // 401 on next request will force logout; no cache clear needed (selective).
        return
      }
      if (event.type === 'sync_invalidate') {
        // Only bust workspace-related caches, not entire cache which defeats request.js TTL
        invalidateCacheForPath('/workspace')
        invalidateCacheForPath('/todos')
        invalidateCacheForPath('/workspace-files')
        scheduleInvalidate(event)
      }
      // Intentionally NOT clearing cache on call_updated/call_signal/incoming_call
      // — WebRTC handshake produces many signals per call; clearing cache there thrashes TTL
      // and causes the workspace spam observed. Call signaling is handled by callsSocket.
    })
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current)
      unsub()
    }
  }, [user?.uid])
}
