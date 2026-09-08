import { useEffect, useState } from 'react'
import { useThemeCustomizer } from '../../../hooks/useThemeCustomizer'
import { EveGlobalCompanion } from './EveGlobalCompanion'
import { useEveAvatar } from './EveAvatarProvider'

// Returns true when running inside Tauri desktop shell
function isTauri() {
  try { return typeof window !== 'undefined' && !!window.__TAURI__ } catch { return false }
}

// Host mounts inside providers and feeds Eve live state if available via window events.
// Keeps global companion decoupled from AppLayout.
export function EveGlobalCompanionHost() {
  const { prefs, setPrefs, activeModel } = useEveAvatar()
  const { activePreset } = useThemeCustomizer() || {}
  const [eveState, setEveState] = useState({ isSending: false, isEveSpeaking: false, isEveThinking: false, activeTool: null, streamText: '', error: '' })

  useEffect(() => {
    const onState = (event) => {
      const detail = event.detail || {}
      setEveState((current) => ({ ...current, ...detail }))
    }
    window.addEventListener('starwaves:eve-state', onState)
    return () => window.removeEventListener('starwaves:eve-state', onState)
  }, [])

  const handleToggleRenderer = () => {
    const next = prefs?.renderer === 'vrm' ? 'live2d' : prefs?.renderer === 'live2d' ? 'auto' : 'vrm'
    // persist via uiPreferencesApi eventually; for now local
    setPrefs({ renderer: next })
    // also try server persist (fire-and-forget)
    try {
      import('../../../lib/eveAvatarApi').then(({ saveAvatarPreferences }) => {
        saveAvatarPreferences({ ...prefs, renderer: next }).catch(() => {})
      })
    } catch {}
  }

  const handleOpenSettings = () => {
    window.history.pushState({}, '', '/app/setting#settings-eve-avatar')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const handlePrefsChange = (patch) => {
    setPrefs(patch)
    try {
      import('../../../lib/eveAvatarApi').then(({ saveAvatarPreferences }) => {
        saveAvatarPreferences({ ...prefs, ...patch }).catch(() => {})
      })
    } catch {}
  }

  // On Tauri desktop, the overlay window takes over floating companion duties.
  // Suppress the in-app companion to avoid spawning two WebGL renderers simultaneously.
  if (isTauri() && prefs?.enabled !== false) return null

  return (
    <EveGlobalCompanion
      prefs={prefs}
      activeModel={activeModel}
      presetId={activePreset}
      isSending={eveState.isSending}
      isEveSpeaking={eveState.isEveSpeaking}
      isEveThinking={eveState.isEveThinking}
      thinkingText={eveState.thinkingText}
      activeTool={eveState.activeTool}
      streamText={eveState.streamText}
      sttStatus={eveState.sttStatus}
      sttRecording={eveState.sttRecording}
      error={eveState.error}
      audioRef={null}
      onPrefsChange={handlePrefsChange}
      onOpenSettings={handleOpenSettings}
      onToggleRenderer={handleToggleRenderer}
    />
  )
}
