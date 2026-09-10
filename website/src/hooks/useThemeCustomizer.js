import { useEffect, useState, useCallback } from 'react'
import {
  THEME_PRESETS,
  applyThemeVariables,
  resetThemeVariables,
} from '../themes/presets'
import { CUSTOM_THEME_KEY as STORAGE_KEY, THEME_MODE_KEY, themeExportFilename } from '../lib/storageKeys'


// Crimson Noir is the default (ADR 0028): fresh visitors with no stored
// preference land on dark. Stored 'light' is always respected.
function prefersDarkTheme() {
  const stored = localStorage.getItem(THEME_MODE_KEY)
  return stored ? stored === 'dark' : true
}

export function useThemeCustomizer() {
  const [themeState, setThemeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') {
          const isDark = prefersDarkTheme()
          const fallbackPreset = isDark ? 'dark' : 'light'
          const activePreset = parsed.preset && THEME_PRESETS[parsed.preset] ? parsed.preset : fallbackPreset
          return {
            preset: activePreset,
            mode: parsed.mode || (THEME_PRESETS[activePreset] ? THEME_PRESETS[activePreset].mode : (isDark ? 'dark' : 'light')),
            colors: (parsed.preset === 'custom' && parsed.colors) ? parsed.colors : THEME_PRESETS[activePreset].colors,
            fontFamily: parsed.fontFamily || 'inter',
            radius: parsed.radius || 'modern',
            density: parsed.density || 'default',
            elevation: parsed.elevation || 'subtle',
            motion: parsed.motion || 'normal',
          }
        }
      } catch {
        /* fallback */
      }
    }
    const isDark = prefersDarkTheme()
    const defaultPreset = isDark ? 'dark' : 'light'
    return {
      preset: defaultPreset,
      mode: THEME_PRESETS[defaultPreset].mode,
      colors: THEME_PRESETS[defaultPreset].colors,
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

  useEffect(() => {
    const handleExternalThemeChange = (event) => {
      if (event.detail && typeof event.detail === 'object') {
        setThemeState((prev) => ({
          ...prev,
          ...event.detail,
        }))
      }
    }
    window.addEventListener('starwaves:theme-change', handleExternalThemeChange)
    return () => {
      window.removeEventListener('starwaves:theme-change', handleExternalThemeChange)
    }
  }, [])

  const selectPreset = useCallback((presetId) => {
    const preset = THEME_PRESETS[presetId]
    if (!preset) return
    const nextState = {
      ...themeState,
      preset: presetId,
      mode: preset.mode,
      colors: preset.colors,
    }
    setThemeState(nextState)
    applyThemeVariables(nextState)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    window.dispatchEvent(new CustomEvent('starwaves:theme-change', { detail: nextState }))
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
    const isDark = prefersDarkTheme()
    const defaultPreset = isDark ? 'dark' : 'light'
    const defaultState = {
      preset: defaultPreset,
      mode: THEME_PRESETS[defaultPreset].mode,
      colors: THEME_PRESETS[defaultPreset].colors,
      fontFamily: 'inter',
      radius: 'modern',
      density: 'default',
      elevation: 'subtle',
      motion: 'normal',
    }
    setThemeState(defaultState)
    applyThemeVariables(defaultState)
    window.dispatchEvent(new CustomEvent('starwaves:theme-change', { detail: defaultState }))
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
      themeExportFilename(themeState.preset),
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