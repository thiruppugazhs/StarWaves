import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Maximize2, Minimize2, Settings2, X } from 'lucide-react'
import { AVATAR_LIMITS } from './avatarConstants'
import { EveAvatar } from './EveAvatar'
import { COMPANION_EXPANDED_KEY } from '../../../lib/storageKeys'

export function EveGlobalCompanion({
  prefs,
  activeModel,
  presetId,
  isSending,
  isEveSpeaking,
  isEveThinking,
  thinkingText,
  activeTool,
  streamText,
  sttStatus,
  sttRecording,
  error,
  audioRef,
  onPrefsChange,
  onOpenSettings,
  onToggleRenderer,
}) {
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem(COMPANION_EXPANDED_KEY)
    if (saved !== null) return saved === 'true'
    return true
  })
  const [dragging, setDragging] = useState(false)
  const rootRef = useRef(null)
  const pos = prefs?.position || { x: 90, y: 80 }
  const posRef = useRef(pos)
  posRef.current = pos
  const enabled = prefs?.enabled !== false
  const inlineVisibleRef = useRef(false)

  const toggleExpanded = (val) => {
    const next = typeof val === 'function' ? val(expanded) : val
    setExpanded(next)
    try {
      localStorage.setItem(COMPANION_EXPANDED_KEY, String(next))
    } catch {}
  }

  // Collapse to docked pill on Avatar Studio so Studio preview owns the
  // single WebGL context — avoids dual VRM + Live2D renderers on low-end PCs.
  useEffect(() => {
    const isAvatarStudio = typeof window !== 'undefined' && window.location.pathname.includes('/avatar')
    if (isAvatarStudio && expanded) setExpanded(false)
  }, [expanded])

  // Auto-minimize when other inline avatars are visible in viewport (e.g. settings page).
  // CRITICAL: Must exclude our own avatar container to avoid auto-minimizing itself!
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting)
      inlineVisibleRef.current = visible
      if (visible && expanded) setExpanded(false)
    }, { threshold: 0.2 })

    const observeOthers = () => {
      document.querySelectorAll('[data-eve-target="eve-avatar"]').forEach((el) => {
        if (rootRef.current && rootRef.current.contains(el)) return
        observer.observe(el)
      })
    }
    observeOthers()
    const mutations = new MutationObserver(observeOthers)
    mutations.observe(document.body, { childList: true, subtree: true })
    return () => {
      mutations.disconnect()
      observer.disconnect()
    }
  }, [expanded])

  const handlePointerDown = useCallback((event) => {
    if (event.target.closest('button')) return
    const startX = event.clientX
    const startY = event.clientY
    const startPos = { ...posRef.current }
    setDragging(true)
    const onMove = (moveEvent) => {
      const dx = ((moveEvent.clientX - startX) / window.innerWidth) * 100
      const dy = ((moveEvent.clientY - startY) / window.innerHeight) * 100
      const next = {
        x: Math.min(AVATAR_LIMITS.POSITION_MAX, Math.max(AVATAR_LIMITS.POSITION_MIN, startPos.x + dx)),
        y: Math.min(AVATAR_LIMITS.POSITION_MAX, Math.max(AVATAR_LIMITS.POSITION_MIN, startPos.y + dy)),
      }
      onPrefsChange?.({ position: next })
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [onPrefsChange])

  const isLanding = typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '/login' || window.location.pathname === '/signup')
  if (!enabled || isLanding) return null

  const style = {
    left: `${pos.x}%`,
    top: `${pos.y}%`,
    transform: 'translate(-50%, -50%)',
  }

  const hasSpeech = (isEveSpeaking && streamText) || (isEveThinking && thinkingText)

  return (
    <aside
      ref={rootRef}
      className={`eve-global-companion ${expanded ? 'is-expanded' : 'is-docked'} ${dragging ? 'is-dragging' : ''}`}
      style={style}
      data-eve-target="eve-global-companion"
      aria-label="Eve 3D desktop companion"
    >
      {/* Sleek Floating Pill Bar */}
      <div className="eve-global-header" onPointerDown={handlePointerDown} role="toolbar" aria-label="Eve companion controls">
        <div className="eve-global-drag-handle" aria-hidden="true"><Bot size={13} /></div>
        <span className="eve-global-title">Eve</span>
        <div className="eve-global-actions">
          <button
            type="button"
            className="eve-global-icon-btn"
            onClick={() => toggleExpanded((v) => !v)}
            aria-label={expanded ? 'Minimize to pill' : 'Expand 3D Eve'}
            title={expanded ? 'Minimize' : 'Expand 3D Eve'}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button type="button" className="eve-global-icon-btn" onClick={onOpenSettings} aria-label="Open avatar settings" title="Avatar settings">
            <Settings2 size={13} />
          </button>
          <button type="button" className="eve-global-icon-btn" onClick={() => onPrefsChange?.({ enabled: false })} aria-label="Hide companion" title="Hide">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Floating Speech/Thought Bubble when speaking */}
      {expanded && hasSpeech && (
        <div className="eve-global-speech" role="status" aria-live="polite">
          <p>{streamText || thinkingText}</p>
        </div>
      )}

      {/* 3D Character Stage (Transparent Background) */}
      <div className="eve-global-body">
        {expanded ? (
          <EveAvatar
            size="md"
            className="eve-global-character"
            presetId={presetId}
            prefs={prefs}
            activeModel={activeModel}
            isSending={isSending}
            isEveSpeaking={isEveSpeaking}
            isEveThinking={isEveThinking}
            thinkingText={thinkingText}
            activeTool={activeTool}
            streamText={streamText}
            sttStatus={sttStatus}
            sttRecording={sttRecording}
            error={error}
            audioRef={audioRef}
            onToggleRenderer={onToggleRenderer}
          />
        ) : (
          <button type="button" className="eve-global-docked-btn" onClick={() => toggleExpanded(true)} aria-label="Expand Eve 3D companion">
            <span className="eve-global-docked-orb" aria-hidden="true" />
            <span className="eve-global-docked-label">Eve</span>
          </button>
        )}
      </div>
    </aside>
  )
}
