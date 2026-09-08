import { EveAvatar } from './EveAvatar'

export function EveInlineAvatar({ size = 'md', prefs, activeModel, presetId, isSending, isEveSpeaking, isEveThinking, thinkingText, activeTool, streamText, sttStatus, sttRecording, error, audioRef, onToggleRenderer, resetViewSignal = 0 }) {
  return (
    <EveAvatar
      size={size}
      prefs={prefs}
      activeModel={activeModel}
      presetId={presetId}
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
      resetViewSignal={resetViewSignal}
      className="eve-inline-avatar"
    />
  )
}
