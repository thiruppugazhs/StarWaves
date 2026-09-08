export const DEFAULT_FPS = 24
export const DEFAULT_END_FRAME = 120

function vector(value, fallback = [0, 0, 0]) {
  return [0, 1, 2].map((index) => Number(value?.[index] ?? fallback[index]))
}

function cloneTransform(transform = {}) {
  return {
    position: vector(transform.position),
    rotation: vector(transform.rotation),
    scale: vector(transform.scale, [1, 1, 1]),
  }
}

export function createAnimationClip(overrides = {}) {
  return {
    id: overrides.id || `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: overrides.name || 'Main action',
    fps: Number(overrides.fps || DEFAULT_FPS),
    startFrame: Number(overrides.startFrame || 0),
    endFrame: Number(overrides.endFrame || DEFAULT_END_FRAME),
    loop: overrides.loop !== false,
    source: overrides.source || 'editor',
    tracks: Array.isArray(overrides.tracks) ? overrides.tracks : [],
  }
}

function normalizeTrack(track) {
  return {
    id: track.id || `track-${track.nodeId}`,
    nodeId: track.nodeId,
    property: track.property || 'transform',
    keyframes: (Array.isArray(track.keyframes) ? track.keyframes : []).map((keyframe) => ({
      frame: Math.max(0, Number(keyframe.frame || 0)),
      ...cloneTransform(keyframe),
    })).sort((left, right) => left.frame - right.frame),
  }
}

export function migrateAnimationClips(animations) {
  if (!Array.isArray(animations) || animations.length === 0) return []
  if (animations.every((item) => Array.isArray(item?.tracks))) {
    return animations.map((clip) => ({ ...createAnimationClip(clip), ...clip, tracks: clip.tracks.map(normalizeTrack) }))
  }

  const tracks = new Map()
  animations.filter((item) => item?.nodeId).forEach((item) => {
    if (!tracks.has(item.nodeId)) tracks.set(item.nodeId, { id: `track-${item.nodeId}`, nodeId: item.nodeId, property: 'transform', keyframes: [] })
    tracks.get(item.nodeId).keyframes.push({ frame: item.frame, ...item.transform })
  })
  if (tracks.size === 0) return []
  const endFrame = Math.max(DEFAULT_END_FRAME, ...[...tracks.values()].flatMap((track) => track.keyframes.map((keyframe) => Number(keyframe.frame || 0))))
  return [createAnimationClip({ id: 'clip-main', name: 'Main action', endFrame, tracks: [...tracks.values()].map(normalizeTrack) })]
}

export function getActiveClip(scene, clipId = scene?.timeline?.activeClipId) {
  const clips = scene?.animations || []
  return clips.find((clip) => clip.id === clipId) || clips[0] || null
}

function interpolate(left, right, frame) {
  if (!left) return right ? cloneTransform(right) : null
  if (!right || left.frame === right.frame) return cloneTransform(left)
  const ratio = (frame - left.frame) / (right.frame - left.frame)
  return ['position', 'rotation', 'scale'].reduce((result, field) => {
    result[field] = vector(left[field]).map((value, index) => value + (Number(right[field]?.[index] ?? value) - value) * ratio)
    return result
  }, {})
}

export function evaluateTrack(track, frame) {
  const keyframes = track?.keyframes || []
  if (!keyframes.length) return null
  let previous = null
  let next = null
  for (const keyframe of keyframes) {
    if (keyframe.frame <= frame) previous = keyframe
    if (keyframe.frame >= frame) { next = keyframe; break }
  }
  return interpolate(previous, next || previous, frame)
}

export function evaluateSceneAtFrame(scene, frame, nodes = scene?.nodes || []) {
  const clip = getActiveClip(scene)
  if (!clip) return nodes
  const evaluated = new Map((clip.tracks || []).map((track) => [track.nodeId, evaluateTrack(track, frame)]))
  return nodes.map((node) => {
    const transform = evaluated.get(node.id)
    return transform ? { ...node, ...transform } : node
  })
}

export function upsertTransformKeyframe(scene, node, frame) {
  const clips = migrateAnimationClips(scene.animations)
  const clip = getActiveClip({ ...scene, animations: clips }) || createAnimationClip()
  const nextClips = clips.length ? clips.map((item) => item.id === clip.id ? item : item) : [clip]
  const targetClip = nextClips.find((item) => item.id === clip.id)
  const existingTrack = targetClip.tracks.find((track) => track.nodeId === node.id)
  const nextKeyframe = { frame: Number(frame), ...cloneTransform(node) }
  const nextTrack = existingTrack
    ? { ...existingTrack, keyframes: [...existingTrack.keyframes.filter((item) => item.frame !== nextKeyframe.frame), nextKeyframe].sort((left, right) => left.frame - right.frame) }
    : { id: `track-${node.id}`, nodeId: node.id, property: 'transform', keyframes: [nextKeyframe] }
  const tracks = existingTrack ? targetClip.tracks.map((track) => track.id === existingTrack.id ? nextTrack : track) : [...targetClip.tracks, nextTrack]
  const updatedClip = { ...targetClip, tracks, endFrame: Math.max(targetClip.endFrame, Number(frame)) }
  return {
    ...scene,
    animations: nextClips.map((item) => item.id === targetClip.id ? updatedClip : item),
    timeline: { ...scene.timeline, activeClipId: targetClip.id, endFrame: Math.max(scene.timeline?.endFrame || DEFAULT_END_FRAME, Number(frame)) },
  }
}

export function removeTransformKeyframe(scene, clipId, nodeId, frame) {
  return {
    ...scene,
    animations: (scene.animations || []).map((clip) => clip.id !== clipId ? clip : {
      ...clip,
      tracks: clip.tracks.map((track) => track.nodeId !== nodeId ? track : { ...track, keyframes: track.keyframes.filter((item) => item.frame !== frame) }).filter((track) => track.keyframes.length),
    }).filter((clip) => clip.tracks.length),
  }
}

export function keyframesForNode(scene, nodeId) {
  return (scene.animations || []).flatMap((clip) => (clip.tracks || []).filter((track) => track.nodeId === nodeId).flatMap((track) => track.keyframes.map((keyframe) => ({ ...keyframe, clipId: clip.id }))))
}
