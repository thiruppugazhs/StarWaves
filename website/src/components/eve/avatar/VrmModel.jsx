import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Clock,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
import { AVATAR_DEFAULTS, clampUserPan, clampZoom } from './avatarConstants'

// GLTF + VRM loader modules are only needed when a model URL actually loads —
// fetched on demand so the placeholder scene never pays for them. Cached at
// module scope across mounts.
let vrmLoaderModules = null

async function ensureVrmLoader() {
  if (!vrmLoaderModules) {
    const [{ GLTFLoader }, { VRMLoaderPlugin, VRMUtils }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('@pixiv/three-vrm'),
    ])
    vrmLoaderModules = { GLTFLoader, VRMLoaderPlugin, VRMUtils }
  }
  return vrmLoaderModules
}

// VRM faces +Z by spec; the camera sits on +Z so no yaw offset is needed.
const BASE_CAMERA_DISTANCE = 1.1
const AUTO_ROTATE_SPEED = 0.35
// Emotion expression keys cross-faded each frame (module scope: no per-frame alloc).
const EMOTION_EXPRESSION_KEYS = ['happy', 'angry', 'relaxed']

export function VrmModel({
  url,
  mouthOpen = 0,
  lookAt = { x: 0, y: 0 },
  isBlinking = false,
  emotion = 'idle',
  zoom = 1,
  userPan = AVATAR_DEFAULTS.userPan,
  autoRotate = false,
  idleMotion = true,
  resetSignal = 0,
  onTransformChange,
  onReady,
  onError,
}) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const vrmRef = useRef(null)
  const rafRef = useRef(0)
  const mouthRef = useRef(0)
  const lookRef = useRef({ x: 0, y: 0 })
  const blinkRef = useRef(false)
  const emotionRef = useRef(emotion)
  const yawRef = useRef(0)
  const autoRotateRef = useRef(false)
  const idleMotionRef = useRef(true)
  const swayTimeRef = useRef(0)
  const hipsBaseYRef = useRef(null)
  const exprRef = useRef({ happy: 0, angry: 0, relaxed: 0 })
  // User-driven framing (pan + zoom) — refs so gestures don't re-render.
  const userPanRef = useRef(clampUserPan(userPan))
  const zoomRef = useRef(clampZoom(zoom))
  const sizeRef = useRef({ w: 320, h: 240 })
  const dragRef = useRef(null)
  const transformRafRef = useRef(0)
  const [isPanning, setIsPanning] = useState(false)
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')

  mouthRef.current = mouthOpen
  lookRef.current = lookAt
  blinkRef.current = isBlinking
  emotionRef.current = emotion
  autoRotateRef.current = autoRotate
  idleMotionRef.current = idleMotion

  const handleReady = useCallback(() => {
    setStatus('ready')
    onReady?.()
  }, [onReady])

  // Mount effect owns the WebGL context for the component lifetime — it must
  // not re-run when parent callbacks change, so the latest handler is read
  // through a ref instead of being listed as an effect dependency.
  const readyRef = useRef(handleReady)
  readyRef.current = handleReady

  const handleFail = useCallback((message) => {
    setStatus('fallback')
    setLoadError(message || 'Could not load VRM')
    onError?.(message)
    // still signal ready so outer doesn't stay in timeout
    onReady?.()
  }, [onError, onReady])

  // Apply the current user pan + zoom to the camera. Pan moves the camera in
  // world XY; zoom scales its distance from the model so the apparent size
  // changes without distorting perspective.
  const applyFraming = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return
    const safeZoom = clampZoom(zoomRef.current)
    const safePan = clampUserPan(userPanRef.current)
    camera.position.x = safePan.x * 0.1
    camera.position.y = 1.35 + safePan.y * 0.1
    camera.position.z = BASE_CAMERA_DISTANCE / Math.max(0.1, safeZoom)
    camera.lookAt(0, 1.35, 0)
  }, [])

  const scheduleTransformEmit = useCallback(() => {
    if (transformRafRef.current) return
    transformRafRef.current = window.requestAnimationFrame(() => {
      transformRafRef.current = 0
      onTransformChange?.(
        clampUserPan(userPanRef.current),
        clampZoom(zoomRef.current),
      )
    })
  }, [onTransformChange])

  useEffect(() => {
    if (!mountRef.current) return undefined
    const mount = mountRef.current
    // Ensure mount has size even before layout (Avatar Studio preview 360px)
    const rect = mount.getBoundingClientRect()
    const width = Math.max(320, rect.width || mount.clientWidth || 320)
    const height = Math.max(240, rect.height || mount.clientHeight || 280)

    const scene = new Scene()
    scene.background = new Color(0x000000)
    scene.background = null
    sceneRef.current = scene

    const camera = new PerspectiveCamera(30, width / height, 0.1, 20)
    camera.position.set(0, 1.35, BASE_CAMERA_DISTANCE)
    cameraRef.current = camera

    let renderer
    try {
      // low-power + DPR 1.0 saves memory on low-end PCs
      renderer = new WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' })
    } catch {
      setStatus('fallback')
      readyRef.current()
      return undefined
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.0))
    renderer.setSize(width, height)
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = NoToneMapping
    rendererRef.current = renderer
    mount.appendChild(renderer.domElement)
    // Ensure canvas fills mount
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'

    const ambient = new HemisphereLight(0xffffff, 0x222222, 1.2)
    const dir = new DirectionalLight(0xffffff, 1.0)
    dir.position.set(1, 2, 2)
    scene.add(ambient, dir)

    // fallback procedural torso/head when no url
    const placeholder = new Group()
    const headGeo = new SphereGeometry(0.28, 24, 18)
    const headMat = new MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.7 })
    const head = new Mesh(headGeo, headMat)
    head.position.set(0, 1.45, 0)
    head.name = 'fallback-head'
    placeholder.add(head)
    scene.add(placeholder)

    const clock = new Clock()
    let visible = true
    const visibilityObserver = new IntersectionObserver(
      (entries) => { visible = entries[0]?.isIntersecting !== false },
      { threshold: 0 },
    )
    visibilityObserver.observe(mount)
    const onVisibility = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      } else if (!rafRef.current) {
        animate()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      if (!visible || document.hidden) return
      const delta = clock.getDelta()

      // VRM update
      const vrm = vrmRef.current
      if (vrm) {
        // user orbit (drag) + optional turntable — yaw applied every frame
        if (autoRotateRef.current) yawRef.current += delta * AUTO_ROTATE_SPEED
        vrm.scene.rotation.y = yawRef.current
        // idle sway — hips bob + spine drift (skipped under reduced motion)
        if (idleMotionRef.current) {
          swayTimeRef.current += delta
          const t = swayTimeRef.current
          const hips = vrm.humanoid?.getNormalizedBoneNode('hips')
          if (hips && hipsBaseYRef.current !== null) {
            hips.position.y = hipsBaseYRef.current + Math.sin(t * 1.4) * 0.008
          }
          const spine = vrm.humanoid?.getNormalizedBoneNode('spine')
          if (spine) {
            spine.rotation.x = Math.sin(t * 0.9) * 0.02
            spine.rotation.z = Math.sin(t * 0.7) * 0.015
          }
        }
        // mouth: map to VRM blendShapes (aa, ih, ee, oh) and jaw
        const mouth = MathUtils.clamp(mouthRef.current, 0, 1)
        // smooth
        vrm.expressionManager?.setValue('aa', mouth * 0.9)
        vrm.expressionManager?.setValue('oh', mouth * 0.35)
        // lookAt via VRM lookAt
        if (vrm.lookAt) {
          // head bone drives lookAt when VRM lookAt rig exists
          // approximate: rotate head via humanoid bone
          const headBone = vrm.humanoid?.getNormalizedBoneNode('head')
          if (headBone) {
            headBone.rotation.y = MathUtils.lerp(headBone.rotation.y, lookRef.current.x * 0.45, 0.08)
            headBone.rotation.x = MathUtils.lerp(headBone.rotation.x, -lookRef.current.y * 0.3, 0.08)
          }
          // blink
          vrm.expressionManager?.setValue('blink', blinkRef.current ? 1 : 0)
          vrm.expressionManager?.setValue('blinkLeft', blinkRef.current ? 1 : 0)
          vrm.expressionManager?.setValue('blinkRight', blinkRef.current ? 1 : 0)
        }
        // emotion → expression (damped so states cross-fade, and stale
        // weights decay back to neutral instead of sticking forever)
        const emo = emotionRef.current
        const emoTargets = emo === 'tool' ? { happy: 0.35, angry: 0, relaxed: 0 }
          : emo === 'error' ? { happy: 0, angry: 0.5, relaxed: 0 }
          : emo === 'thinking' ? { happy: 0, angry: 0, relaxed: 0.4 }
          : { happy: 0, angry: 0, relaxed: 0 }
        const blend = 1 - Math.exp(-delta * 6)
        const expr = exprRef.current
        for (const key of EMOTION_EXPRESSION_KEYS) {
          expr[key] += (emoTargets[key] - expr[key]) * blend
          vrm.expressionManager?.setValue(key, expr[key])
        }
        vrm.update(delta)
      } else {
        // fallback head bob + mouth scale morph
        const mouth = MathUtils.clamp(mouthRef.current, 0, 1)
        head.scale.y = 1 + mouth * 0.18
        head.scale.x = 1 - mouth * 0.06
        // subtle breathe when not speaking
        if (emotionRef.current === 'idle' && mouth < 0.05) {
          head.position.y = 1.45 + Math.sin(performance.now() * 0.0012) * 0.015
        }
        // look
        head.rotation.y = MathUtils.lerp(head.rotation.y, lookRef.current.x * 0.35, 0.06)
        head.rotation.x = MathUtils.lerp(head.rotation.x, -lookRef.current.y * 0.22, 0.06)
        // blink via scale
        const targetScaleY = blinkRef.current ? 0.08 : 1
        head.scale.y *= MathUtils.lerp(1, targetScaleY, blinkRef.current ? 0.9 : 0.12)
      }

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const w = mount.clientWidth || 320
      const h = mount.clientHeight || 240
      sizeRef.current = { w, h }
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    // Drag-to-pan + wheel-to-zoom + double-click-to-reset.
    // Session-only pan/zoom; reset on remount or via resetSignal.
    mount.style.touchAction = 'none'
    mount.style.cursor = 'grab'
    const onPointerDown = (event) => {
      if (event.button !== 0) return
      try { mount.setPointerCapture(event.pointerId) } catch {}
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPan: { ...userPanRef.current },
      }
      setIsPanning(true)
      event.preventDefault()
    }
    const onPointerMove = (event) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      userPanRef.current = clampUserPan({
        x: drag.startPan.x + dx,
        y: drag.startPan.y + dy,
      })
      applyFraming()
      scheduleTransformEmit()
    }
    const releaseDrag = (event) => {
      const drag = dragRef.current
      if (!drag || (event && drag.pointerId !== event.pointerId)) return
      try { mount.releasePointerCapture(drag.pointerId) } catch {}
      dragRef.current = null
      setIsPanning(false)
    }
    const onWheel = (event) => {
      if (event.ctrlKey) return
      event.preventDefault()
      const delta = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaMode === 2 ? event.deltaY * 800 : event.deltaY
      const factor = Math.exp(-delta * 0.002)
      const oldZoom = clampZoom(zoomRef.current)
      const newZoom = clampZoom(oldZoom * factor)
      zoomRef.current = newZoom
      applyFraming()
      scheduleTransformEmit()
    }
    const onDoubleClick = (event) => {
      event.preventDefault()
      userPanRef.current = { x: 0, y: 0 }
      zoomRef.current = 1
      applyFraming()
      onTransformChange?.(clampUserPan(userPanRef.current), 1)
    }
    mount.addEventListener('pointerdown', onPointerDown)
    mount.addEventListener('pointermove', onPointerMove)
    mount.addEventListener('pointerup', releaseDrag)
    mount.addEventListener('pointercancel', releaseDrag)
    mount.addEventListener('wheel', onWheel, { passive: false })
    mount.addEventListener('dblclick', onDoubleClick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      ro.disconnect()
      visibilityObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      mount.removeEventListener('pointerdown', onPointerDown)
      mount.removeEventListener('pointermove', onPointerMove)
      mount.removeEventListener('pointerup', releaseDrag)
      mount.removeEventListener('pointercancel', releaseDrag)
      mount.removeEventListener('wheel', onWheel)
      mount.removeEventListener('dblclick', onDoubleClick)
      if (transformRafRef.current) {
        window.cancelAnimationFrame(transformRafRef.current)
        transformRafRef.current = 0
      }
      try { mount.removeChild(renderer.domElement) } catch {}
      renderer.dispose()
      if (vrmRef.current) {
        vrmLoaderModules?.VRMUtils?.deepDispose(vrmRef.current.scene)
        vrmRef.current = null
      }
    }
    // applyFraming / scheduleTransformEmit / onTransformChange are stable refs
    // (useCallback) — intentionally excluded so the WebGL mount effect runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // camera zoom from Studio prefs.
  useEffect(() => {
    if (zoom !== undefined) zoomRef.current = clampZoom(zoom)
    applyFraming()
  }, [zoom, applyFraming])

  // React to prop changes from the parent (HUD framing reset, persisted state).
  useEffect(() => {
    userPanRef.current = clampUserPan(userPan)
    applyFraming()
  }, [userPan, applyFraming])

  // Studio "Reset view" / "Reset framing" — clear both yaw and user framing.
  useEffect(() => {
    if (resetSignal === 0) return
    yawRef.current = 0
    userPanRef.current = { x: 0, y: 0 }
    zoomRef.current = 1
    applyFraming()
  }, [resetSignal, applyFraming])

  // load VRM/GLB when url changes
  useEffect(() => {
    if (!url) {
      setStatus('fallback')
      handleReady()
      return
    }
    let cancelled = false
    // Bundled anime VRM — fetch HEAD then load; fallback to CSS avatar if missing
    const bundled = ['/avatars/vrm/eve-anime.vrm']
    if (bundled.includes(url)) {
      fetch(url, { method: 'HEAD' }).then((r) => {
        if (cancelled) return
        if (!r.ok) {
          setStatus('fallback')
          handleReady()
        } else {
          doLoad(url)
        }
      }).catch(() => {
        if (cancelled) return
        setStatus('fallback')
        handleReady()
      })
      return () => { cancelled = true }
    }
    doLoad(url)
    return () => { cancelled = true }

    async function doLoad(targetUrl) {
      setStatus('loading')
      setLoadError('')
      let loaderMods
      try {
        loaderMods = await ensureVrmLoader()
      } catch {
        if (!cancelled) handleFail('Failed to load 3D runtime')
        return
      }
      if (cancelled) return
      const { GLTFLoader, VRMLoaderPlugin, VRMUtils } = loaderMods
      const loader = new GLTFLoader()
      loader.register((parser) => new VRMLoaderPlugin(parser))
      loader.load(
        targetUrl,
        (gltf) => {
          if (cancelled) return
          const vrm = gltf.userData.vrm
          if (!vrm) {
            handleFail('Not a valid VRM — showing fallback')
            return
          }
          // optimize: combine skinned-mesh skeletons (fewer bone-matrix
          // calculations per frame); fall back to the legacy joint trimmer
          // on older three-vrm runtimes.
          VRMUtils.removeUnnecessaryVertices(gltf.scene)
          if (typeof VRMUtils.combineSkeletons === 'function') {
            VRMUtils.combineSkeletons(gltf.scene)
          } else if (typeof VRMUtils.removeUnnecessaryJoints === 'function') {
            VRMUtils.removeUnnecessaryJoints(gltf.scene)
          }
          // VRM faces +Z by spec — no yaw offset so the model faces the camera.
          vrm.scene.rotation.y = yawRef.current
          // add to scene
          const scene = sceneRef.current
          if (scene) {
            // remove placeholder head if present
            const ph = scene.getObjectByName('fallback-head')
            if (ph && ph.parent) ph.parent.remove(ph)
            scene.add(vrm.scene)
          }
          vrmRef.current = vrm
          // anchor for the idle-sway bob (absolute writes need the bind pose)
          try {
            hipsBaseYRef.current = vrm.humanoid?.getNormalizedBoneNode('hips')?.position.y ?? null
          } catch {
            hipsBaseYRef.current = null
          }
          handleReady()
        },
        undefined,
        (err) => {
          if (!cancelled) handleFail(err?.message || 'Failed to load VRM')
        },
      )
    }
  }, [handleFail, handleReady, url])

  if (status === 'fallback' && loadError) {
    // still render fallback canvas (mounted) but show badge
  }

  const showCssFallback = status !== 'ready'

  return (
    <div
      className={`eve-vrm-real is-${emotion} ${isBlinking ? 'is-blinking' : ''}`}
      data-testid="vrm-model"
      role="img"
      aria-label={`Eve VRM avatar, ${emotion}`}
    >
      <div ref={mountRef} className={`eve-vrm-mount ${isPanning ? 'is-panning' : ''}`} />
      {/* CSS procedural fallback — always visible until VRM ready, ensures the grey bar never appears empty */}
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
          <span className="eve-vrm-url" aria-hidden="true">{status === 'loading' ? 'Loading 3D — anime VRM 10MB…' : (loadError ? 'Fallback — CSS avatar' : 'Anime VRM ready')}</span>
        </div>
      )}
      {status === 'loading' && <span className="eve-vrm-badge">Loading 3D…</span>}
      {status === 'fallback' && loadError && (
        <span className="eve-vrm-badge" title={loadError}>{loadError}</span>
      )}
    </div>
  )
}
