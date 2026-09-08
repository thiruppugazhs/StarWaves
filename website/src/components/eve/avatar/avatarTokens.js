// Maps current theme preset → single avatar accent (spectrum rule: one hue per role).
// No new colors introduced — reuses existing CSS vars / preset tokens.

const MONO_ACCENTS = new Set(['light', 'dark', 'stone', 'oled', 'paper'])

export function resolveAvatarTint(presetId) {
  if (!presetId) return null
  if (MONO_ACCENTS.has(presetId)) return null
  // duo/spectrum: let CSS var handle it — avatar reads var(--color-primary) so we never duplicate hue
  return 'var(--color-primary)'
}

export function avatarCardStyle(presetId, tint) {
  const accent = tint ?? resolveAvatarTint(presetId)
  if (!accent) return {}
  return { '--eve-avatar-accent': accent }
}

export function shouldReduceMotion(prefMotion) {
  if (prefMotion === 'reduced') return true
  if (prefMotion === 'on') return false
  // auto → respect OS
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  return false
}
