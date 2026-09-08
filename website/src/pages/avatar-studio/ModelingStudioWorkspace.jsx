import '../../styles/pages/avatar-modeling.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Camera, ChevronLeft, ChevronRight, Eye, Grid3x3, Maximize2, PanelLeft, PanelRight, RotateCcw, Save, Sparkles, X } from 'lucide-react'
import { EveAvatar } from '../../components/eve/avatar/EveAvatar'
import { AVATAR_CATALOG, AVATAR_DEFAULTS, clampUserPan, clampZoom } from '../../components/eve/avatar/avatarConstants'
import { useEveAvatar } from '../../components/eve/avatar/EveAvatarProvider'
import { listAvatarModels, saveAvatarPreferences } from '../../lib/eveAvatarApi'
import { capabilitiesForFormat, getImportFormat, isSupportedModelFile } from './editorCapabilities'
import { evaluateSceneAtFrame, removeTransformKeyframe, upsertTransformKeyframe } from './animationModel'
import { StudioModelBrowser } from './StudioModelBrowser'
import { StudioOutliner } from './StudioOutliner'
import { StudioProperties } from './StudioProperties'
import { SceneViewport } from './SceneViewport'
import { StudioTimeline } from './StudioTimeline'
import { StudioTopBar } from './StudioTopBar'
import { TOOL_GROUPS, createSceneProject, inferModelFormat, updateNode } from './sceneModel'
import { useModelingProject } from './useModelingProject'

const TOOL_ICONS = { MousePointer2: Sparkles, Move3d: Maximize2, Rotate3d: RotateCcw, Scaling: Maximize2, Brush: Sparkles, Paintbrush: Sparkles, Bone: Box }

function isTauri() {
  try { return typeof window !== 'undefined' && !!window.__TAURI__ } catch { return false }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ModelingStudioWorkspace() {
  const { prefs, setPrefs, activeModel } = useEveAvatar()
  const [remoteModels, setRemoteModels] = useState([])
  const [activeTool, setActiveTool] = useState('select')
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [nodes, setNodes] = useState([])
  const [source, setSource] = useState(null)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [browserOpen, setBrowserOpen] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [showAxes, setShowAxes] = useState(true)
  const [controlsHidden, setControlsHidden] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [timelineCollapsed, setTimelineCollapsed] = useState(false)
  const [materialPatch, setMaterialPatch] = useState(null)
  const [paintSettings, setPaintSettings] = useState({ size: 24, strength: 0.8, color: '#a83b59', mode: 'paint' })
  const [animationClips, setAnimationClips] = useState([])
  const [selectedKeyframe, setSelectedKeyframe] = useState(null)
  const viewportRef = useRef(null)
  const viewportShellRef = useRef(null)
  const historyRef = useRef({ past: [], future: [] })
  const { projects, currentProject, scene, setScene, resetLocalScene, openProject, saveProject, importAssetSet, getAssetBlob, getAssetSet, error: projectError } = useModelingProject(activeModel)

  useEffect(() => {
    listAvatarModels().then((result) => setRemoteModels(result?.models || [])).catch(() => {})
  }, [])

  const models = useMemo(() => [...AVATAR_CATALOG, ...remoteModels.filter((model) => !AVATAR_CATALOG.some((catalog) => catalog.id === model.id))], [remoteModels])
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null
  const sceneFormat = scene.model?.format || inferModelFormat(scene.model?.url, scene.model?.renderer)
  const capabilities = capabilitiesForFormat(sceneFormat)
  const isLive2D = (prefs?.renderer === 'live2d' || (prefs?.renderer === 'auto' && activeModel?.renderer === 'live2d')) && !source?.file

  useEffect(() => {
    if (source || currentProject.id) return
    const model = models.find((item) => item.id === (prefs?.modelId || activeModel?.id)) || activeModel || models[0]
    if (model?.renderer === 'vrm' && model.url) setSource({ url: model.url, format: inferModelFormat(model.url, model.renderer), key: model.id })
  }, [activeModel, currentProject.id, models, prefs?.modelId, scene.model?.id, scene.model?.url, source])

  useEffect(() => {
    if (projectError) setError(projectError)
  }, [projectError])

  useEffect(() => {
    const warnBeforeUnload = (event) => {
      if (!currentProject.dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [currentProject.dirty])

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        handleSave()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) handleRedo()
        else handleUndo()
        return
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        if (selectedNodeId && viewportRef.current?.duplicateNode(selectedNodeId)) setStatus('Object duplicated')
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNodeId && viewportRef.current?.deleteNode(selectedNodeId)) setStatus('Object deleted')
        return
      }
      if (event.key === 'Escape') { setActiveTool('select'); return }
      if (event.key.toLowerCase() === 'f') { setResetSignal((value) => value + 1); return }
      if (event.code === 'Space') { event.preventDefault(); setPlaying((value) => !value); return }
      const shortcuts = { g: 'move', r: 'rotate', s: 'scale', v: 'select' }
      const tool = shortcuts[event.key.toLowerCase()]
      if (tool) setActiveTool(tool)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    if (!source && currentProject.id && scene.model?.url) {
      setSource({ url: scene.model.url, format: scene.model.format || inferModelFormat(scene.model.url, scene.model.renderer), key: `${currentProject.id}:${scene.model.id}` })
      return undefined
    }
    if (!source && currentProject.id && scene.model?.assetId) {
      const loadSavedAssets = async () => {
        if (scene.model.assetSetId) {
          const files = await getAssetSet(scene.model.assetSetId, scene.model.assetId)
          if (files.length) {
            setSource({ file: files[0], files, format: scene.model.format || inferModelFormat(scene.model.url, scene.model.renderer), key: `${currentProject.id}:${scene.model.assetSetId}` })
            return
          }
        }
        const blob = await getAssetBlob(scene.model.assetId)
        if (!blob) return
        setSource({ url: URL.createObjectURL(blob), format: scene.model.format || inferModelFormat(scene.model.url, scene.model.renderer), key: `${currentProject.id}:${scene.model.assetId}` })
      }
      loadSavedAssets().catch(() => setError('Could not load the saved model asset.'))
    }
    return undefined
  }, [currentProject.id, getAssetBlob, getAssetSet, scene.model?.assetId, scene.model?.assetSetId, scene.model?.format, scene.model?.id, scene.model?.renderer, scene.model?.url, source])

  const updateScene = useCallback((updater) => {
    setScene((current) => {
      historyRef.current.past.push(current)
      historyRef.current.future = []
      return typeof updater === 'function' ? updater(current) : updater
    })
  }, [setScene])

  const handleSelectModel = useCallback(async (model) => {
    setError('')
    const nextPrefs = { ...prefs, modelId: model.id, modelUrl: model.url || null, renderer: model.renderer === 'live2d' ? 'live2d' : 'vrm' }
    setPrefs(nextPrefs)
    await saveAvatarPreferences(nextPrefs).catch(() => {})
    const format = inferModelFormat(model.url, model.renderer)
    updateScene((current) => ({ ...current, model: { id: model.id, label: model.label, renderer: model.renderer, format, url: model.url || null, assetId: null, assetSetId: null } }))
    setSource(model.renderer === 'vrm' && model.url ? { url: model.url, format, key: model.id } : null)
    setNodes([])
    setSelectedNodeId(null)
  }, [prefs, setPrefs, updateScene])

  const handleImport = useCallback(async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    const modelFile = files.find((file) => isSupportedModelFile(file.name))
    if (!modelFile) { setError('Choose a VRM, GLB, GLTF, OBJ, or FBX file.'); return }
    try {
      const format = getImportFormat(modelFile.name)
      let uploaded = []
      try {
        uploaded = await importAssetSet(files, { relativePath: modelFile.webkitRelativePath || modelFile.name })
      } catch {
        setStatus('Loaded locally — sign in to save project assets.')
      }
      setSource({ file: modelFile, files, format, key: `${modelFile.name}:${modelFile.lastModified}` })
      const primaryAsset = uploaded.find((asset) => asset.filename === modelFile.name)
      updateScene((current) => ({ ...current, model: { id: primaryAsset?.id || `local:${modelFile.name}`, label: modelFile.name, renderer: format === 'vrm' ? 'vrm' : 'three', format, url: null, assetId: primaryAsset?.id || null, assetSetId: primaryAsset?.asset_set_id || null } }))
      setStatus(`Loaded ${modelFile.name}`)
    } catch (err) {
      setError(err?.message || 'Could not import model.')
    }
  }, [importAssetSet, updateScene])

  const handleSceneGraph = useCallback((nextNodes, metadata = {}) => {
    setNodes(nextNodes)
    if (metadata.initial) {
      setScene((current) => ({ ...current, nodes: nextNodes, model: current.model ? { ...current.model, format: metadata.format || current.model.format } : current.model }), { markDirty: false })
      return
    }
    updateScene((current) => ({ ...current, nodes: nextNodes }))
  }, [setScene, updateScene])

  const handleAnimationClips = useCallback((clips) => {
    setAnimationClips(clips || [])
  }, [])

  const handleNodeTransform = useCallback((nodeId, patch) => {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, ...patch } : node))
    updateScene((current) => updateNode(current, nodeId, patch))
  }, [updateScene])

  const handleNodeUpdate = useCallback((patch) => {
    if (!selectedNodeId) return
    setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, ...patch } : node))
    updateScene((current) => updateNode(current, selectedNodeId, patch))
  }, [selectedNodeId, updateScene])

  const handleNodeUpdateFor = useCallback((nodeId, patch) => {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, ...patch } : node))
    updateScene((current) => updateNode(current, nodeId, patch))
  }, [updateScene])

  const handleTextureChange = useCallback(({ nodeId, textureDataUrl }) => {
    handleNodeUpdateFor(nodeId, { textureDataUrl, hasTexture: true })
  }, [handleNodeUpdateFor])

  const handleDuplicateNode = useCallback(() => {
    if (!selectedNodeId) { setError('Select an object before duplicating it.'); return }
    if (viewportRef.current?.duplicateNode(selectedNodeId)) setStatus('Object duplicated')
  }, [selectedNodeId])

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) { setError('Select an object before deleting it.'); return }
    if (viewportRef.current?.deleteNode(selectedNodeId)) setStatus('Object deleted')
  }, [selectedNodeId])

  const handleCameraChange = useCallback((camera) => {
    updateScene((current) => ({ ...current, camera: { ...current.camera, ...camera } }))
  }, [updateScene])

  const handleSave = useCallback(async () => {
    setError('')
    setStatus('Saving…')
    try {
      await saveProject('Save scene and camera')
      const nextPrefs = { ...prefs, userPan: clampUserPan(prefs?.userPan || AVATAR_DEFAULTS.userPan), zoom: clampZoom(prefs?.zoom || AVATAR_DEFAULTS.zoom) }
      await saveAvatarPreferences(nextPrefs).catch(() => {})
      setStatus('Saved')
    } catch (err) {
      setError(err?.message || 'Could not save project.')
    }
  }, [prefs, saveProject])

  const handleFullscreen = useCallback(async () => {
    const shell = viewportShellRef.current
    if (!shell) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await shell.requestFullscreen()
    } catch {
      setError('Fullscreen mode is unavailable in this browser.')
    }
  }, [])

  const handleExport = useCallback(async (format) => {
    setError('')
    if (format === 'vrm') { setError('VRM export requires a VRM-preserving scene. Use GLB for this scene.'); return }
    try {
      setStatus('Preparing export…')
      const result = await viewportRef.current?.exportScene(format)
      if (!result) throw new Error('Load a 3D model before exporting.')
      setStatus('Exporting…')
      downloadBlob(result.blob, result.filename)
      setStatus(`Export complete · ${result.filename}`)
    } catch (err) {
      setError(err?.message || 'Could not export scene.')
      setStatus('Export failed')
    }
  }, [])

  const handleUndo = () => {
    const previous = historyRef.current.past.pop()
    if (!previous) return
    historyRef.current.future.push(scene)
    setScene(previous)
    setNodes(previous.nodes || [])
  }

  const handleRedo = () => {
    const next = historyRef.current.future.pop()
    if (!next) return
    historyRef.current.past.push(scene)
    setScene(next)
    setNodes(next.nodes || [])
  }

  const handleAddKeyframe = () => {
    if (!selectedNodeId) { setError('Select an object before adding a keyframe.'); return }
    updateScene((current) => upsertTransformKeyframe(current, selectedNode, currentFrame))
    setStatus(`Keyframe added at ${currentFrame}`)
  }

  const handleDeleteKeyframe = (keyframe = selectedKeyframe) => {
    if (!keyframe) return
    updateScene((current) => removeTransformKeyframe(current, keyframe.clipId, keyframe.nodeId, keyframe.frame))
    setSelectedKeyframe(null)
    setStatus('Keyframe deleted')
  }

  const handleFrameChange = useCallback((frame) => {
    const nextFrame = Math.max(0, Math.min(Number(scene.timeline?.endFrame || 120), Number(frame)))
    setCurrentFrame(nextFrame)
    setScene((current) => ({ ...current, timeline: { ...current.timeline, currentFrame: nextFrame } }), { markDirty: false })
    if (!animationClips.length) setNodes(evaluateSceneAtFrame(scene, nextFrame, scene.nodes))
  }, [animationClips.length, scene, setScene])

  const handleStopPlayback = useCallback(() => {
    setPlaying(false)
    handleFrameChange(scene.timeline?.startFrame || 0)
  }, [handleFrameChange, scene.timeline?.startFrame])

  useEffect(() => {
    if (!playing) return undefined
    let animationFrameId = 0
    let lastTimestamp = 0
    const tick = (timestamp) => {
      if (!lastTimestamp) lastTimestamp = timestamp
      const elapsed = timestamp - lastTimestamp
      const frameDuration = 1000 / Number(scene.timeline?.fps || 24)
      if (elapsed >= frameDuration) {
        const delta = Math.max(1, Math.floor(elapsed / frameDuration))
        lastTimestamp = timestamp
        setCurrentFrame((frame) => {
          const start = Number(scene.timeline?.startFrame || 0)
          const end = Number(scene.timeline?.endFrame || 120)
          const next = frame + delta
          if (next <= end) return next
          return scene.timeline?.loop !== false ? start : end
        })
      }
      animationFrameId = window.requestAnimationFrame(tick)
    }
    animationFrameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(animationFrameId)
  }, [playing, scene.timeline?.endFrame, scene.timeline?.fps, scene.timeline?.loop, scene.timeline?.startFrame])

  useEffect(() => {
    if (animationClips.length) return
    setNodes(evaluateSceneAtFrame(scene, currentFrame, scene.nodes))
  }, [animationClips.length, currentFrame, scene])

  const handleResetCamera = () => { setResetSignal((value) => value + 1); updateScene((current) => ({ ...current, camera: createSceneProject().camera })) }
  const handleRenameNode = useCallback((nodeId, name) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) return
    handleNodeUpdateFor(nodeId, { name: trimmed })
  }, [handleNodeUpdateFor])

  const handleFpsChange = useCallback((fps) => {
    const nextFps = Math.max(1, Math.min(120, Number(fps) || 24))
    setScene((current) => ({ ...current, timeline: { ...current.timeline, fps: nextFps } }), { markDirty: false })
  }, [setScene])

  const handleLoopChange = useCallback((loop) => {
    setScene((current) => ({ ...current, timeline: { ...current.timeline, loop } }), { markDirty: false })
  }, [setScene])

  const handleToolChange = useCallback((tool) => {
    if (tool === 'sculpt' || tool === 'rig') {
      setError(`${tool[0].toUpperCase()}${tool.slice(1)} tools are not available for this scene.`)
      return
    }
    if (tool === 'paint' && !capabilities.texturePaint) {
      setError('Texture painting requires a mesh with UV coordinates.')
      return
    }
    setActiveTool(tool)
  }, [capabilities.texturePaint])

  const handleMenuAction = (action) => {
    const toolActions = { 'tool-select': 'select', 'tool-move': 'move', 'tool-rotate': 'rotate', 'tool-scale': 'scale', 'tool-sculpt': 'sculpt', 'tool-paint': 'paint' }
    if (toolActions[action]) { handleToolChange(toolActions[action]); return }
    if (action === 'save') { handleSave(); return }
    if (action === 'undo') { handleUndo(); return }
    if (action === 'redo') { handleRedo(); return }
    if (action === 'grid') { setShowGrid((value) => !value); return }
    if (action === 'axes') { setShowAxes((value) => !value); return }
    if (action === 'reset-camera') { handleResetCamera(); return }
    if (action === 'fullscreen') { handleFullscreen(); return }
    if (action === 'add-cube') { const id = viewportRef.current?.addPrimitive('box'); if (id) setStatus('Cube added to scene'); return }
    if (action === 'inspector') { setInspectorOpen(true); return }
    if (action === 'timeline') { setPlaying((value) => !value) }
    if (action === 'export-glb') { handleExport('glb') }
  }
  const handleOpenProject = useCallback(async (id) => {
    if (currentProject.dirty && !window.confirm('This scene has unsaved changes. Open another project anyway?')) return
    if (!id) {
      resetLocalScene()
      setNodes([])
      setSelectedNodeId(null)
      setSource(null)
      setAnimationClips([])
      return
    }
    const loaded = await openProject(id)
    if (loaded) {
      setNodes(loaded.scene?.nodes || [])
      setSelectedNodeId(null)
      setSource(null)
      setAnimationClips([])
    }
  }, [currentProject.dirty, openProject, resetLocalScene])
  useEffect(() => {
    const context = {
      page: 'avatar-studio',
      projectId: currentProject.id || null,
      projectName: currentProject.name || 'Local scene',
      dirty: Boolean(currentProject.dirty),
      model: { label: scene.model?.label || null, format: sceneFormat },
      selectedNode: selectedNode ? { id: selectedNode.id, name: selectedNode.name, type: selectedNode.type } : null,
      nodes: nodes.slice(0, 80).map(({ id, name, type, parentId, visible }) => ({ id, name, type, parentId, visible })),
      capabilities,
    }
    window.dispatchEvent(new CustomEvent('starwaves:avatar-editor-context', { detail: context }))
  }, [capabilities, currentProject.dirty, currentProject.id, currentProject.name, nodes, scene.model?.label, sceneFormat, selectedNode])

  useEffect(() => {
    const handleEditorAction = (event) => {
      const action = event.detail || {}
      const target = nodes.find((node) => node.id === action.node_id || (action.node_name && node.name === action.node_name))
      if (action.requires_confirmation && !window.confirm('Eve requested a change in Avatar Studio. Apply it?')) return
      if (action.command === 'select_node') {
        if (target) setSelectedNodeId(target.id)
        return
      }
      if (action.command === 'update_transform') {
        if (!target) { setError('Eve could not find that scene node.'); return }
        handleNodeUpdateFor(target.id, {
          ...(Array.isArray(action.position) ? { position: action.position } : {}),
          ...(Array.isArray(action.rotation) ? { rotation: action.rotation } : {}),
          ...(Array.isArray(action.scale) ? { scale: action.scale } : {}),
        })
      } else if (action.command === 'set_material') {
        if (target && action.color) handleNodeUpdateFor(target.id, { color: action.color })
      } else if (action.command === 'add_keyframe') {
        if (target) { setSelectedNodeId(target.id); updateScene((current) => upsertTransformKeyframe(current, target, action.frame ?? currentFrame)) }
      } else if (action.command === 'save') handleSave()
      else if (action.command === 'playback') setPlaying(action.playing !== false)
      else if (action.command === 'export_glb') handleExport('glb')
    }
    window.addEventListener('starwaves:avatar-editor-action', handleEditorAction)
    return () => window.removeEventListener('starwaves:avatar-editor-action', handleEditorAction)
  }, [currentFrame, handleExport, handleNodeUpdateFor, handleSave, nodes, updateScene])
  const viewportSource = useMemo(() => source || (scene.model?.url ? { url: scene.model.url, format: scene.model.format || inferModelFormat(scene.model.url, scene.model.renderer), key: scene.model.id } : null), [scene.model, source])

  return <div className={`modeling-studio ${inspectorOpen ? 'is-inspector-open' : ''} ${browserOpen ? 'is-browser-open' : ''} ${controlsHidden ? 'is-controls-hidden' : ''}`}>
    {!controlsHidden && <StudioTopBar project={currentProject} projects={projects} capabilities={capabilities} onOpen={handleOpenProject} onSave={handleSave} onImport={handleImport} onCreatePrimitive={() => { const id = viewportRef.current?.addPrimitive('box'); if (id) setStatus('Cube added to scene'); else setError('Load a scene before adding a primitive.') }} onExport={handleExport} onUndo={handleUndo} onRedo={handleRedo} onMenuAction={handleMenuAction} canUndo={historyRef.current.past.length > 0} canRedo={historyRef.current.future.length > 0} />}
    <div className={`modeling-workspace ${controlsHidden ? 'is-controls-hidden' : ''}`}>
      {!controlsHidden && <aside className="modeling-tool-rail" aria-label="Modeling tools">
        <div className="modeling-tool-rail-brand">A</div>
        {TOOL_GROUPS.map((toolItem) => { const Icon = TOOL_ICONS[toolItem.icon] || Box; const disabled = toolItem.id === 'sculpt' || toolItem.id === 'rig' || (toolItem.id === 'paint' && !capabilities.texturePaint); return <button type="button" key={toolItem.id} className={activeTool === toolItem.id ? 'is-active' : ''} onClick={() => handleToolChange(toolItem.id)} aria-pressed={activeTool === toolItem.id} title={disabled ? `${toolItem.label} is unavailable for this scene` : toolItem.label} disabled={disabled}><Icon size={17} /><span>{toolItem.label}</span></button> })}
        <button type="button" className="modeling-tool-rail-bottom" onClick={() => setBrowserOpen((open) => !open)} aria-label="Toggle model browser"><PanelLeft size={17} /></button>
      </aside>}
      {!controlsHidden && browserOpen && <StudioModelBrowser models={models} activeModelId={prefs?.modelId || activeModel?.id} onSelectModel={handleSelectModel} onImport={handleImport} />}
      <main className="modeling-center-column">
        <div className="modeling-viewport-shell" ref={viewportShellRef}>
          <div className="modeling-viewport-header"><div><span className="modeling-panel-kicker">3D Viewport</span><strong>Perspective</strong></div><div className="modeling-viewport-actions"><button type="button" onClick={() => setShowGrid((value) => !value)} className={showGrid ? 'is-active' : ''} aria-pressed={showGrid}><Grid3x3 size={14} /> Grid</button><button type="button" onClick={() => setShowAxes((value) => !value)} className={showAxes ? 'is-active' : ''} aria-pressed={showAxes}><Eye size={14} /> Axes</button><button type="button" onClick={() => setInspectorOpen((open) => !open)} aria-expanded={inspectorOpen}><PanelRight size={14} /></button></div></div>
          <div className="modeling-viewport-content">
            {isLive2D ? <EveAvatar size="lg" chrome={false} className="modeling-live2d-avatar" prefs={prefs} activeModel={activeModel} /> : <SceneViewport ref={viewportRef} source={viewportSource} camera={scene.camera} nodes={nodes} selectedNodeId={selectedNodeId} tool={activeTool} showGrid={showGrid} showAxes={showAxes} animationFrame={currentFrame} activeAnimationId={scene.timeline?.activeClipId} playing={playing} paintSettings={paintSettings} resetSignal={resetSignal} onSceneGraph={handleSceneGraph} onAnimationClips={handleAnimationClips} onSelectNode={setSelectedNodeId} onNodeTransform={handleNodeTransform} onMaterialChange={materialPatch?.nodeId === selectedNodeId ? materialPatch : null} onTextureChange={handleTextureChange} onCameraChange={handleCameraChange} onStatus={(next) => { if (next === 'loading') setStatus('Loading model…'); else if (next === 'ready') setStatus('Model ready'); else if (next === 'error') setError('Could not load this model.') }} />}
            <div className="modeling-viewport-hint"><Camera size={13} /> Drag to orbit · Wheel to zoom · {activeTool === 'select' ? 'Click to select' : `${activeTool} tool active`}</div>
            <button type="button" className="modeling-fullscreen-button" onClick={handleFullscreen} aria-label="Toggle fullscreen viewport"><Maximize2 size={15} /></button>
            <button type="button" className="modeling-hide-controls" onClick={() => setControlsHidden(true)} aria-label="Hide all controls"><Eye size={14} /> Hide UI</button>
          </div>
        </div>
        {!controlsHidden && <StudioTimeline nodes={nodes} scene={scene} importedClips={animationClips} playing={playing} currentFrame={currentFrame} selectedKeyframe={selectedKeyframe} collapsed={timelineCollapsed} onTogglePlayback={() => setPlaying((value) => !value)} onStop={handleStopPlayback} onFrameChange={handleFrameChange} onAddKeyframe={handleAddKeyframe} onDeleteKeyframe={handleDeleteKeyframe} onSelectKeyframe={setSelectedKeyframe} onFpsChange={handleFpsChange} onLoopChange={handleLoopChange} onToggleCollapse={() => setTimelineCollapsed((value) => !value)} />}
      </main>
      {!controlsHidden && inspectorOpen && <aside className="modeling-right-column"><StudioOutliner nodes={nodes} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} onRename={handleRenameNode} onToggleVisibility={(node) => handleNodeUpdateFor(node.id, { visible: node.visible === false })} /><StudioProperties node={selectedNode} capabilities={selectedNode ? { ...capabilities, texturePaint: capabilities.texturePaint && selectedNode.hasUv } : capabilities} currentFrame={currentFrame} paintSettings={paintSettings} onPaintSettingsChange={setPaintSettings} onActivatePaint={() => handleToolChange('paint')} onUpdateNode={handleNodeUpdate} onDuplicateNode={handleDuplicateNode} onDeleteNode={handleDeleteNode} onMaterialChange={(patch) => setMaterialPatch({ ...patch, nodeId: selectedNodeId })} /><div className="modeling-render-card"><div><span className="modeling-panel-kicker">Render preview</span><strong>{scene.model?.label || 'No model loaded'}</strong></div><button type="button" onClick={() => handleExport('glb')} disabled={!capabilities.exportGlb}><Save size={14} /> Export GLB</button></div></aside>}
    </div>
    <div className="modeling-bottom-status"><span className={status ? 'is-success' : ''}>{status || (currentProject.dirty ? 'Unsaved changes' : 'Ready')}</span><span>{nodes.length} scene objects · {isTauri() ? 'Desktop' : 'Browser'} mode</span><button type="button" onClick={handleResetCamera}><RotateCcw size={13} /> Reset camera</button><button type="button" onClick={() => setInspectorOpen((open) => !open)}>{inspectorOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />} {inspectorOpen ? 'Hide inspector' : 'Show inspector'}</button>{controlsHidden && <button type="button" onClick={() => setControlsHidden(false)}><PanelRight size={13} /> Show all controls</button>}</div>
    {(error || projectError) && <div className="modeling-toast is-error" role="alert"><X size={15} /> {error || projectError}</div>}
  </div>
}
