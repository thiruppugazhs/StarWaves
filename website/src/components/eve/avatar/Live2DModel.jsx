import { useCallback, useEffect, useRef, useState } from 'react'
import { AVATAR_DEFAULTS, AVATAR_LIMITS, clampUserPan, clampZoom } from './avatarConstants'

let PixiModule = null
let Live2DFactory = null

async function ensurePixi() {
  if (PixiModule) return PixiModule
  const mod = await import('pixi.js')
  PixiModule = mod
  if (typeof window !== 'undefined') window.PIXI = mod
  return PixiModule
}

async function ensureLive2D() {
  if (Live2DFactory) return Live2DFactory
  const PIXI = await ensurePixi()
  if (typeof window !== 'undefined' && !window.Live2DCubismCore) {
    try {
      await new Promise((resolve) => {
        const existing = document.querySelector('script[src*="live2dcubismcore"]')
        if (existing && window.Live2DCubismCore) { resolve(); return }
        const script = document.createElement('script')
        script.src = '/live2d/live2dcubismcore.min.js'
        script.onload = () => resolve()
        script.onerror = () => resolve()
        document.head.appendChild(script)
      })
    } catch {}
  }
  try {
    const mod = await import('pixi-live2d-display/cubism4')
    Live2DFactory = mod.Live2DModel
    if (typeof Live2DFactory.registerTicker === 'function' && PIXI?.Ticker) {
      try { Live2DFactory.registerTicker(PIXI.Ticker) } catch {}
    }
    return Live2DFactory
  } catch (err) {
    console.warn('[Live2D] Cubism4 runtime import failed:', err)
    return null
  }
}

const FIT_MARGIN = 0.92 // leave a small visible margin so the model never touches the edges

export function Live2DModel({
  url,
  mouthOpen = 0,
  lookAt = { x: 0, y: 0 },
  isBlinking = false,
  emotion = 'idle',
  zoom = 1,
  userPan = AVATAR_DEFAULTS.userPan,
  idleMotion = true,
  resetSignal = 0,
  onTransformChange,
  onReady,
  onError,
}) {
  const mountRef = useRef(null)
  const appRef = useRef(null)
  const modelRef = useRef(null)
  const baseScaleRef = useRef(1)
  const sizeRef = useRef({ w: 320, h: 240 })

  // Refs that drive rendering during gestures (avoid re-renders)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const panRef = useRef(clampUserPan(userPan))
  const idleMotionRef = useRef(idleMotion)
  idleMotionRef.current = idleMotion
  const mouthRef = useRef(mouthOpen)
  mouthRef.current = mouthOpen
  const lookRef = useRef(lookAt)
  lookRef.current = lookAt
  const blinkRef = useRef(isBlinking)
  blinkRef.current = isBlinking
  const emotionRef = useRef(emotion)
  emotionRef.current = emotion
  const loadIdRef = useRef(0)
  const rafRef = useRef(0)

  // Drag state
  const dragRef = useRef(null)

  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [isPanning, setIsPanning] = useState(false)

  const handleReady = useCallback(() => {
    setStatus('ready')
    onReady?.()
  }, [onReady])

  const handleFail = useCallback((message) => {
    setStatus('fallback')
    setLoadError(message || 'Could not load Live2D')
    onError?.(message)
    onReady?.()
  }, [onError, onReady])

  // Apply the current transform (scale + pan) to the model.
  const applyTransform = useCallback(() => {
    const m = modelRef.current
    if (!m) return
    const { w, h } = sizeRef.current
    const safeZoom = clampZoom(zoomRef.current)
    const safePan = clampUserPan(panRef.current)
    try {
      m.scale.set(baseScaleRef.current * safeZoom)
      m.x = w / 2 + safePan.x
      m.y = h / 2 + safePan.y
    } catch {}
  }, [])

  // Schedule a single rAF tick to emit transform changes (avoids re-render thrash).
  const scheduleTransformEmit = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0
      onTransformChange?.(
        clampUserPan(panRef.current),
        clampZoom(zoomRef.current),
      )
    })
  }, [onTransformChange])

  useEffect(() => {
    if (!mountRef.current) return undefined
    const mount = mountRef.current
    let cancelled = false
    let ro = null
    let motionCleanup = null
    const currentLoadId = ++loadIdRef.current

    setStatus('loading')
    setLoadError('')

    const setup = async () => {
      try {
        const PIXI = await ensurePixi()
        if (cancelled || !mountRef.current) return

        const Factory = await ensureLive2D()
        if (cancelled || !mountRef.current) return

        if (!Factory) {
          handleFail('Live2D runtime not supported in this browser')
          return
        }

        // Clean up previous app if any
        if (appRef.current) {
          try {
            appRef.current.destroy(true, { children: true, texture: true, baseTexture: true })
          } catch {}
          appRef.current = null
        }

        const initialW = Math.max(120, mount.clientWidth || 320)
        const initialH = Math.max(120, mount.clientHeight || 240)
        sizeRef.current = { w: initialW, h: initialH }

        const app = new PIXI.Application({
          width: initialW,
          height: initialH,
          backgroundAlpha: 0,
          antialias: false,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 1),
          powerPreference: 'low-power',
        })

        if (cancelled || !mountRef.current) {
          try { app.destroy(true) } catch {}
          return
        }

        appRef.current = app
        mount.appendChild(app.view)
        app.view.style.width = '100%'
        app.view.style.height = '100%'
        app.view.style.display = 'block'
        app.view.style.touchAction = 'none'

        if (!url) {
          handleFail('No Live2D model URL provided')
          return
        }

        let model = null
        try {
          model = await Factory.from(url, { autoInteract: false })
          if (model) {
            model.eventMode = 'none'
            model.interactive = false
          }
        } catch (err) {
          if (!cancelled) handleFail(err?.message || 'Failed to parse Live2D model')
          return
        }

        if (cancelled || !mountRef.current || currentLoadId !== loadIdRef.current) {
          try { model?.destroy?.({ texture: true, baseTexture: true }) } catch {}
          return
        }

        modelRef.current = model

        const w = Math.max(120, mount.clientWidth || 320)
        const h = Math.max(120, mount.clientHeight || 240)
        sizeRef.current = { w, h }
        app.renderer.resize(w, h)

        const mw = model.width || 400
        const mh = model.height || 400
        // Frame the full model: fit by smaller dimension, generous margin, no vertical bias.
        const scale = Math.min(w / mw, h / mh) * FIT_MARGIN
        baseScaleRef.current = scale
        model.anchor?.set?.(0.5, 0.5)
        applyTransform()

        app.stage.addChild(model)

        // Idle motion playback loop
        if (typeof model.motion === 'function') {
          let running = true
          const loop = async () => {
            while (running && currentLoadId === loadIdRef.current && modelRef.current === model) {
              if (!idleMotionRef.current) {
                await new Promise((r) => setTimeout(r, 1000))
                continue
              }
              try {
                const res = await model.motion('Idle')
                if (!res) await new Promise((r) => setTimeout(r, 1200))
              } catch {
                await new Promise((r) => setTimeout(r, 2000))
              }
            }
          }
          loop()
          motionCleanup = () => { running = false }
        }

        // ResizeObserver for dynamic container adjustments
        const onResize = () => {
          if (!mount || !appRef.current || !modelRef.current) return
          const nw = Math.max(120, mount.clientWidth || 320)
          const nh = Math.max(120, mount.clientHeight || 240)
          sizeRef.current = { w: nw, h: nh }
          try {
            appRef.current.renderer.resize(nw, nh)
            const m = modelRef.current
            const mScale = Math.min(nw / (m.width || 400), nh / (m.height || 400)) * FIT_MARGIN
            baseScaleRef.current = mScale
            applyTransform()
          } catch {}
        }
        ro = new ResizeObserver(onResize)
        ro.observe(mount)

        handleReady()
      } catch (err) {
        if (!cancelled) {
          console.warn('[Live2D] Setup error:', err)
          handleFail(err?.message || 'Live2D initialization error')
        }
      }
    }

    setup()

    return () => {
      cancelled = true
      if (motionCleanup) motionCleanup()
      if (ro) ro.disconnect()
      if (modelRef.current) {
        try { modelRef.current.destroy?.({ texture: true, baseTexture: true }) } catch {}
        modelRef.current = null
      }
      if (appRef.current) {
        try {
          const app = appRef.current
          if (mount && mount.contains(app.view)) mount.removeChild(app.view)
          app.destroy(true, { children: true, texture: true, baseTexture: true })
        } catch {}
        appRef.current = null
      }
    }
    // applyTransform / handleFail / handleReady are stable (useCallback) — exclude from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleFail, handleReady, url])

  // Gesture handlers (drag-pan, wheel-zoom, dblclick-reset) bound to the mount.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const onPointerDown = (event) => {
      // Only react to primary button; ignore right-click etc.
      if (event.button !== 0) return
      // Don't grab if the user is interacting with an inner control (e.g. fallback badge)
      const target = event.target
      if (target && target !== mount && !mount.contains(target)) return
      try { mount.setPointerCapture?.(event.pointerId) } catch {}
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPan: { ...panRef.current },
      }
      setIsPanning(true)
      event.preventDefault()
    }

    const onPointerMove = (event) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      panRef.current = clampUserPan({
        x: drag.startPan.x + dx,
        y: drag.startPan.y + dy,
      })
      applyTransform()
      scheduleTransformEmit()
    }

    const releaseDrag = (event) => {
      const drag = dragRef.current
      if (!drag || (event && drag.pointerId !== event.pointerId)) return
      try { mount.releasePointerCapture?.(drag.pointerId) } catch {}
      dragRef.current = null
      setIsPanning(false)
    }

    const onWheel = (event) => {
      // Only respond to plain wheel (not pinch) and ignore ctrl+wheel (browser zoom)
      if (event.ctrlKey) return
      event.preventDefault()
      const rect = mount.getBoundingClientRect()
      const cx = event.clientX - rect.left
      const cy = event.clientY - rect.top
      const { w, h } = sizeRef.current
      // World point currently under the cursor, expressed relative to model center.
      const worldDx = cx - (w / 2 + panRef.current.x)
      const worldDy = cy - (h / 2 + panRef.current.y)
      const delta = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaMode === 2 ? event.deltaY * 800 : event.deltaY
      const factor = Math.exp(-delta * 0.002)
      const oldZoom = clampZoom(zoomRef.current)
      const newZoom = clampZoom(oldZoom * factor)
      // Keep the world point under the cursor: pan' = pan + worldDelta * (1 - oldZoom/newZoom)
      const ratio = oldZoom === 0 ? 1 : (1 - oldZoom / newZoom)
      panRef.current = clampUserPan({
        x: panRef.current.x + worldDx * ratio,
        y: panRef.current.y + worldDy * ratio,
      })
      zoomRef.current = newZoom
      applyTransform()
      scheduleTransformEmit()
    }

    const onDoubleClick = (event) => {
      event.preventDefault()
      panRef.current = { x: 0, y: 0 }
      zoomRef.current = 1
      applyTransform()
      onTransformChange?.(clampUserPan(panRef.current), 1)
    }

    mount.addEventListener('pointerdown', onPointerDown)
    mount.addEventListener('pointermove', onPointerMove)
    mount.addEventListener('pointerup', releaseDrag)
    mount.addEventListener('pointercancel', releaseDrag)
    mount.addEventListener('wheel', onWheel, { passive: false })
    mount.addEventListener('dblclick', onDoubleClick)

    return () => {
      mount.removeEventListener('pointerdown', onPointerDown)
      mount.removeEventListener('pointermove', onPointerMove)
      mount.removeEventListener('pointerup', releaseDrag)
      mount.removeEventListener('pointercancel', releaseDrag)
      mount.removeEventListener('wheel', onWheel)
      mount.removeEventListener('dblclick', onDoubleClick)
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }
  }, [applyTransform, onTransformChange, scheduleTransformEmit])

  // React to prop changes from the parent (HUD slider, reset button).
  useEffect(() => {
    panRef.current = clampUserPan(userPan)
    if (zoom !== undefined) zoomRef.current = clampZoom(zoom)
    applyTransform()
  }, [userPan, zoom, applyTransform])

  // React to the reset signal (bumped by "Reset framing" / "Reset view").
  useEffect(() => {
    if (resetSignal === 0) return
    panRef.current = { x: 0, y: 0 }
    zoomRef.current = 1
    applyTransform()
  }, [resetSignal, applyTransform])

  const showCssFallback = status === 'fallback'

  return (
    <div
      className={`eve-live2d-real is-${emotion} ${isBlinking ? 'is-blinking' : ''}`}
      data-testid="live2d-model"
      role="img"
      aria-label={`Eve Live2D avatar, ${emotion}`}
    >
      <div
        ref={mountRef}
        className={`eve-live2d-mount ${isPanning ? 'is-panning' : ''}`}
      />

      {/* Procedural fallback if Live2D cannot render */}
      {showCssFallback && (
        <div
          className={`eve-vrm-fallback is-${emotion} ${isBlinking ? 'is-blinking' : ''}`}
          style={{
            '--mouth': String(Math.max(0, Math.min(1, mouthOpen))),
            '--look-x': String(lookAt.x),
            '--look-y': String(lookAt.y),
          }}
        >
          <div className="eve-vrm-head">
            <div className="eve-vrm-face">
              <div className="eve-vrm-eyes">
                <span className="eve-vrm-eye left" />
                <span className="eve-vrm-eye right" />
              </div>
              <div className="eve-vrm-mouth" />
              <div className="eve-vrm-blush" />
            </div>
            <div className="eve-vrm-hair" />
          </div>
          <div className="eve-vrm-body">
            <div className="eve-vrm-torso" />
          </div>
          <span className="eve-vrm-url" aria-hidden="true">
            {loadError ? `Fallback — ${loadError}` : 'Live2D Haru ready'}
          </span>
        </div>
      )}

      {status === 'loading' && <span className="eve-live2d-badge">Loading Live2D…</span>}
      {status === 'fallback' && loadError && (
        <span className="eve-live2d-badge" title={loadError}>{loadError}</span>
      )}
    </div>
  )
}

// Keep `AVATAR_LIMITS` reachable for callers that import only Live2DModel
export { AVATAR_LIMITS }
