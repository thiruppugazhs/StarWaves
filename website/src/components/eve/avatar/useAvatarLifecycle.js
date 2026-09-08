import { useCallback, useEffect, useMemo, useState } from 'react'
import { AVATAR_LIMITS } from './avatarConstants'

function supportsWebGL2() {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2'))
  } catch { return false }
}

function deviceMemoryProbe() {
  if (typeof navigator === 'undefined') return 4
  const dm = navigator.deviceMemory
  return typeof dm === 'number' ? dm : 4
}

export function useAvatarLifecycle({ renderer = 'auto', modelUrl = '' } = {}) {
  const [phase, setPhase] = useState('loading')
  const [error, setError] = useState('')

  const probe = useMemo(() => {
    const webgl2 = supportsWebGL2()
    const dm = deviceMemoryProbe()
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4
    // Be conservative for Avatar Studio — 10MB VRM + 2.7MB Live2D textures crash low-end PCs
    // Mark lowMemory if dm < 6 or cores <= 4 or no WebGL2, so we default to procedural
    const lowMemory = dm < 6 || cores <= 4 || !webgl2
    return { webgl2, dm, cores, lowMemory }
  }, [])

  const resolvedRenderer = useMemo(() => {
    if (modelUrl === null || modelUrl === '') return 'procedural'
    const url = String(modelUrl || '').toLowerCase()
    const isHeavyUrl = url.endsWith('.vrm') || url.endsWith('.glb') || url.endsWith('.gltf') || url.endsWith('.model3.json') || url.endsWith('.zip')
    if (renderer === 'auto' && probe.lowMemory && isHeavyUrl) return 'procedural'
    if (renderer !== 'auto') return renderer
    if (url.endsWith('.model3.json') || url.endsWith('.zip')) return 'live2d'
    if (url.endsWith('.vrm') || url.endsWith('.glb') || url.endsWith('.gltf')) return 'vrm'
    if (probe.lowMemory || !probe.webgl2) return 'procedural'
    return 'vrm'
  }, [modelUrl, probe.lowMemory, probe.webgl2, renderer])

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    if (resolvedRenderer === 'procedural') {
      setPhase('ready')
      setError('')
      return undefined
    }
    setPhase('loading')
    setError('')
    const timeout = window.setTimeout(() => {
      setPhase((current) => (current === 'loading' ? 'timeout' : current))
      setError((currentError) => currentError || 'Avatar load timed out — showing fallback.')
    }, AVATAR_LIMITS.LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [modelUrl, resolvedRenderer])

  const markReady = useCallback(() => {
    setPhase('ready')
    setError('')
  }, [])
  const markError = useCallback((message) => {
    setPhase('error')
    setError(message || 'Could not load avatar model.')
  }, [])

  return useMemo(
    () => ({ phase, error, probe, resolvedRenderer, prefersReducedMotion, markReady, markError }),
    [phase, error, probe, resolvedRenderer, prefersReducedMotion, markReady, markError],
  )
}
