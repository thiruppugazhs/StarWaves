import "../styles/pages/avatar-overlay.css"
import { useCallback, useEffect, useRef, useState } from "react"
import { EyeOff, X } from "lucide-react"
import { EveAvatar } from "../components/eve/avatar/EveAvatar"
import { AVATAR_OVERLAY_BC_CHANNEL, AVATAR_DEFAULTS } from "../components/eve/avatar/avatarConstants"
import { OVERLAY_POSITION_KEY } from '../lib/storageKeys'


// Reads initial position from localStorage so it persists across sessions
function readSavedPosition() {
  try {
    const raw = localStorage.getItem(OVERLAY_POSITION_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function isTauri() {
  return typeof window !== "undefined" && !!window.__TAURI__
}

async function tauriInvoke(cmd, args) {
  if (!isTauri()) return
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke(cmd, args)
  } catch {}
}

export function AvatarOverlayPage() {
  const [prefs, setPrefs] = useState(AVATAR_DEFAULTS)
  const [eveState, setEveState] = useState({
    isSending: false,
    isEveSpeaking: false,
    isEveThinking: false,
    activeTool: null,
    streamText: "",
    thinkingText: "",
  })
  const [contextMenu, setContextMenu] = useState(null) // { x, y }
  const isDragging = useRef(false)
  const dragStart = useRef(null)  // { mouseX, mouseY, winX, winY }
  const winPos = useRef(readSavedPosition() || { x: 0, y: 0 })

  // ── BroadcastChannel: receive prefs + eve-state from main window ──
  useEffect(() => {
    const bc = new BroadcastChannel(AVATAR_OVERLAY_BC_CHANNEL)
    bc.onmessage = (event) => {
      const { type, payload } = event.data || {}
      if (type === "prefs") setPrefs((c) => ({ ...c, ...payload }))
      if (type === "eve-state") setEveState((c) => ({ ...c, ...payload }))
    }
    return () => bc.close()
  }, [])

  // ── Drag to move overlay window ──
  const handlePointerDown = useCallback(async (event) => {
    // Only trigger on left mouse, not on context menu button areas
    if (event.button !== 0) return
    event.preventDefault()
    isDragging.current = true

    // Get current window screen position from Tauri
    let winX = winPos.current.x
    let winY = winPos.current.y
    try {
      if (isTauri()) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window")
        const pos = await getCurrentWindow().outerPosition()
        winX = pos.x
        winY = pos.y
        winPos.current = { x: winX, y: winY }
      }
    } catch {}

    dragStart.current = {
      mouseX: event.screenX,
      mouseY: event.screenY,
      winX,
      winY,
    }

    const onMove = async (moveEvent) => {
      if (!isDragging.current || !dragStart.current) return
      const dx = moveEvent.screenX - dragStart.current.mouseX
      const dy = moveEvent.screenY - dragStart.current.mouseY
      const newX = dragStart.current.winX + dx
      const newY = dragStart.current.winY + dy
      winPos.current = { x: newX, y: newY }
      await tauriInvoke("move_overlay", { x: newX, y: newY })
    }

    const onUp = () => {
      isDragging.current = false
      dragStart.current = null
      // Persist final position
      try { localStorage.setItem(OVERLAY_POSITION_KEY, JSON.stringify(winPos.current)) } catch {}
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [])

  // ── Right-click context menu ──
  const handleContextMenu = useCallback((event) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => closeContextMenu()
    window.addEventListener("pointerdown", handler)
    return () => window.removeEventListener("pointerdown", handler)
  }, [contextMenu, closeContextMenu])

  const handleHide = async () => {
    closeContextMenu()
    await tauriInvoke("close_overlay")
    // Relay hide back to main window so prefs stay enabled (just window hidden)
    try {
      const bc = new BroadcastChannel(AVATAR_OVERLAY_BC_CHANNEL)
      bc.postMessage({ type: "overlay-hidden" })
      bc.close()
    } catch {}
  }

  const handleClose = async () => {
    closeContextMenu()
    // Relay disable to main window
    try {
      const bc = new BroadcastChannel(AVATAR_OVERLAY_BC_CHANNEL)
      bc.postMessage({ type: "overlay-disabled" })
      bc.close()
    } catch {}
    await tauriInvoke("close_overlay")
  }

  return (
    <div
      className="avatar-overlay-root"
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
    >
      <EveAvatar
        size="lg"
        className="avatar-overlay-character"
        prefs={prefs}
        activeModel={null}
        isSending={eveState.isSending}
        isEveSpeaking={eveState.isEveSpeaking}
        isEveThinking={eveState.isEveThinking}
        thinkingText={eveState.thinkingText}
        activeTool={eveState.activeTool}
        streamText={eveState.streamText}
        sttStatus="idle"
        sttRecording={false}
        error=""
      />

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="overlay-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button type="button" className="overlay-context-menu-item" onClick={handleHide}>
            <EyeOff size={14} /> Hide overlay
          </button>
          <div className="overlay-context-menu-sep" />
          <button type="button" className="overlay-context-menu-item is-danger" onClick={handleClose}>
            <X size={14} /> Close &amp; disable
          </button>
        </div>
      )}
    </div>
  )
}
