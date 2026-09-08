import lightTheme from '../styles/themes/index.css?raw'
import darkTheme from '../styles/themes/dark.css?raw'
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
import prismTheme from '../styles/themes/prism.css?raw'
import neonGridTheme from '../styles/themes/neon-grid.css?raw'
import botanicalTheme from '../styles/themes/botanical.css?raw'

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
    palette: 'spectrum',
    name: "Starwaves Light",
    description: "Crisp light multi-color theme with rich jewel-toned semantic roles and module accents",
    colors: parseThemeColors(lightTheme),
  },
  dark: {
    id: 'dark',
    mode: 'dark',
    palette: 'spectrum',
    name: "Starwaves Dark",
    description: "Deep obsidian multi-color theme with luminous glowing accents and vibrant semantic roles",
    colors: parseThemeColors(darkTheme),
  },
  prism: {
    id: 'prism',
    mode: 'light',
    palette: 'spectrum',
    name: "Prism Light",
    description: "Crisp light spectrum theme where every semantic role has a unique distinct hue",
    colors: parseThemeColors(prismTheme),
  },
  neonGrid: {
    id: 'neonGrid',
    mode: 'dark',
    palette: 'spectrum',
    name: "Neon Grid",
    description: "High-contrast dark cyber spectrum theme with distinct neon hues per role",
    colors: parseThemeColors(neonGridTheme),
  },
  botanical: {
    id: 'botanical',
    mode: 'dark',
    palette: 'spectrum',
    name: "Botanical Forest",
    description: "Deep forest dark spectrum theme with earthy botanical hues per role",
    colors: parseThemeColors(botanicalTheme),
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
    id: 'spectrum',
    label: 'Multi-Color Spectrum',
    description: 'Vibrant full-spectrum color themes where every semantic role and module has a unique, distinct hue.',
  },
  {
    id: 'duo',
    label: 'Vibrant Duotone',
    description: 'Dynamic two-color themes pairing a neutral canvas with high-energy signature accent hues.',
  },
]

export function getPresetsByPalette(paletteId) {
  return Object.values(THEME_PRESETS).filter((preset) => preset.palette === paletteId)
}

// Re-exported from the leaf module so existing import sites keep working.
// The startup path imports applyThemeVariables directly from
// './themeApplicator' to avoid pulling the preset CSS catalog.
export {
  applyThemeVariables,
  COLOR_VARIABLE_GROUPS,
  DENSITY_OPTIONS,
  ELEVATION_OPTIONS,
  FONT_OPTIONS,
  MOTION_OPTIONS,
  RADIUS_OPTIONS,
  resetThemeVariables,
} from './themeApplicator'
