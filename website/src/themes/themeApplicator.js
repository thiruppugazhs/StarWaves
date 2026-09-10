import { THEME_MODE_KEY } from '../lib/storageKeys'
// Theme application primitives — zero imports.
// Extracted from presets.js so the startup path (App -> applyThemeVariables)
// never pays for the 25 raw CSS preset strings or the customizer hook.
// presets.js re-exports everything below for backward compatibility.

export const FONT_OPTIONS = [
  { id: 'inter', name: 'Inter (Default)', value: "'Inter', sans-serif" },
  { id: 'roboto', name: 'Roboto', value: "'Roboto', sans-serif" },
  { id: 'outfit', name: 'Outfit', value: "'Outfit', sans-serif" },
  { id: 'jakarta', name: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
  { id: 'fira', name: 'Fira Code (Monospace)', value: "'Fira Code', monospace" },
  { id: 'system', name: 'System Default UI', value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
]

export const RADIUS_OPTIONS = [
  {
    id: 'sharp',
    name: 'Sharp (0px)',
    tokens: {
      '--radius-xs': '0px',
      '--radius-sm': '0px',
      '--radius-md': '0px',
      '--radius-lg': '0px',
      '--radius-xl': '0px',
    },
  },
  {
    id: 'subtle',
    name: 'Subtle (4px)',
    tokens: {
      '--radius-xs': '2px',
      '--radius-sm': '4px',
      '--radius-md': '6px',
      '--radius-lg': '8px',
      '--radius-xl': '10px',
    },
  },
  {
    id: 'modern',
    name: 'Modern Soft (9px)',
    tokens: {
      '--radius-xs': '4px',
      '--radius-sm': '6px',
      '--radius-md': '9px',
      '--radius-lg': '12px',
      '--radius-xl': '16px',
    },
  },
  {
    id: 'rounded',
    name: 'Rounded (16px)',
    tokens: {
      '--radius-xs': '6px',
      '--radius-sm': '10px',
      '--radius-md': '14px',
      '--radius-lg': '18px',
      '--radius-xl': '24px',
    },
  },
  {
    id: 'bubble',
    name: 'Curved Bubble (24px)',
    tokens: {
      '--radius-xs': '8px',
      '--radius-sm': '14px',
      '--radius-md': '20px',
      '--radius-lg': '28px',
      '--radius-xl': '36px',
    },
  },
]

export const DENSITY_OPTIONS = [
  {
    id: 'compact',
    name: 'Compact (Power User)',
    tokens: {
      '--layout-card-padding': '12px',
      '--layout-section-gap': '16px',
      '--layout-gutter': '16px',
    },
  },
  {
    id: 'default',
    name: 'Default Balanced',
    tokens: {
      '--layout-card-padding': 'clamp(16px, 1.8vw, 22px)',
      '--layout-section-gap': 'clamp(18px, 2.2vw, 28px)',
      '--layout-gutter': 'clamp(16px, 3vw, 40px)',
    },
  },
  {
    id: 'spacious',
    name: 'Spacious (Relaxed)',
    tokens: {
      '--layout-card-padding': '28px',
      '--layout-section-gap': '36px',
      '--layout-gutter': '48px',
    },
  },
]

export const ELEVATION_OPTIONS = [
  {
    id: 'flat',
    name: 'Flat Minimalist (No Shadows)',
    tokens: {
      '--shadow-sm': 'none',
      '--shadow-md': 'none',
      '--shadow-lg': 'none',
      '--shadow-surface': 'none',
    },
  },
  {
    id: 'subtle',
    name: 'Subtle Modern Elevation',
    tokens: {
      '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.04)',
      '--shadow-md': '0 4px 8px rgba(0, 0, 0, 0.06)',
      '--shadow-lg': '0 12px 30px rgba(0, 0, 0, 0.1)',
      '--shadow-surface': '0 2px 8px rgba(0, 0, 0, 0.05)',
    },
  },
  {
    id: 'deep',
    name: 'Deep 3D Floating Surfaces',
    tokens: {
      '--shadow-sm': '0 2px 6px rgba(0, 0, 0, 0.12)',
      '--shadow-md': '0 8px 24px rgba(0, 0, 0, 0.18)',
      '--shadow-lg': '0 25px 60px rgba(0, 0, 0, 0.28)',
      '--shadow-surface': '0 4px 18px rgba(0, 0, 0, 0.15)',
    },
  },
]

export const MOTION_OPTIONS = [
  {
    id: 'none',
    name: 'Instant (0ms)',
    tokens: {
      '--transition-fast': '0ms',
      '--transition-normal': '0ms',
      '--transition-slow': '0ms',
    },
  },
  {
    id: 'fast',
    name: 'Fast Snap (100ms)',
    tokens: {
      '--transition-fast': '80ms ease',
      '--transition-normal': '120ms ease',
      '--transition-slow': '180ms ease',
    },
  },
  {
    id: 'normal',
    name: 'Smooth Default (200ms)',
    tokens: {
      '--transition-fast': '140ms ease',
      '--transition-normal': '200ms ease',
      '--transition-slow': '300ms ease',
    },
  },
  {
    id: 'relaxed',
    name: 'Relaxed Fluid (350ms)',
    tokens: {
      '--transition-fast': '200ms ease',
      '--transition-normal': '350ms ease',
      '--transition-slow': '500ms ease',
    },
  },
]

export const COLOR_VARIABLE_GROUPS = [
  {
    title: 'Main & Surface Backgrounds',
    variables: [
      { key: '--bg-primary', label: 'Main Page Background' },
      { key: '--bg-secondary', label: 'Sidebar & Header Background' },
      { key: '--bg-tertiary', label: 'Sub-panel Background' },
      { key: '--bg-card', label: 'Card & Container Surface' },
      { key: '--bg-card-hover', label: 'Card Hover Background' },
      { key: '--bg-hover', label: 'Interactive Hover Background' },
      { key: '--bg-overlay', label: 'Modal & Popover Surface' },
    ],
  },
  {
    title: 'Text & Typography',
    variables: [
      { key: '--text-primary', label: 'Primary Heading & Body Text' },
      { key: '--text-secondary', label: 'Secondary / Subtitle Text' },
      { key: '--text-muted', label: 'Muted / Caption Text' },
      { key: '--text-inverse', label: 'Button & Inverted Text' },
    ],
  },
  {
    title: 'Buttons & Accents',
    variables: [
      { key: '--color-primary', label: 'Primary Button & Active Fill' },
      { key: '--color-primary-hover', label: 'Primary Button Hover Fill' },
      { key: '--color-primary-light', label: 'Primary Light Badge Tint' },
      { key: '--color-accent', label: 'Accent Highlight' },
    ],
  },
  {
    title: 'Borders & Lines',
    variables: [
      { key: '--border-color', label: 'Standard Component Border' },
      { key: '--border-light', label: 'Light Separator Line' },
      { key: '--border-heavy', label: 'High Contrast Border' },
      { key: '--border-focus', label: 'Active Input Focus Ring' },
    ],
  },
  {
    title: 'Scrollbars',
    variables: [
      { key: '--scrollbar-track', label: 'Scrollbar Track' },
      { key: '--scrollbar-thumb', label: 'Scrollbar Thumb' },
      { key: '--scrollbar-thumb-hover', label: 'Scrollbar Thumb Hover' },
    ],
  },
  {
    title: 'Status & Badges',
    variables: [
      { key: '--color-success', label: 'Success Tag / Indicator' },
      { key: '--color-warning', label: 'Warning Tag / Indicator' },
      { key: '--color-danger', label: 'Danger / Error Tag' },
      { key: '--color-purple', label: 'Special / Category Tag' },
    ],
  },
  {
    title: 'Domain & Module Accents',
    variables: [
      { key: '--module-work', label: 'Work & Projects Accent' },
      { key: '--module-workspace', label: 'Workspace & Terminal Accent' },
      { key: '--module-studio', label: 'Studio & Apps Accent' },
      { key: '--module-eve', label: 'Eve AI Accent' },
      { key: '--module-growth', label: 'Growth & Stats Accent' },
      { key: '--module-whatsapp', label: 'WhatsApp Accent' },
      { key: '--module-mail', label: 'Mail Accent' },
      { key: '--module-calls', label: 'Voice & Calls Accent' },
    ],
  },
]

export function applyThemeVariables(data) {
  if (!data || typeof data !== 'object') return
  const root = document.documentElement

  // Apply colors
  if (data.colors && typeof data.colors === 'object') {
    Object.entries(data.colors).forEach(([property, value]) => {
      if (property.startsWith('--') && value) {
        root.style.setProperty(property, value)
      }
    })
  }

  // Determine dark / light mode
  const lightPresets = ['light', 'prism', 'coral', 'honey', 'azure', 'meadow', 'lilac', 'citrus']
  let isDark = true
  if (data.mode === 'light' || data.mode === 'dark') {
    isDark = data.mode === 'dark'
  } else if (data.preset) {
    isDark = !lightPresets.includes(data.preset)
  } else {
    const stored = localStorage.getItem(THEME_MODE_KEY)
    isDark = stored ? stored === 'dark' : true
  }

  root.classList.toggle('dark-theme', isDark)
  try {
    localStorage.setItem(THEME_MODE_KEY, isDark ? 'dark' : 'light')
  } catch {}

  // Update theme-color meta tag for browser/mobile status bar
  const bgPrimary = data.colors?.['--bg-primary'] || (isDark ? '#0d080a' : '#f4f4f5')
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', bgPrimary)
  }

  // Apply Font
  if (data.fontFamily) {
    const fontOpt = FONT_OPTIONS.find((f) => f.id === data.fontFamily)
    if (fontOpt) {
      root.style.setProperty('--font-family', fontOpt.value)
    }
  }

  // Apply Radius
  if (data.radius) {
    const radOpt = RADIUS_OPTIONS.find((r) => r.id === data.radius)
    if (radOpt) {
      Object.entries(radOpt.tokens).forEach(([k, v]) => root.style.setProperty(k, v))
    }
  }

  // Apply Density
  if (data.density) {
    const denOpt = DENSITY_OPTIONS.find((d) => d.id === data.density)
    if (denOpt) {
      Object.entries(denOpt.tokens).forEach(([k, v]) => root.style.setProperty(k, v))
    }
  }

  // Apply Elevation
  if (data.elevation) {
    const elevOpt = ELEVATION_OPTIONS.find((e) => e.id === data.elevation)
    if (elevOpt) {
      Object.entries(elevOpt.tokens).forEach(([k, v]) => root.style.setProperty(k, v))
    }
  }

  // Apply Motion
  if (data.motion) {
    const motOpt = MOTION_OPTIONS.find((m) => m.id === data.motion)
    if (motOpt) {
      Object.entries(motOpt.tokens).forEach(([k, v]) => root.style.setProperty(k, v))
    }
  }
}

export function resetThemeVariables() {
  const root = document.documentElement
  COLOR_VARIABLE_GROUPS.forEach((group) => {
    group.variables.forEach((item) => {
      root.style.removeProperty(item.key)
    })
  })
  root.style.removeProperty('--font-family')
  if (RADIUS_OPTIONS[2].tokens) {
    Object.keys(RADIUS_OPTIONS[2].tokens).forEach((k) => root.style.removeProperty(k))
  }
  if (DENSITY_OPTIONS[1].tokens) {
    Object.keys(DENSITY_OPTIONS[1].tokens).forEach((k) => root.style.removeProperty(k))
  }
  if (ELEVATION_OPTIONS[1].tokens) {
    Object.keys(ELEVATION_OPTIONS[1].tokens).forEach((k) => root.style.removeProperty(k))
  }
  if (MOTION_OPTIONS[2].tokens) {
    Object.keys(MOTION_OPTIONS[2].tokens).forEach((k) => root.style.removeProperty(k))
  }
}
