import { Suspense, useRef } from 'react'
import { useEyeTracking } from './useEyeTracking'
import { useLipSync } from './useLipSync'

export function EveAvatarCanvas({
  emotion = 'idle',
  mouthOpen = null,
  lookAt = null,
  isBlinking = null,
  reducedMotion = false,
  audioRef = null,
  modelUrl = '',
  renderer = 'vrm',
  onReady,
  onError,
  children,
  style = {},
  className = '',
}) {
  const containerRef = useRef(null)
  const controlled = mouthOpen !== null || lookAt !== null || isBlinking !== null
  const eye = useEyeTracking({ enabled: !reducedMotion && !controlled, containerRef })
  const lip = useLipSync({ isSpeaking: emotion === 'speaking', audioRef, enabled: !reducedMotion && !controlled })

  const effectiveMouth = reducedMotion ? 0 : (mouthOpen ?? lip.mouthOpen ?? 0)
  const effectiveLookAt = reducedMotion ? { x: 0, y: 0 } : (lookAt ?? eye.lookAt)
  const effectiveBlink = reducedMotion ? false : (isBlinking ?? eye.isBlinking)

  return (
    <div
      ref={containerRef}
      className={`eve-avatar-canvas eve-avatar-canvas--${renderer} is-${emotion} ${effectiveBlink ? 'is-blink' : ''} ${reducedMotion ? 'is-reduced' : ''} ${className}`}
      data-eve-target="eve-avatar-canvas"
      data-renderer={renderer}
      data-emotion={emotion}
      style={{ '--eve-mouth-open': String(effectiveMouth), '--eve-look-x': String(effectiveLookAt.x), '--eve-look-y': String(effectiveLookAt.y), ...style }}
      aria-hidden="true"
    >
      <Suspense fallback={<div className="eve-avatar-loading" role="status" aria-label="Loading avatar" />}>
        {children && typeof children === 'function' ? children({ mouthOpen: effectiveMouth, lookAt: effectiveLookAt, isBlinking: effectiveBlink, modelUrl, renderer, onReady, onError, emotion }) : children}
      </Suspense>
      <div className="eve-avatar-canvas-overlay">
        <span className="eve-avatar-emotion-badge">{emotion}</span>
        <span className="eve-avatar-renderer-badge">{renderer}</span>
      </div>
    </div>
  )
}
