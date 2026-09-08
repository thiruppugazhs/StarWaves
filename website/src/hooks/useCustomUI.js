import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getUiPreferences } from '../lib/uiPreferencesApi'
import { useRouter } from './useRouter'

const GLOBAL_STYLE_ID = 'eve-ui-global'
const PAGE_STYLE_PREFIX = 'eve-ui-page-'
const CACHE_KEY = 'starwaves.ui.cache'

function ensureStyleTag(id) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }
  return el
}

function tokensToCss(tokens) {
  if (!tokens || typeof tokens !== 'object' || !Object.keys(tokens).length) return ''
  const decl = Object.entries(tokens)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ')
  return `:root { ${decl} }`
}

export function applySnapshot(prefs, activePage) {
  const globalEl = ensureStyleTag(GLOBAL_STYLE_ID)
  const globalTokensCss = tokensToCss(prefs?.global_tokens)
  const globalCss = prefs?.global_css ? `\n${prefs.global_css}` : ''
  globalEl.textContent = `${globalTokensCss}${globalCss}`

  // remove previous page tags
  document.querySelectorAll(`style[id^="${PAGE_STYLE_PREFIX}"]`).forEach((el) => {
    if (el.id !== `${PAGE_STYLE_PREFIX}${activePage}`) el.remove()
  })

  if (activePage) {
    const pageKey = activePage
    const pageEntry = prefs?.pages?.[pageKey]
    const visEntry = prefs?.pages?.['__global_visibility__']
    const pageEl = ensureStyleTag(`${PAGE_STYLE_PREFIX}${pageKey}`)
    const parts = []
    if (pageEntry?.tokens) parts.push(tokensToCss(pageEntry.tokens))
    if (pageEntry?.css) parts.push(pageEntry.css)
    if (pageEntry?.visibility || visEntry?.visibility) {
      const vis = { ...(visEntry?.visibility || {}), ...(pageEntry?.visibility || {}) }
      Object.entries(vis).forEach(([target, visible]) => {
        if (!visible) parts.push(`[data-eve-target="${target}"]{display:none !important}`)
      })
    }
    pageEl.textContent = parts.join('\n')
  }

  // visibility for global sentinel without page
  const visEntry = prefs?.pages?.['__global_visibility__']
  if (visEntry?.visibility && !activePage) {
    const visEl = ensureStyleTag(`${PAGE_STYLE_PREFIX}global-vis`)
    const rules = Object.entries(visEntry.visibility)
      .filter(([, v]) => !v)
      .map(([t]) => `[data-eve-target="${t}"]{display:none !important}`)
      .join('\n')
    visEl.textContent = rules
  }
}

function readCachedPrefs() {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) return JSON.parse(cached)
  } catch {}
  return null
}

const CustomUIContext = createContext(null)

// Module-level last-fetch guard — prevents storm when multiple consumers mount together
let lastUiFetchAt = 0
const UI_FETCH_DEBOUNCE_MS = 4000

export function CustomUIProvider({ children }) {
  const { activePage } = useRouter()
  const prefsRef = useRef(readCachedPrefs())
  const activePageRef = useRef(activePage)
  activePageRef.current = activePage
  const [prefs, setPrefs] = useState(() => readCachedPrefs())

  // Paint from cache + re-apply stored overrides whenever the route changes.
  // Local only — no network here so page navigation never triggers a fetch.
  useEffect(() => {
    if (prefsRef.current) applySnapshot(prefsRef.current, activePage)
  }, [activePage])

  const applyPrefs = useCallback((nextPrefs) => {
    prefsRef.current = nextPrefs
    setPrefs(nextPrefs)
    applySnapshot(nextPrefs, activePageRef.current)
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(nextPrefs))
    } catch {}
  }, [])

  const refresh = useCallback(async ({ force = false } = {}) => {
    const now = Date.now()
    if (!force && now - lastUiFetchAt < UI_FETCH_DEBOUNCE_MS) return
    lastUiFetchAt = now
    // Apply local cache immediately for first paint
    const cached = readCachedPrefs()
    if (cached && !prefsRef.current) {
      prefsRef.current = cached
      setPrefs(cached)
      applySnapshot(cached, activePageRef.current)
    }
    try {
      const res = await getUiPreferences()
      const next = res?.preferences
      if (next) applyPrefs(next)
    } catch {
      // silent — offline or not authed yet (request.js cache 120s makes re-hits free)
    }
  }, [applyPrefs])

  // One fetch on mount only — activePage changes re-apply locally via the
  // effect above and must not re-fetch (previously refresh depended on
  // activePage, so every navigation re-hit /ui/preferences).
  useEffect(() => {
    refresh()
  }, [refresh])

  // Listen for Eve-driven updates (optimistic — no fetch)
  useEffect(() => {
    const onUiUpdate = (e) => {
      const next = e.detail?.preferences
      if (next) applyPrefs(next)
    }
    window.addEventListener('eve-ui-update', onUiUpdate)
    return () => window.removeEventListener('eve-ui-update', onUiUpdate)
  }, [applyPrefs])

  const handleAction = useCallback(
    (action) => {
      if (!action || typeof action !== 'object') return
      if (action.type === 'apply_ui_overrides' && action.preferences) applyPrefs(action.preferences)
      if (action.type === 'reset_ui' && action.preferences) applyPrefs(action.preferences)
    },
    [applyPrefs],
  )

  const value = { prefs, applyPrefs, refresh, handleAction, applySnapshot }
  return React.createElement(CustomUIContext.Provider, { value }, children)
}

export function useCustomUI() {
  const ctx = useContext(CustomUIContext)
  const { activePage } = useRouter()
  const prefsRef = useRef(readCachedPrefs())
  const fallbackApplyPrefs = useCallback(
    (nextPrefs) => {
      prefsRef.current = nextPrefs
      applySnapshot(nextPrefs, activePage)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(nextPrefs)) } catch {}
    },
    [activePage],
  )
  const fallbackRefresh = useCallback(async () => {
    const cached = readCachedPrefs()
    if (cached) applySnapshot(cached, activePage)
    try {
      const res = await getUiPreferences()
      if (res?.preferences) fallbackApplyPrefs(res.preferences)
    } catch {}
  }, [activePage, fallbackApplyPrefs])
  useEffect(() => { if (!ctx) fallbackRefresh() }, [ctx, fallbackRefresh])
  useEffect(() => { if (!ctx && prefsRef.current) applySnapshot(prefsRef.current, activePage) }, [ctx, activePage])
  const fallbackHandleAction = useCallback((action) => {
    if (!action || typeof action !== 'object') return
    if (action.type === 'apply_ui_overrides' && action.preferences) fallbackApplyPrefs(action.preferences)
    if (action.type === 'reset_ui' && action.preferences) fallbackApplyPrefs(action.preferences)
  }, [fallbackApplyPrefs])
  if (ctx) return ctx
  return { applyPrefs: fallbackApplyPrefs, refresh: fallbackRefresh, handleAction: fallbackHandleAction, applySnapshot, prefs: prefsRef.current }
}
