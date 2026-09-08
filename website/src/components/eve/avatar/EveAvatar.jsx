import { lazy, Suspense, useMemo, useRef } from 'react'
import { AVATAR_DEFAULTS } from './avatarConstants'
import { EveAvatarCanvas } from './EveAvatarCanvas'
import { avatarCardStyle } from './avatarTokens'
import { useAvatarLifecycle } from './useAvatarLifecycle'
import { useEveAvatarState } from './useEveAvatarState'
import { useEyeTracking } from './useEyeTracking'
import { useLipSync } from './useLipSync'

const VrmModel = lazy(() => import('./VrmModel').then((m) => ({ default: m.VrmModel })))
const Live2DModel = lazy(() => import('./Live2DModel').then((m) => ({ default: m.Live2DModel })))

export function EveAvatar({
  size = 'md',
  presetId = null,
  prefs,
  activeModel,
  // Eve state passthrough
  isSending = false,
  isEveSpeaking = false,
  isEveThinking = false,
  thinkingText = '',
  activeTool = null,
  streamText = '',
  sttStatus = 'idle',
  sttRecording = false,
  error = '',
  audioRef = null,
  onToggleRenderer,
  onTransformChange,
  resetViewSignal = 0,
  className = '',
  style = {},
  chrome = true,
}) {
  const effectivePrefs = prefs || AVATAR_DEFAULTS
  const model = activeModel || { url: '/avatars/vrm/eve-anime.vrm', renderer: 'vrm', id: 'eve-anime-vrm' }
  const containerRef = useRef(null)

  const avatarState = useEveAvatarState({ isSending, isEveSpeaking, isEveThinking, thinkingText, activeTool, streamText, sttStatus, sttRecording, error })
  const lifecycle = useAvatarLifecycle({ renderer: effectivePrefs.renderer, modelUrl: model.url || '' })
  const lip = useLipSync({ isSpeaking: avatarState.isSpeaking, audioRef, enabled: effectivePrefs.motion !== 'reduced' })
  const eye = useEyeTracking({ enabled: effectivePrefs.motion !== 'reduced', containerRef })

  const reducedMotion = effectivePrefs.motion === 'reduced' || lifecycle.prefersReducedMotion
  const emotion = avatarState.emotion

  const tintStyle = avatarCardStyle(presetId, null)
  const scale = effectivePrefs.scale ?? 1
  const zoom = effectivePrefs.zoom ?? 1
  const userPan = effectivePrefs.userPan ?? AVATAR_DEFAULTS.userPan
  const autoRotate = effectivePrefs.autoRotate === true && !reducedMotion

  const resolvedRenderer = lifecycle.resolvedRenderer

  const renderModel = useMemo(() => {
    if (lifecycle.phase === 'timeout' || lifecycle.phase === 'error') {
      return (
        <div className="eve-avatar-error-fallback" role="img" aria-label="Avatar fallback orb">
          <div className={`eve-avatar-orb is-${emotion}`} />
          <span className="eve-avatar-error-text">{lifecycle.error || 'Avatar unavailable'}</span>
        </div>
      )
    }
    if (resolvedRenderer === 'procedural' || !model.url) {
      return (
        <div
          className={`eve-vrm-fallback is-${emotion}`}
          style={{
            '--mouth': String(Math.max(0, Math.min(1, lip.mouthOpen))),
            '--look-x': String(eye.lookAt.x),
            '--look-y': String(eye.lookAt.y),
          }}
        >
          <div className="eve-vrm-head">
            <div className="eve-vrm-face">
              <div className="eve-vrm-eyes">
                <span className="eve-vrm-eye left" />
                <span className="eve-vrm-eye right" />
              </div>
              <div className="eve-vrm-mouth" />
            </div>
            <div className="eve-vrm-hair" />
          </div>
          <div className="eve-vrm-body">
            <div className="eve-vrm-torso" />
          </div>
          <span className="eve-vrm-url" aria-hidden="true">Procedural — lightweight</span>
        </div>
      )
    }
    if (resolvedRenderer === 'live2d') {
      return (
        <Suspense fallback={<div className="eve-avatar-loading">Loading Live2D…</div>}>
          <Live2DModel
            url={model.url}
            mouthOpen={lip.mouthOpen}
            lookAt={eye.lookAt}
            isBlinking={eye.isBlinking}
            emotion={emotion}
            zoom={zoom}
            userPan={userPan}
            resetSignal={resetViewSignal}
            onTransformChange={onTransformChange}
            idleMotion={!reducedMotion}
            onReady={lifecycle.markReady}
            onError={lifecycle.markError}
          />
        </Suspense>
      )
    }
    return (
      <Suspense fallback={<div className="eve-avatar-loading">Loading 3D…</div>}>
        <VrmModel
          url={model.url}
          mouthOpen={lip.mouthOpen}
          lookAt={eye.lookAt}
          isBlinking={eye.isBlinking}
          emotion={emotion}
          zoom={zoom}
          userPan={userPan}
          autoRotate={autoRotate}
          idleMotion={!reducedMotion}
          resetSignal={resetViewSignal}
          onTransformChange={onTransformChange}
          onReady={lifecycle.markReady}
          onError={lifecycle.markError}
        />
      </Suspense>
    )
  }, [autoRotate, emotion, eye.isBlinking, eye.lookAt, lifecycle, lip.mouthOpen, model.url, onTransformChange, reducedMotion, resetViewSignal, resolvedRenderer, userPan, zoom])

  return (
    <div
      ref={containerRef}
      className={`eve-avatar eve-avatar--${size} ${chrome ? '' : 'eve-avatar--bare'} is-${emotion} ${reducedMotion ? 'is-reduced' : ''} ${className}`}
      data-eve-target="eve-avatar"
      data-emotion={emotion}
      data-renderer={resolvedRenderer}
      style={{ ...tintStyle, '--eve-avatar-scale': String(scale), ...style }}
    >
      <div className="eve-avatar-card">
        <div className="eve-avatar-card-header">
          <span className="eve-avatar-title">Eve</span>
          <span className={`eve-avatar-status-dot is-${emotion}`} aria-hidden="true" />
          <span className="eve-avatar-model-label" title={model.id}>{model.id}</span>
          {onToggleRenderer ? (
            <button type="button" className="eve-avatar-renderer-toggle" onClick={onToggleRenderer} aria-label="Toggle avatar renderer" title={`Renderer: ${resolvedRenderer} (click to toggle)`}>
              {resolvedRenderer === 'live2d' ? '2D' : '3D'}
            </button>
          ) : null}
        </div>
        <EveAvatarCanvas
          emotion={emotion}
          mouthOpen={lip.mouthOpen}
          lookAt={eye.lookAt}
          isBlinking={eye.isBlinking}
          reducedMotion={reducedMotion}
          audioRef={audioRef}
          modelUrl={model.url}
          renderer={resolvedRenderer}
          onReady={lifecycle.markReady}
          onError={lifecycle.markError}
        >
          {renderModel}
        </EveAvatarCanvas>
        <div className="eve-avatar-card-footer">
          <span className="eve-avatar-emotion">{emotion}</span>
          {activeTool ? <span className="eve-avatar-tool" title={String(activeTool)}>tool: {String(activeTool).slice(0, 18)}</span> : null}
          {error ? <span className="eve-avatar-error" role="alert">{String(error).slice(0, 60)}</span> : null}
        </div>
      </div>
    </div>
  )
}
