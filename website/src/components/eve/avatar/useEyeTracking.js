import { useEffect, useRef, useState } from 'react'

export function useEyeTracking({ enabled = true, containerRef = null } = {}) {
  const [lookAt, setLookAt] = useState({ x: 0, y: 0 })
  const [isBlinking, setIsBlinking] = useState(false)
  const rafRef = useRef(null)
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!enabled) return undefined
    const onMove = (event) => {
      const el = containerRef?.current
      if (!el) {
        const nx = (event.clientX / window.innerWidth) * 2 - 1
        const ny = (event.clientY / window.innerHeight) * 2 - 1
        targetRef.current = { x: Math.max(-1, Math.min(1, nx * 0.6)), y: Math.max(-1, Math.min(1, -ny * 0.5)) }
        return
      }
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const nx = (event.clientX - cx) / (rect.width / 2)
      const ny = (event.clientY - cy) / (rect.height / 2)
      targetRef.current = { x: Math.max(-1, Math.min(1, nx * 0.5)), y: Math.max(-1, Math.min(1, -ny * 0.4)) }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [containerRef, enabled])

  useEffect(() => {
    if (!enabled) return undefined
    let lastSent = { x: 0, y: 0 }
    const lerp = () => {
      const cur = currentRef.current
      const tgt = targetRef.current
      cur.x += (tgt.x - cur.x) * 0.08
      cur.y += (tgt.y - cur.y) * 0.08
      const dx = Math.abs(cur.x - lastSent.x)
      const dy = Math.abs(cur.y - lastSent.y)
      if (dx > 0.015 || dy > 0.015) {
        lastSent = { x: cur.x, y: cur.y }
        setLookAt(lastSent)
      }
      rafRef.current = requestAnimationFrame(lerp)
    }
    rafRef.current = requestAnimationFrame(lerp)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    let timeout
    const schedule = () => {
      const delay = 3000 + Math.random() * 3500
      timeout = window.setTimeout(() => {
        setIsBlinking(true)
        window.setTimeout(() => {
          setIsBlinking(false)
          schedule()
        }, 140)
      }, delay)
    }
    schedule()
    return () => window.clearTimeout(timeout)
  }, [enabled])

  return { lookAt, isBlinking }
}
