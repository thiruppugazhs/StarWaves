// Single source of truth for Eve avatar — tokens, limits, catalog.
export const AVATAR_STORAGE_KEY = 'starwaves:eve-avatar:v1'
export const AVATAR_BC_CHANNEL = 'starwaves-avatar'
export const AVATAR_OVERLAY_BC_CHANNEL = 'starwaves-avatar-overlay'
export const AVATAR_CACHE_KEY = 'starwaves.ui.cache'

export const AVATAR_EMOTIONS = ['idle', 'listening', 'thinking', 'speaking', 'tool', 'error']

export const AVATAR_RENDERERS = {
  AUTO: 'auto',
  VRM: 'vrm',
  LIVE2D: 'live2d',
}

export const AVATAR_MOTION = {
  AUTO: 'auto',
  ON: 'on',
  REDUCED: 'reduced',
}

export const AVATAR_LIMITS = {
  SCALE_MIN: 0.8,
  SCALE_MAX: 1.2,
  ZOOM_MIN: 0.3,
  ZOOM_MAX: 3.0,
  PAN_MIN: -1000,
  PAN_MAX: 1000,
  UPLOAD_MAX_BYTES: 12 * 1024 * 1024,
  SINGLE_MAX_BYTES: 8 * 1024 * 1024,
  LOAD_TIMEOUT_MS: 8000,
  POSITION_MIN: 0,
  POSITION_MAX: 100,
}

export const AVATAR_DEFAULTS = {
  enabled: true,
  renderer: AVATAR_RENDERERS.AUTO,
  modelId: 'procedural-light',
  scale: 1,
  zoom: 1,
  userPan: { x: 0, y: 0 },
  autoRotate: false,
  position: { x: 92, y: 88 },
  docked: true,
  motion: AVATAR_MOTION.AUTO,
  inlineEnabled: true,
  orbFallback: true,
  overlayPosition: null,
  overlaySize: { w: 320, h: 480 },
}

export const ALLOWED_EXTS = ['.vrm', '.glb', '.gltf', '.model3.json', '.zip']

// Bundled — one entry per unique model file (procedural + heavy anime opt-ins)
export const AVATAR_CATALOG = [
  {
    id: 'procedural-light',
    label: 'Procedural (Lightweight)',
    renderer: AVATAR_RENDERERS.VRM,
    url: null,
    thumb: null,
    attribution: 'Procedural CSS avatar — 0 bytes, never crashes, always available',
    tags: ['procedural', 'lightweight', 'default'],
  },
  {
    id: 'eve-anime-vrm',
    label: 'Eve Anime (VRM 10MB)',
    renderer: AVATAR_RENDERERS.VRM,
    url: '/avatars/vrm/eve-anime.vrm',
    thumb: '/avatars/vrm/eve-anime-thumb.jpg',
    attribution: 'Anime VRM — VRM1 Constraint Twist Sample (pixiv/three-vrm, CC0) 10.3MB — click to load',
    tags: ['anime', 'vrm', 'heavy'],
  },
  {
    id: 'haru-greeter-live2d',
    label: 'Haru Greeter (Live2D Anime)',
    renderer: AVATAR_RENDERERS.LIVE2D,
    url: '/avatars/live2d/haru/haru_greeter_t03.model3.json',
    thumb: '/avatars/live2d/haru/thumb.jpg',
    attribution: 'Live2D Cubism 4 Haru Greeter (pixi-live2d-display, 0.37MB moc3 + 2.7MB textures) — real anime',
    tags: ['anime', 'live2d', 'default'],
  },
]

export function findModel(modelId) {
  return AVATAR_CATALOG.find((m) => m.id === modelId) || AVATAR_CATALOG[0]
}

export function isVrmUrl(url) {
  return typeof url === 'string' && url.toLowerCase().endsWith('.vrm')
}

export function isLive2DUrl(url) {
  return typeof url === 'string' && url.toLowerCase().endsWith('.model3.json')
}

export function clampScale(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return AVATAR_DEFAULTS.scale
  return Math.min(AVATAR_LIMITS.SCALE_MAX, Math.max(AVATAR_LIMITS.SCALE_MIN, n))
}

export function clampPosition(pos) {
  const x = Math.min(100, Math.max(0, Number(pos?.x ?? AVATAR_DEFAULTS.position.x)))
  const y = Math.min(100, Math.max(0, Number(pos?.y ?? AVATAR_DEFAULTS.position.y)))
  return { x, y }
}

export function clampZoom(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return AVATAR_DEFAULTS.zoom
  return Math.min(AVATAR_LIMITS.ZOOM_MAX, Math.max(AVATAR_LIMITS.ZOOM_MIN, n))
}

export function clampUserPan(pan) {
  const x = Math.min(AVATAR_LIMITS.PAN_MAX, Math.max(AVATAR_LIMITS.PAN_MIN, Number(pan?.x ?? AVATAR_DEFAULTS.userPan.x)))
  const y = Math.min(AVATAR_LIMITS.PAN_MAX, Math.max(AVATAR_LIMITS.PAN_MIN, Number(pan?.y ?? AVATAR_DEFAULTS.userPan.y)))
  return { x, y }
}
