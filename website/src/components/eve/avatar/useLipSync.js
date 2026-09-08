import { useCallback, useEffect, useRef, useState } from 'react'

export function useLipSync({ isSpeaking = false, audioRef = null, enabled = true } = {}) {
  const [mouthOpen, setMouthOpen] = useState(0)
  const rafRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const ctxRef = useRef(null)

  const attach = useCallback((audioEl) => {
    if (!enabled || !audioEl || typeof window === 'undefined' || !window.AudioContext) return
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = ctxRef.current || new AudioCtx()
      ctxRef.current = ctx
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 32
      analyser.smoothingTimeConstant = 0.7
      const src = ctx.createMediaElementSource(audioEl)
      src.connect(analyser)
      analyser.connect(ctx.destination)
      analyserRef.current = analyser
      sourceRef.current = src
    } catch {}
  }, [enabled])

  const detach = useCallback(() => {
    try { sourceRef.current?.disconnect() } catch {}
    try { analyserRef.current?.disconnect() } catch {}
    analyserRef.current = null
    sourceRef.current = null
  }, [])

  useEffect(() => {
    const el = audioRef?.current
    if (el && isSpeaking) attach(el)
    if (!isSpeaking) detach()
    return () => detach()
  }, [attach, audioRef, detach, isSpeaking])

  useEffect(() => {
    if (!enabled || !isSpeaking) {
      setMouthOpen(0)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    const tick = () => {
      const analyser = analyserRef.current
      if (!analyser) {
        // viseme fallback: pulse when speaking but no analyser
        setMouthOpen((current) => {
          const next = 0.15 + Math.abs(Math.sin(Date.now() * 0.009)) * 0.25
          return Math.abs(next - current) < 0.03 ? current : next
        })
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const avg = sum / data.length / 255
      const target = Math.min(1, Math.max(0, avg * 1.8))
      setMouthOpen((current) => {
        const next = current * 0.6 + target * 0.4
        return Math.abs(next - current) < 0.02 ? current : next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [enabled, isSpeaking])

  return { mouthOpen, attach, detach }
}
