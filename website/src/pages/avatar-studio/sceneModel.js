import { createAnimationClip, migrateAnimationClips } from './animationModel'

export const SCENE_SCHEMA_VERSION = 2

export const TOOL_GROUPS = [
  { id: 'select', label: 'Select', icon: 'MousePointer2' },
  { id: 'move', label: 'Move', icon: 'Move3d' },
  { id: 'rotate', label: 'Rotate', icon: 'Rotate3d' },
  { id: 'scale', label: 'Scale', icon: 'Scaling' },
  { id: 'sculpt', label: 'Sculpt', icon: 'Brush' },
  { id: 'paint', label: 'Paint', icon: 'Paintbrush' },
  { id: 'rig', label: 'Rig', icon: 'Bone' },
]

export function createSceneProject(model = null) {
  const format = model?.format || inferModelFormat(model?.url, model?.renderer)
  return {
    schemaVersion: SCENE_SCHEMA_VERSION,
    model: model ? {
      id: model.id,
      label: model.label,
      renderer: model.renderer,
      format,
      url: model.url || null,
      assetId: model.assetId || null,
      assetSetId: model.assetSetId || null,
    } : null,
    nodes: [],
    materials: [],
    animations: [],
    camera: { position: [0, 1.2, 3.5], target: [0, 1, 0], zoom: 1 },
    timeline: { currentFrame: 0, fps: 24, loop: true, startFrame: 0, endFrame: 120, activeClipId: null },
    settings: { grid: true, axes: true, background: 'theme' },
  }
}

export function inferModelFormat(url, renderer) {
  const value = String(url || '').toLowerCase()
  if (value.endsWith('.fbx')) return 'fbx'
  if (value.endsWith('.obj')) return 'obj'
  if (value.endsWith('.gltf')) return 'gltf'
  if (value.endsWith('.vrm') || renderer === 'vrm') return 'vrm'
  return 'glb'
}

export function normalizeSceneProject(scene, fallbackModel = null) {
  const base = createSceneProject(fallbackModel)
  if (!scene || typeof scene !== 'object') return base
  return {
    ...base,
    ...scene,
    schemaVersion: SCENE_SCHEMA_VERSION,
    model: scene.model ? { ...base.model, ...scene.model, format: scene.model.format || inferModelFormat(scene.model.url, scene.model.renderer) } : base.model,
    nodes: Array.isArray(scene.nodes) ? scene.nodes : [],
    materials: Array.isArray(scene.materials) ? scene.materials : [],
    animations: migrateAnimationClips(scene.animations),
    camera: { ...base.camera, ...(scene.camera || {}) },
    timeline: { ...base.timeline, ...(scene.timeline || {}) },
    settings: { ...base.settings, ...(scene.settings || {}) },
  }
}

export function cloneScene(scene) {
  return JSON.parse(JSON.stringify(scene))
}

export function updateNode(scene, nodeId, patch) {
  return {
    ...scene,
    nodes: scene.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node),
  }
}

export function updateNodeTransform(scene, nodeId, field, value) {
  return updateNode(scene, nodeId, { [field]: value })
}

export function sceneNodeCount(scene) {
  return Array.isArray(scene?.nodes) ? scene.nodes.length : 0
}

export function ensureDefaultAnimationClip(scene) {
  if (scene.animations?.length) return scene
  return { ...scene, animations: [createAnimationClip()] }
}
