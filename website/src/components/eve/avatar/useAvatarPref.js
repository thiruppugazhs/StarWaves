import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AVATAR_BC_CHANNEL,
  AVATAR_CATALOG,
  AVATAR_DEFAULTS,
  AVATAR_STORAGE_KEY,
  clampPosition,
  clampScale,
  clampUserPan,
  clampZoom,
  findModel,
} from './avatarConstants'

const _PREF_KEY = 'eve_avatar'

function readLocalPrefs() {
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function writeLocalPrefs(next) {
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(next))
  } catch {}
}

function sanitizePrefs(input) {
  if (!input || typeof input !== 'object') return { ...AVATAR_DEFAULTS }
  const renderer = ['auto', 'vrm', 'live2d'].includes(input.renderer) ? input.renderer : AVATAR_DEFAULTS.renderer
  const motion = ['auto', 'on', 'reduced'].includes(input.motion) ? input.motion : AVATAR_DEFAULTS.motion
  // Legacy tint/duplicate entries shared one model file — migrate to the
  // surviving unique entry so stored prefs keep rendering the same model.
  const legacyIds = { 'eve-mono-vrm': 'eve-anime-vrm', 'eve-duo-vrm': 'eve-anime-vrm', 'haru-live2d': 'haru-greeter-live2d' }
  const rawModelId = typeof input.modelId === 'string' ? input.modelId : AVATAR_DEFAULTS.modelId
  const modelId = legacyIds[rawModelId] || rawModelId
  const known = AVATAR_CATALOG.some((m) => m.id === modelId) || String(modelId).startsWith('upload:')
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : AVATAR_DEFAULTS.enabled,
    renderer,
    modelId: known ? modelId : AVATAR_DEFAULTS.modelId,
    scale: clampScale(input.scale),
    zoom: clampZoom(input.zoom),
    userPan: clampUserPan(input.userPan),
    autoRotate: typeof input.autoRotate === 'boolean' ? input.autoRotate : AVATAR_DEFAULTS.autoRotate,
    position: clampPosition(input.position),
    docked: typeof input.docked === 'boolean' ? input.docked : AVATAR_DEFAULTS.docked,
    motion,
    inlineEnabled: typeof input.inlineEnabled === 'boolean' ? input.inlineEnabled : AVATAR_DEFAULTS.inlineEnabled,
    orbFallback: typeof input.orbFallback === 'boolean' ? input.orbFallback : AVATAR_DEFAULTS.orbFallback,
    // allow custom url for uploads
    modelUrl: typeof input.modelUrl === 'string' ? input.modelUrl : null,
  }
}

export function prefsToUiPreferencesDoc(prefs) {
  return prefs
}

export function uiPreferencesToPrefs(doc) {
  if (!doc) return null
  return sanitizePrefs(doc)
}

export function useAvatarPref({ uiPrefs } = {}) {
  const initial = useMemo(() => {
    const fromUi = uiPrefs?.eve_avatar ? sanitizePrefs(uiPrefs.eve_avatar) : null
    if (fromUi) return fromUi
    const local = readLocalPrefs()
    if (local) return sanitizePrefs(local)
    return { ...AVATAR_DEFAULTS }
  }, [uiPrefs])

  const [prefs, setPrefsState] = useState(initial)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  // keep in sync when uiPrefs arrives later (single fetch via useCustomUI)
  useEffect(() => {
    if (uiPrefs?.eve_avatar) {
      const next = sanitizePrefs(uiPrefs.eve_avatar)
      setPrefsState(next)
      writeLocalPrefs(next)
    }
  }, [uiPrefs])

  // broadcast to other tabs
  const bcRef = useRef(null)
  useEffect(() => {
    try {
      if (typeof BroadcastChannel === 'undefined') return
      const ch = new BroadcastChannel(AVATAR_BC_CHANNEL)
      ch.onmessage = (msg) => {
        const data = msg?.data
        if (data?.type === 'avatar-pref' && data.prefs) {
          const next = sanitizePrefs(data.prefs)
          setPrefsState(next)
          writeLocalPrefs(next)
        }
      }
      bcRef.current = ch
      return () => { try { ch.close() } catch {} }
    } catch { return undefined }
  }, [])

  const setPrefs = useCallback((updater) => {
    setPrefsState((current) => {
      const patch = typeof updater === 'function' ? updater(current) : updater
      const merged = sanitizePrefs({ ...current, ...patch })
      writeLocalPrefs(merged)
      try {
        bcRef.current?.postMessage({ type: 'avatar-pref', prefs: merged })
        window.dispatchEvent(new CustomEvent('starwaves:avatar-pref', { detail: merged }))
      } catch {}
      return merged
    })
  }, [])

  const activeModel = useMemo(() => {
    if (prefs.modelUrl) return { id: prefs.modelId, url: prefs.modelUrl, renderer: prefs.renderer }
    const found = findModel(prefs.modelId)
    return found
  }, [prefs.modelId, prefs.modelUrl, prefs.renderer])

  return { prefs, setPrefs, activeModel, sanitizePrefs }
}
