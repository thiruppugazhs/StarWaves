import lightTheme from '../styles/themes/index.css?raw'
import darkTheme from '../styles/themes/dark.css?raw'
import oledTheme from '../styles/themes/oled.css?raw'
import graphiteTheme from '../styles/themes/graphite.css?raw'
import charcoalTheme from '../styles/themes/charcoal.css?raw'
import fogTheme from '../styles/themes/fog.css?raw'
import silverTheme from '../styles/themes/silver.css?raw'
import stoneTheme from '../styles/themes/stone.css?raw'
import smokeTheme from '../styles/themes/smoke.css?raw'
import boneTheme from '../styles/themes/bone.css?raw'
import abyssTheme from '../styles/themes/abyss.css?raw'
import emberTheme from '../styles/themes/ember.css?raw'
import verdantTheme from '../styles/themes/verdant.css?raw'
import nocturneTheme from '../styles/themes/nocturne.css?raw'
import scarletTheme from '../styles/themes/scarlet.css?raw'
import aurumTheme from '../styles/themes/aurum.css?raw'
import coralTheme from '../styles/themes/coral.css?raw'
import honeyTheme from '../styles/themes/honey.css?raw'
import azureTheme from '../styles/themes/azure.css?raw'
import meadowTheme from '../styles/themes/meadow.css?raw'
import lilacTheme from '../styles/themes/lilac.css?raw'
import citrusTheme from '../styles/themes/citrus.css?raw'

function parseThemeColors(cssText) {
  const colors = {}
  const pattern = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g
  let match
  while ((match = pattern.exec(cssText)) !== null) {
    colors[`--${match[1]}`] = match[2].trim()
  }
  return colors
}

export const THEME_PRESETS = {
  light: {
    id: 'light',
    mode: 'light',
    palette: 'mono',
    name: "Default Light",
    description: "Clean monochrome off-white theme",
    colors: parseThemeColors(lightTheme),
  },
  dark: {
    id: 'dark',
    mode: 'dark',
    palette: 'mono',
    name: "Default Dark",
    description: "Sleek dark monochrome theme",
    colors: parseThemeColors(darkTheme),
  },
  oled: {
    id: 'oled',
    mode: 'dark',
    palette: 'mono',
    name: "OLED Pitch Black",
    description: "Ultra dark #000000 background for max contrast",
    colors: parseThemeColors(oledTheme),
  },
  graphite: {
    id: 'graphite',
    mode: 'light',
    palette: 'mono',
    name: "Graphite Steel",
    description: "Cool industrial grey theme with gunmetal surfaces",
    colors: parseThemeColors(graphiteTheme),
  },
  charcoal: {
    id: 'charcoal',
    mode: 'dark',
    palette: 'mono',
    name: "Charcoal Ash",
    description: "Warm charcoal grey theme with soft ash highlights",
    colors: parseThemeColors(charcoalTheme),
  },
  fog: {
    id: 'fog',
    mode: 'light',
    palette: 'mono',
    name: "Fog Grey",
    description: "Cool light grey theme with soft misty surfaces",
    colors: parseThemeColors(fogTheme),
  },
  silver: {
    id: 'silver',
    mode: 'light',
    palette: 'mono',
    name: "Silver Mist",
    description: "Light silvery grey theme with a polished metal feel",
    colors: parseThemeColors(silverTheme),
  },
  stone: {
    id: 'stone',
    mode: 'light',
    palette: 'mono',
    name: "Stone Grey",
    description: "Warm neutral grey theme inspired by natural stone",
    colors: parseThemeColors(stoneTheme),
  },
  smoke: {
    id: 'smoke',
    mode: 'dark',
    palette: 'mono',
    name: "Smoke Grey",
    description: "Deep neutral grey theme with soft charcoal surfaces",
    colors: parseThemeColors(smokeTheme),
  },
  bone: {
    id: 'bone',
    mode: 'light',
    palette: 'mono',
    name: "Bone White",
    description: "Warm off-white theme with gentle ivory surfaces",
    colors: parseThemeColors(boneTheme),
  },
  abyss: {
    id: 'abyss',
    mode: 'dark',
    palette: 'duo',
    name: "Abyss Teal",
    description: "Deep abyss black with luminous cyan teal accent — true two-color duotone",
    colors: parseThemeColors(abyssTheme),
  },
  ember: {
    id: 'ember',
    mode: 'dark',
    palette: 'duo',
    name: "Ember Blaze",
    description: "Charred umber canvas with blazing tangerine accent — two-color warmth",
    colors: parseThemeColors(emberTheme),
  },
  verdant: {
    id: 'verdant',
    mode: 'dark',
    palette: 'duo',
    name: "Verdant Depth",
    description: "Forest obsidian base with emerald glow — polished two-color duo",
    colors: parseThemeColors(verdantTheme),
  },
  nocturne: {
    id: 'nocturne',
    mode: 'dark',
    palette: 'duo',
    name: "Nocturne Violet",
    description: "Ink plum darkness with electric violet lift — moody two-color",
    colors: parseThemeColors(nocturneTheme),
  },
  scarlet: {
    id: 'scarlet',
    mode: 'dark',
    palette: 'duo',
    name: "Scarlet Noir",
    description: "Noir burgundy gloom lit by crimson fire — bold two-color contrast",
    colors: parseThemeColors(scarletTheme),
  },
  aurum: {
    id: 'aurum',
    mode: 'dark',
    palette: 'duo',
    name: "Aurum Obsidian",
    description: "Graphite night veil brushed with gilded amber — luxurious two-color",
    colors: parseThemeColors(aurumTheme),
  },
  coral: {
    id: 'coral',
    mode: 'light',
    palette: 'duo',
    name: "Coral Dawn",
    description: "Warm seashell white blushed with coral rose — airy two-color light",
    colors: parseThemeColors(coralTheme),
  },
  honey: {
    id: 'honey',
    mode: 'light',
    palette: 'duo',
    name: "Honey Parchment",
    description: "Soft parchment glow kissed by honey amber — cozy two-color duo",
    colors: parseThemeColors(honeyTheme),
  },
  azure: {
    id: 'azure',
    mode: 'light',
    palette: 'duo',
    name: "Azure Ice",
    description: "Crisp ice-blue canvas pulsing with sky-blue accent — fresh two-color",
    colors: parseThemeColors(azureTheme),
  },
  meadow: {
    id: 'meadow',
    mode: 'light',
    palette: 'duo',
    name: "Meadow Fresh",
    description: "Airy mint-white meadow lifted by leaf green — natural two-color",
    colors: parseThemeColors(meadowTheme),
  },
  lilac: {
    id: 'lilac',
    mode: 'light',
    palette: 'duo',
    name: "Lilac Dream",
    description: "Lavender mist haze blooming with orchid purple — dreamy two-color",
    colors: parseThemeColors(lilacTheme),
  },
  citrus: {
    id: 'citrus',
    mode: 'light',
    palette: 'duo',
    name: "Citrus Zest",
    description: "Lemon cream sorbet sparked by zesty lime — citrus two-color pop",
    colors: parseThemeColors(citrusTheme),
  },
}

export const PALETTE_GROUPS = [
  {
    id: 'mono',
    label: 'Monochrome',
    description: 'Pure black, white, and grey themes built from a single tonal family.',
  },
  {
    id: 'duo',
    label: 'Two Color',
    description: 'Curated duotone themes — each pairs a neutral canvas with one signature accent hue for a strict two-color identity.',
  },
]

export function getPresetsByPalette(paletteId) {
  return Object.values(THEME_PRESETS).filter((preset) => preset.palette === paletteId)
}

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
