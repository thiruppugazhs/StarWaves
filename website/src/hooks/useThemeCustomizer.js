import { useEffect, useState, useCallback } from 'react'
import {
  THEME_PRESETS,
  applyThemeVariables,
  resetThemeVariables,
} from '../themes/presets'

const STORAGE_KEY = 'starwaves.custom_theme'

export function useThemeCustomizer() {
  const [themeState, setThemeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return {
          preset: parsed.preset || 'custom',
          colors: parsed.colors || THEME_PRESETS.dark.colors,
          fontFamily: parsed.fontFamily || 'inter',
          radius: parsed.radius || 'modern',
          density: parsed.density || 'default',
          elevation: parsed.elevation || 'subtle',
          motion: parsed.motion || 'normal',
        }
      } catch {
        /* fallback */
      }
    }
    const isDark = localStorage.getItem('starwaves.theme') === 'dark'
    return {
      preset: isDark ? 'dark' : 'light',
      colors: THEME_PRESETS[isDark ? 'dark' : 'light'].colors,
      fontFamily: 'inter',
      radius: 'modern',
      density: 'default',
      elevation: 'subtle',
      motion: 'normal',
    }
  })

  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    applyThemeVariables(themeState)
  }, [themeState])

  const selectPreset = useCallback((presetId) => {
    const preset = THEME_PRESETS[presetId]
    if (!preset) return
    const isDarkPreset = preset.mode === 'dark'
    const nextState = {
      ...themeState,
      preset: presetId,
      colors: preset.colors,
    }
    setThemeState(nextState)
    document.documentElement.classList.toggle('dark-theme', isDarkPreset)
    localStorage.setItem('starwaves.theme', isDarkPreset ? 'dark' : 'light')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }, [themeState])

  const updateColor = useCallback((variableKey, colorValue) => {
    setThemeState((prev) => {
      const next = {
        ...prev,
        preset: 'custom',
        colors: { ...prev.colors, [variableKey]: colorValue },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const updateOption = useCallback((optionKey, value) => {
    setThemeState((prev) => {
      const next = { ...prev, [optionKey]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }, [])

  const saveCustomTheme = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(themeState))
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }, [themeState])

  const resetToDefault = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    resetThemeVariables()
    const isDark = localStorage.getItem('starwaves.theme') === 'dark'
    const defaultPreset = isDark ? 'dark' : 'light'
    const defaultState = {
      preset: defaultPreset,
      colors: THEME_PRESETS[defaultPreset].colors,
      fontFamily: 'inter',
      radius: 'modern',
      density: 'default',
      elevation: 'subtle',
      motion: 'normal',
    }
    setThemeState(defaultState)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }, [])

  const exportTheme = useCallback(() => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(themeState, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute(
      'download',
      `starwaves-ui-ux-${themeState.preset || 'custom'}.json`,
    )
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }, [themeState])

  const importTheme = useCallback((themeData) => {
    if (themeData) {
      const nextState = {
        preset: themeData.preset || 'custom',
        colors: themeData.colors || THEME_PRESETS.dark.colors,
        fontFamily: themeData.fontFamily || 'inter',
        radius: themeData.radius || 'modern',
        density: themeData.density || 'default',
        elevation: themeData.elevation || 'subtle',
        motion: themeData.motion || 'normal',
      }
      setThemeState(nextState)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    }
  }, [])

  return {
    activePreset: themeState.preset,
    currentColors: themeState.colors,
    fontFamily: themeState.fontFamily,
    radius: themeState.radius,
    density: themeState.density,
    elevation: themeState.elevation,
    motion: themeState.motion,
    isSaved,
    selectPreset,
    updateColor,
    updateOption,
    saveCustomTheme,
    resetToDefault,
    exportTheme,
    importTheme,
  }
}