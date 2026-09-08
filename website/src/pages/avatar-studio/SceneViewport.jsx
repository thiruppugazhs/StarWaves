import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'

let loaderModulesPromise

function loadLoaderModules() {
  if (!loaderModulesPromise) {
    loaderModulesPromise = Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('@pixiv/three-vrm'),
      import('three/addons/exporters/GLTFExporter.js'),
      import('three/addons/loaders/OBJLoader.js'),
      import('three/addons/loaders/FBXLoader.js'),
      import('three/addons/loaders/MTLLoader.js'),
    ]).then(([gltf, vrm, exporter, obj, fbx, mtl]) => ({
      GLTFLoader: gltf.GLTFLoader,
      VRMLoaderPlugin: vrm.VRMLoaderPlugin,
      GLTFExporter: exporter.GLTFExporter,
      OBJLoader: obj.OBJLoader,
      FBXLoader: fbx.FBXLoader,
      MTLLoader: mtl.MTLLoader,
    }))
  }
  return loaderModulesPromise
}

function toArray(vector) {
  return [Number(vector.x.toFixed(4)), Number(vector.y.toFixed(4)), Number(vector.z.toFixed(4))]
}

function themeColor(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const color = new THREE.Color()
  if (value) color.setStyle(value)
  return color
}

function createNodeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
}

function formatFromSource(source) {
  if (source?.format) return String(source.format).toLowerCase()
  const name = source?.file?.name || source?.url || ''
  return String(name).toLowerCase().split('.').pop() || 'glb'
}

function canvasForTexture(material) {
  const image = material?.map?.image
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(1024, Math.max(32, image?.width || 512))
  canvas.height = Math.min(1024, Math.max(32, image?.height || 512))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Texture painting is unavailable in this browser.')
  if (image) {
    try { context.drawImage(image, 0, 0, canvas.width, canvas.height) } catch { /* Cross-origin textures are reported as unavailable below. */ }
  } else {
    context.fillStyle = `#${material?.color?.getHexString?.() || 'ffffff'}`
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  return canvas
}

export const SceneViewport = forwardRef(function SceneViewport({ source, nodes = [], camera: savedCamera = null, selectedNodeId, tool, showGrid = true, showAxes = true, animationFrame = 0, activeAnimationId = null, playing = false, paintSettings = null, onSceneGraph, onSelectNode, onNodeTransform, onMaterialChange, onTextureChange, onCameraChange, onAnimationClips, resetSignal, onStatus }, ref) {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const transformRef = useRef(null)
  const rootRef = useRef(null)
  const nodeMapRef = useRef(new Map())
  const nodesRef = useRef(nodes)
  const selectedNodeIdRef = useRef(selectedNodeId)
  const toolRef = useRef(tool)
  const paintSettingsRef = useRef(paintSettings)
  const textureChangeRef = useRef(onTextureChange)
  const animationClipsRef = useRef(onAnimationClips)
  const statusRef = useRef(onStatus)
  const savedCameraRef = useRef(savedCamera)
  const selectedMaterialsRef = useRef(new Map())
  const mixerRef = useRef(null)
  const clipsRef = useRef([])
  const paintStateRef = useRef({ active: false, object: null, material: null, canvas: null, context: null })

  nodesRef.current = nodes
  savedCameraRef.current = savedCamera
  selectedNodeIdRef.current = selectedNodeId
  toolRef.current = tool
  paintSettingsRef.current = paintSettings
  textureChangeRef.current = onTextureChange
  animationClipsRef.current = onAnimationClips
  statusRef.current = onStatus

  useImperativeHandle(ref, () => {
    const serializeSceneGraph = () => [...nodeMapRef.current.values()].map((object) => {
      const material = object.isMesh ? (Array.isArray(object.material) ? object.material[0] : object.material) : null
      return {
        id: object.userData.nodeId,
        name: object.name,
        type: object.type,
        visible: object.visible,
        position: toArray(object.position),
        rotation: toArray(object.rotation),
        scale: toArray(object.scale),
        parentId: object.parent?.userData?.nodeId || null,
        isMesh: Boolean(object.isMesh),
        hasUv: Boolean(object.isMesh && object.geometry?.getAttribute?.('uv')),
        hasTexture: Boolean(material?.map),
        materialColor: material?.color ? `#${material.color.getHexString()}` : null,
        metalness: material?.metalness ?? 0,
        roughness: material?.roughness ?? 0.5,
        opacity: material?.opacity ?? 1,
        textureDataUrl: object.userData.textureDataUrl || null,
        materialSlots: Array.isArray(object.material) ? object.material.map((item) => item?.name || 'Material') : material ? [material.name || 'Material'] : [],
      }
    })
    const disposeObject = (object) => object.traverse((child) => {
      child.geometry?.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => material?.dispose?.())
    })

    return ({
    addPrimitive: (type = 'box') => {
      const editorScene = sceneRef.current
      if (!editorScene) return null
      const root = rootRef.current || new THREE.Group()
      if (!rootRef.current) {
        root.name = 'Scene'
        rootRef.current = root
        editorScene.add(root)
      }
      const geometry = type === 'sphere' ? new THREE.SphereGeometry(0.5, 24, 16) : type === 'cylinder' ? new THREE.CylinderGeometry(0.45, 0.45, 1, 24) : new THREE.BoxGeometry(0.8, 0.8, 0.8)
      const material = new THREE.MeshStandardMaterial({ color: themeColor('--color-primary'), roughness: 0.45, metalness: 0.15 })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = `${type[0].toUpperCase()}${type.slice(1)} primitive`
      mesh.userData.nodeId = createNodeId()
      mesh.position.set(0, 0.5, 0)
      root.add(mesh)
      nodeMapRef.current.set(mesh.userData.nodeId, mesh)
      onSceneGraph?.(serializeSceneGraph())
      onSelectNode?.(mesh.userData.nodeId)
      return mesh.userData.nodeId
    },
    duplicateNode: (nodeId) => {
      const object = nodeMapRef.current.get(nodeId)
      if (!object?.parent) return null
      const clone = object.clone(true)
      const idMap = new Map()
      clone.traverse((child) => {
        const nextId = createNodeId()
        idMap.set(child, nextId)
        child.userData = { ...child.userData, nodeId: nextId }
        nodeMapRef.current.set(nextId, child)
      })
      clone.position.x += 0.25
      object.parent.add(clone)
      onSceneGraph?.(serializeSceneGraph())
      onSelectNode?.(idMap.get(clone))
      return idMap.get(clone)
    },
    deleteNode: (nodeId) => {
      const object = nodeMapRef.current.get(nodeId)
      if (!object?.parent) return false
      const removed = []
      object.traverse((child) => {
        if (child.userData?.nodeId) removed.push(child.userData.nodeId)
      })
      object.parent.remove(object)
      disposeObject(object)
      removed.forEach((id) => nodeMapRef.current.delete(id))
      onSceneGraph?.(serializeSceneGraph())
      onSelectNode?.(null)
      return true
    },
    exportScene: async (format = 'glb') => {
      const root = rootRef.current
      if (!root) throw new Error('Load a 3D model before exporting.')
      const { GLTFExporter } = await loadLoaderModules()
      const exporter = new GLTFExporter()
      const result = await new Promise((resolve, reject) => exporter.parse(root, resolve, reject, {
        binary: format === 'glb' || format === 'vrm',
        includeCustomExtensions: true,
      }))
      const isBinary = result instanceof ArrayBuffer
      const blob = new Blob([isBinary ? result : JSON.stringify(result)], { type: isBinary ? 'model/gltf-binary' : 'model/gltf+json' })
      return { blob, filename: `avatar-scene.${format === 'vrm' ? 'vrm' : format}` }
    },
    setAnimationFrame: (frame, fps = 24) => {
      const mixer = mixerRef.current
      if (!mixer || !clipsRef.current.length) return false
      const clip = clipsRef.current.find((item) => item.name === activeAnimationId || item.uuid === activeAnimationId) || clipsRef.current[0]
      mixer.setTime(Math.max(0, Number(frame)) / Math.max(1, Number(fps)))
      return Boolean(clip)
    },
    })
  }, [activeAnimationId, onSceneGraph, onSelectNode])

  useEffect(() => {
    nodes.forEach((node) => {
      const object = nodeMapRef.current.get(node.id)
      if (!object) return
      object.visible = node.visible !== false
      if (Array.isArray(node.position)) object.position.set(...node.position)
      if (Array.isArray(node.rotation)) object.rotation.set(...node.rotation)
      if (Array.isArray(node.scale)) object.scale.set(...node.scale)
      if (node.textureDataUrl && object.isMesh) {
        const material = Array.isArray(object.material) ? object.material[0] : object.material
        const image = new Image()
        image.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = image.width
          canvas.height = image.height
          canvas.getContext('2d')?.drawImage(image, 0, 0)
          const texture = new THREE.CanvasTexture(canvas)
          if (material) {
            material.map?.dispose?.()
            material.map = texture
            material.needsUpdate = true
          }
        }
        image.src = node.textureDataUrl
      }
    })
  }, [nodes])

  useEffect(() => {
    const mixer = mixerRef.current
    if (!mixer || !clipsRef.current.length) return
    const clip = clipsRef.current.find((item) => item.uuid === activeAnimationId || item.name === activeAnimationId) || clipsRef.current[0]
    if (!clip) return
    mixer.stopAllAction()
    const action = mixer.clipAction(clip)
    action.reset()
    action.play()
    action.paused = !playing
    mixer.setTime(Math.max(0, Number(animationFrame)) / Math.max(1, Number(clip.userData?.fps || 24)))
  }, [activeAnimationId, animationFrame, playing])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const editorScene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000)
    camera.position.set(0, 1.3, 3.5)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    container.appendChild(renderer.domElement)

    const grid = new THREE.GridHelper(12, 24, themeColor('--color-primary'), themeColor('--border-heavy'))
    grid.position.y = 0
    grid.name = 'Studio grid'
    editorScene.add(grid)
    const axes = new THREE.AxesHelper(1.5)
    axes.name = 'Studio axes'
    editorScene.add(axes)
    editorScene.add(new THREE.HemisphereLight(themeColor('--text-primary'), themeColor('--border-color'), 2.4))
    const keyLight = new THREE.DirectionalLight(themeColor('--text-primary'), 3)
    keyLight.position.set(3, 5, 4)
    keyLight.castShadow = true
    editorScene.add(keyLight)
    const fillLight = new THREE.PointLight(themeColor('--color-accent'), 2, 10)
    fillLight.position.set(-3, 2, 2)
    editorScene.add(fillLight)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 1, 0)
    controls.addEventListener('change', () => onCameraChange?.({ position: toArray(camera.position), target: toArray(controls.target) }))
    const transform = new TransformControls(camera, renderer.domElement)
    transform.addEventListener('dragging-changed', (event) => { controls.enabled = !event.value })
    transform.addEventListener('objectChange', () => {
      const object = transform.object
      if (!object?.userData?.nodeId) return
      onNodeTransform?.(object.userData.nodeId, {
        position: toArray(object.position),
        rotation: toArray(object.rotation),
        scale: toArray(object.scale),
      })
    })
    editorScene.add(transform)
    sceneRef.current = editorScene
    cameraRef.current = camera
    rendererRef.current = renderer
    controlsRef.current = controls
    transformRef.current = transform

    const resize = () => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    let frame = 0
    const animate = () => {
      controls.update()
      renderer.render(editorScene, camera)
      frame = requestAnimationFrame(animate)
    }
    animate()

    const raycast = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      const pointer = new THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(pointer, camera)
      return raycaster.intersectObjects(rootRef.current ? [rootRef.current] : [], true)
    }
    const paintAt = (event) => {
      const hit = raycast(event).find((item) => item.object.isMesh && item.uv)
      if (!hit) {
        statusRef.current?.('Texture painting requires a selectable mesh with UVs.')
        return false
      }
      const object = hit.object
      const material = Array.isArray(object.material) ? object.material[hit.face?.materialIndex || 0] : object.material
      if (!material || !object.geometry?.getAttribute?.('uv')) {
        statusRef.current?.('This mesh does not expose paintable UV coordinates.')
        return false
      }
      let canvas = object.userData.paintCanvas
      if (!canvas) {
        try { canvas = canvasForTexture(material) } catch (error) {
          statusRef.current?.(error?.message || 'Texture painting is unavailable.')
          return false
        }
        object.userData.paintCanvas = canvas
      }
      const context = canvas.getContext('2d')
      if (!context) return false
      const settings = paintSettingsRef.current || {}
      const x = hit.uv.x * canvas.width
      const y = (1 - hit.uv.y) * canvas.height
      const radius = Math.max(1, (Number(settings.size || 24) / 100) * Math.min(canvas.width, canvas.height))
      context.save()
      context.globalAlpha = Math.max(0.01, Math.min(1, Number(settings.strength ?? 1)))
      context.globalCompositeOperation = settings.mode === 'erase' ? 'destination-out' : 'source-over'
      context.fillStyle = settings.color || '#a83b59'
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
      context.restore()
      const texture = material.map || new THREE.CanvasTexture(canvas)
      texture.image = canvas
      texture.needsUpdate = true
      material.map = texture
      material.needsUpdate = true
      const textureDataUrl = canvas.toDataURL('image/png')
      object.userData.textureDataUrl = textureDataUrl
      textureChangeRef.current?.({ nodeId: object.userData.nodeId, textureDataUrl })
      return true
    }
    const pointerDown = (event) => {
      if (transform.dragging) return
      if (toolRef.current === 'paint') {
        paintStateRef.current.active = paintAt(event)
        if (paintStateRef.current.active) renderer.domElement.setPointerCapture?.(event.pointerId)
        return
      }
      if (toolRef.current !== 'select') return
      const hit = raycast(event).find((item) => item.object.userData.nodeId)
      onSelectNode?.(hit?.object?.userData?.nodeId || null)
    }
    const pointerMove = (event) => {
      if (paintStateRef.current.active && toolRef.current === 'paint') paintAt(event)
    }
    const pointerUp = (event) => {
      paintStateRef.current.active = false
      renderer.domElement.releasePointerCapture?.(event.pointerId)
    }
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointermove', pointerMove)
    renderer.domElement.addEventListener('pointerup', pointerUp)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', pointerDown)
      renderer.domElement.removeEventListener('pointermove', pointerMove)
      renderer.domElement.removeEventListener('pointerup', pointerUp)
      transform.dispose()
      controls.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [onCameraChange, onNodeTransform, onSelectNode])

  useEffect(() => {
    const transform = transformRef.current
    const object = nodeMapRef.current.get(selectedNodeId)
    if (!transform) return
    if (!object || tool === 'select' || tool === 'sculpt' || tool === 'paint' || tool === 'rig') {
      transform.detach()
      return
    }
    transform.setMode(tool === 'rotate' ? 'rotate' : tool === 'scale' ? 'scale' : 'translate')
    transform.attach(object)
  }, [selectedNodeId, tool])

  useEffect(() => {
    const grid = sceneRef.current?.getObjectByName('Studio grid')
    const axes = sceneRef.current?.getObjectByName('Studio axes')
    if (grid) grid.visible = showGrid
    if (axes) axes.visible = showAxes
  }, [showAxes, showGrid])

  useEffect(() => {
    if (!resetSignal || !cameraRef.current || !controlsRef.current) return
    cameraRef.current.position.set(0, 1.3, 3.5)
    controlsRef.current.target.set(0, 1, 0)
    controlsRef.current.update()
  }, [resetSignal])

  useEffect(() => {
    selectedMaterialsRef.current.forEach((color, material) => material.emissive?.copy(color))
    selectedMaterialsRef.current.clear()
    const root = rootRef.current
    if (!root || !selectedNodeId) return
    const object = nodeMapRef.current.get(selectedNodeId)
    if (object) object.traverse((child) => {
      if (!child.isMesh) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        if (!material?.emissive) return
        selectedMaterialsRef.current.set(material, material.emissive.clone())
        material.emissive.copy(themeColor('--color-primary'))
      })
    })
  }, [selectedNodeId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!source?.url && !source?.file) return
      const editorScene = sceneRef.current
      if (!editorScene) return
      if (rootRef.current) {
        editorScene.remove(rootRef.current)
        rootRef.current.traverse((child) => { if (child.geometry) child.geometry.dispose() })
        rootRef.current = null
        nodeMapRef.current.clear()
      }
      mixerRef.current?.stopAllAction?.()
      mixerRef.current = null
      clipsRef.current = []
      onAnimationClips?.([])
      statusRef.current?.('loading')
      try {
        const { GLTFLoader, VRMLoaderPlugin, OBJLoader, FBXLoader, MTLLoader } = await loadLoaderModules()
        const format = formatFromSource(source)
        const manager = new THREE.LoadingManager()
        const objectUrls = []
        if (source.files?.length) {
          const fileMap = new Map(source.files.flatMap((file) => [[file.name, file], [file.webkitRelativePath, file]]))
          manager.setURLModifier((url) => {
            const decoded = decodeURIComponent(url)
            const name = decoded.split('/').pop()
            const file = fileMap.get(decoded) || fileMap.get(name)
            if (!file) return url
            const objectUrl = URL.createObjectURL(file)
            objectUrls.push(objectUrl)
            return objectUrl
          })
        }
        const onLoaded = (root, animations = [], metadata = {}) => {
          if (cancelled) return
          if (!root) throw new Error('The model did not contain a scene.')
          root.userData.vrm = metadata.vrm || null
          root.userData.originalGltfExtensions = metadata.extensions || null
          root.userData.sourceFormat = format
          const persistedNodes = nodesRef.current
          const usedPersistedIds = new Set()
          root.traverse((object) => {
            if (!object.name) object.name = object.type
            const persistedNode = persistedNodes.find((node) => !usedPersistedIds.has(node.id) && node.name === object.name && node.type === object.type)
            const nodeId = persistedNode?.id || createNodeId()
            if (persistedNode) usedPersistedIds.add(persistedNode.id)
            object.userData.nodeId = nodeId
            if (persistedNode) {
              object.visible = persistedNode.visible !== false
              if (Array.isArray(persistedNode.position)) object.position.set(...persistedNode.position)
              if (Array.isArray(persistedNode.rotation)) object.rotation.set(...persistedNode.rotation)
              if (Array.isArray(persistedNode.scale)) object.scale.set(...persistedNode.scale)
              if (persistedNode.textureDataUrl) object.userData.textureDataUrl = persistedNode.textureDataUrl
            }
            object.castShadow = true
            object.receiveShadow = true
            nodeMapRef.current.set(nodeId, object)
          })
          rootRef.current = root
          editorScene.add(root)
          const box = new THREE.Box3().setFromObject(root)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const radius = Math.max(size.x, size.y, size.z, 1)
          root.position.sub(new THREE.Vector3(center.x, box.min.y, center.z))
          const savedCamera = savedCameraRef.current
          const targetY = Math.max(0.5, size.y * 0.45)
          const framingDistance = radius / (2 * Math.tan(THREE.MathUtils.degToRad(cameraRef.current.fov / 2))) * 1.15
          if (Array.isArray(savedCamera?.position) && Array.isArray(savedCamera?.target)) {
            cameraRef.current.position.fromArray(savedCamera.position)
            controlsRef.current.target.fromArray(savedCamera.target)
          } else {
            cameraRef.current.position.set(0, targetY, Math.max(1.5, framingDistance))
            controlsRef.current.target.set(0, targetY, 0)
          }
          controlsRef.current.update()
          const nodes = []
          root.traverse((object) => {
            if (object === root || !object.userData.nodeId) return
            const material = object.isMesh ? (Array.isArray(object.material) ? object.material[0] : object.material) : null
            nodes.push({ id: object.userData.nodeId, name: object.name, type: object.type, visible: object.visible, position: toArray(object.position), rotation: toArray(object.rotation), scale: toArray(object.scale), parentId: object.parent?.userData?.nodeId || null, isMesh: Boolean(object.isMesh), hasUv: Boolean(object.isMesh && object.geometry?.getAttribute?.('uv')), hasTexture: Boolean(material?.map), materialColor: material?.color ? `#${material.color.getHexString()}` : null, metalness: material?.metalness ?? 0, roughness: material?.roughness ?? 0.5, opacity: material?.opacity ?? 1, textureDataUrl: object.userData.textureDataUrl || null, materialSlots: Array.isArray(object.material) ? object.material.map((item) => item?.name || 'Material') : material ? [material.name || 'Material'] : [] })
          })
          clipsRef.current = animations || []
          mixerRef.current = animations?.length ? new THREE.AnimationMixer(root) : null
          onAnimationClips?.((animations || []).map((clip) => ({ id: clip.uuid, name: clip.name || 'Imported action', duration: clip.duration, source: format })))
          onSceneGraph?.(nodes, { initial: true, format, animations: animations.map((clip) => ({ id: clip.uuid, name: clip.name || 'Imported action', duration: clip.duration, source: format })) })
          statusRef.current?.('ready')
          objectUrls.forEach((url) => URL.revokeObjectURL(url))
        }
        const file = source.file || source.files?.find((item) => formatFromSource({ file: item }) === format) || source.files?.[0]
        if (file && format === 'obj') {
          const materialFile = source.files?.find((item) => item.name.toLowerCase().endsWith('.mtl'))
          let materials = null
          if (materialFile) {
            materials = new MTLLoader(manager).parse(await materialFile.text(), '')
            materials.preload()
          }
          const loader = new OBJLoader(manager)
          if (materials) loader.setMaterials(materials)
          onLoaded(loader.parse(await file.text()), [])
        } else if (file && format === 'fbx') {
          const loader = new FBXLoader(manager)
          const object = loader.parse(await file.arrayBuffer(), '')
          onLoaded(object, object.animations || [])
        } else if (file) {
          const loader = new GLTFLoader(manager)
          loader.register((parser) => new VRMLoaderPlugin(parser))
          const buffer = await file.arrayBuffer()
          loader.parse(buffer, '', (gltf) => onLoaded(gltf.scene || gltf.scenes?.[0], gltf.animations || [], { vrm: gltf.userData?.vrm, extensions: gltf.parser?.json?.extensions }), (error) => { throw error })
        } else {
          const loader = new GLTFLoader(manager)
          loader.register((parser) => new VRMLoaderPlugin(parser))
          await loader.loadAsync(source.url).then((gltf) => onLoaded(gltf.scene || gltf.scenes?.[0], gltf.animations || [], { vrm: gltf.userData?.vrm, extensions: gltf.parser?.json?.extensions }))
        }
      } catch (error) {
        if (!cancelled) {
          statusRef.current?.('error')
          statusRef.current?.(error?.message || 'Could not load model.')
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [source, onAnimationClips, onSceneGraph])

  useEffect(() => {
    const object = nodeMapRef.current.get(selectedNodeId)
    if (!object) return
    const applyMaterial = (child) => {
      if (!child.isMesh) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        if (onMaterialChange?.color) material.color?.set(onMaterialChange.color)
        if (typeof onMaterialChange?.metalness === 'number' && 'metalness' in material) material.metalness = onMaterialChange.metalness
        if (typeof onMaterialChange?.roughness === 'number' && 'roughness' in material) material.roughness = onMaterialChange.roughness
        if (typeof onMaterialChange?.opacity === 'number' && 'opacity' in material) {
          material.opacity = onMaterialChange.opacity
          material.transparent = onMaterialChange.opacity < 1
        }
      })
    }
    object.traverse(applyMaterial)
  }, [onMaterialChange, selectedNodeId])

  return <div ref={containerRef} className="modeling-viewport-canvas" role="application" aria-label="3D modeling viewport" />
})
