import { useCallback, useEffect, useRef } from 'react'
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

function applySnapshot(prefs, activePage) {
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

export function useCustomUI() {
  const { activePage } = useRouter()
  const prefsRef = useRef(null)

  useEffect(() => {
    const onUiUpdate = (e) => {
      const prefs = e.detail?.preferences
      if (prefs) {
        prefsRef.current = prefs
        applySnapshot(prefs, activePage)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(prefs))
        } catch {}
      }
    }
    window.addEventListener('eve-ui-update', onUiUpdate)
    return () => window.removeEventListener('eve-ui-update', onUiUpdate)
  }, [activePage])

  const applyPrefs = useCallback(
    (prefs) => {
      prefsRef.current = prefs
      applySnapshot(prefs, activePage)
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(prefs))
      } catch {}
    },
    [activePage],
  )

  const refresh = useCallback(async () => {
    // try cache first for first paint
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        applySnapshot(parsed, activePage)
      }
    } catch {}
    try {
      const res = await getUiPreferences()
      const prefs = res?.preferences
      if (prefs) applyPrefs(prefs)
    } catch {
      // silent — offline or not authed yet
    }
  }, [activePage, applyPrefs])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (prefsRef.current) applySnapshot(prefsRef.current, activePage)
  }, [activePage])

  const handleAction = useCallback(
    (action) => {
      if (!action || typeof action !== 'object') return
      if (action.type === 'apply_ui_overrides' && action.preferences) {
        applyPrefs(action.preferences)
      }
      if (action.type === 'reset_ui' && action.preferences) {
        applyPrefs(action.preferences)
      }
    },
    [applyPrefs],
  )

  return { applyPrefs, refresh, handleAction, applySnapshot }
}
