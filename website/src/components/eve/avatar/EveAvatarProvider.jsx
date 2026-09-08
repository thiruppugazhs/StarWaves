import { createContext, useContext, useMemo } from 'react'
import { useCustomUI } from '../../../hooks/useCustomUI'
import { useAvatarPref } from './useAvatarPref'

const EveAvatarContext = createContext(null)

export function EveAvatarProvider({ children }) {
  const { prefs: uiPrefs } = useCustomUI() || {}
  // uiPrefs is the whole preferences doc; eve_avatar lives at doc.eve_avatar
  const eveUi = uiPrefs?.eve_avatar ? uiPrefs : uiPrefs?.preferences?.eve_avatar ? uiPrefs.preferences : uiPrefs
  // Normalize: CustomUIProvider stores { global_tokens, pages, eve_avatar? } at top level
  const rawEve = eveUi?.eve_avatar ?? uiPrefs?.eve_avatar ?? null
  const { prefs, setPrefs, activeModel } = useAvatarPref({ uiPrefs: rawEve ? { eve_avatar: rawEve } : null })

  const value = useMemo(() => ({ prefs, setPrefs, activeModel, rawEve }), [activeModel, prefs, rawEve, setPrefs])
  return <EveAvatarContext.Provider value={value}>{children}</EveAvatarContext.Provider>
}

export function useEveAvatar() {
  const ctx = useContext(EveAvatarContext)
  if (!ctx) return { prefs: null, setPrefs: () => {}, activeModel: null }
  return ctx
}
