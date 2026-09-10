import { useEffect, useRef } from "react"
import { useEveAvatar } from "./EveAvatarProvider"
import { AVATAR_OVERLAY_BC_CHANNEL, AVATAR_DEFAULTS } from "./avatarConstants"
import { OVERLAY_POSITION_KEY } from '../../../lib/storageKeys'


function isTauri() {
  return typeof window !== "undefined" && !!window.__TAURI__
}

async function tauriInvoke(cmd, args) {
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke(cmd, args)
  } catch {}
}

function readSavedPosition() {
  try { return JSON.parse(localStorage.getItem(OVERLAY_POSITION_KEY)) } catch { return null }
}

function getSavedSize(prefs) {
  const size = prefs?.overlaySize || AVATAR_DEFAULTS.overlaySize
  return { w: size.w, h: size.h }
}

// Calculates default bottom-right position based on screen size + overlay size
function defaultPosition(w, h) {
  const screenW = typeof screen !== "undefined" ? screen.width : 1920
  const screenH = typeof screen !== "undefined" ? screen.height : 1080
  return {
    x: Math.max(0, screenW - w - 32),
    y: Math.max(0, screenH - h - 80),
  }
}

/**
 * AvatarOverlayManager — mounts in AppLayout, Tauri-only.
 * Watches prefs.enabled and opens/closes the eve-overlay window accordingly.
 * Also relays eve-state events and prefs changes to the overlay via BroadcastChannel.
 */
export function AvatarOverlayManager() {
  const { prefs } = useEveAvatar()
  const bcRef = useRef(null)
  const overlayOpenRef = useRef(false)
  const prevEnabledRef = useRef(null)

  // Broadcast channel to the overlay window
  useEffect(() => {
    if (!isTauri()) return
    bcRef.current = new BroadcastChannel(AVATAR_OVERLAY_BC_CHANNEL)
    const bc = bcRef.current

    // Listen for messages coming back from the overlay page
    bc.onmessage = (event) => {
      const { type } = event.data || {}
      if (type === "overlay-hidden") {
        // Overlay hid itself (from context menu "Hide") — window hidden but prefs.enabled stays true
        overlayOpenRef.current = false
      }
      if (type === "overlay-disabled") {
        // Overlay closed itself (from context menu "Close & disable") — relay disable to app
        overlayOpenRef.current = false
        // Dispatch a custom event so EveGlobalCompanionHost / AvatarPage can react
        window.dispatchEvent(new CustomEvent("starwaves:overlay-self-disabled"))
      }
    }

    return () => {
      bc.close()
      bcRef.current = null
    }
  }, [])

  // Relay prefs to overlay whenever they change
  useEffect(() => {
    if (!isTauri() || !prefs) return
    bcRef.current?.postMessage({ type: "prefs", payload: prefs })
  }, [prefs])

  // Relay eve-state events to overlay
  useEffect(() => {
    if (!isTauri()) return
    const handler = (event) => {
      bcRef.current?.postMessage({ type: "eve-state", payload: event.detail || {} })
    }
    window.addEventListener("starwaves:eve-state", handler)
    return () => window.removeEventListener("starwaves:eve-state", handler)
  }, [])

  // Open / close overlay window based on prefs.enabled
  useEffect(() => {
    if (!isTauri() || prefs === null) return
    const enabled = prefs?.enabled !== false
    if (prevEnabledRef.current === enabled) return
    prevEnabledRef.current = enabled

    if (enabled) {
      const size = getSavedSize(prefs)
      const savedPos = prefs?.overlayPosition || readSavedPosition()
      const pos = savedPos && savedPos.x != null
        ? savedPos
        : defaultPosition(size.w, size.h)
      tauriInvoke("open_overlay", { x: pos.x, y: pos.y, w: size.w, h: size.h })
      overlayOpenRef.current = true
    } else {
      tauriInvoke("close_overlay")
      overlayOpenRef.current = false
    }
  }, [prefs])

  // Resize overlay when overlaySize changes
  const prevSizeRef = useRef(null)
  useEffect(() => {
    if (!isTauri() || !prefs?.overlaySize) return
    const { w, h } = prefs.overlaySize
    if (prevSizeRef.current?.w === w && prevSizeRef.current?.h === h) return
    prevSizeRef.current = { w, h }
    if (overlayOpenRef.current) {
      tauriInvoke("resize_overlay", { w, h })
    }
  }, [prefs?.overlaySize])

  // No DOM output — purely side-effect manager
  return null
}
