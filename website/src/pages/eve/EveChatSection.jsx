import { EveComposer } from './EveComposer'
import { EveMessageFeed } from './EveMessageFeed'

export function EveChatSection({
  messages,
  draft,
  setDraft,
  isSending,
  streamText = '',
  thinkingText = '',
  toolCalls = [],
  activeTool = null,
  onStop,
  error,
  promptQueue,
  addToQueue,
  removeFromQueue,
  handleSubmit,
  matchingTools,
  matchingPrompts,
  selectTool,
  selectPrompt,
  EVE_PRESET_PROMPTS,
  aiProviders = [],
  activeModel,
  onSelectAiModel,
}) {
  return (
    <main className="eve-chat-section">
      <EveMessageFeed
        messages={messages}
        draft={draft}
        isSending={isSending}
        streamText={streamText}
        thinkingText={thinkingText}
        toolCalls={toolCalls}
        activeTool={activeTool}
        error={error}
        EVE_PRESET_PROMPTS={EVE_PRESET_PROMPTS}
        selectPrompt={selectPrompt}
      />
      <EveComposer
        draft={draft}
        setDraft={setDraft}
        isSending={isSending}
        onStop={onStop}
        promptQueue={promptQueue}
        addToQueue={addToQueue}
        removeFromQueue={removeFromQueue}
        handleSubmit={handleSubmit}
        matchingTools={matchingTools}
        matchingPrompts={matchingPrompts}
        selectTool={selectTool}
        selectPrompt={selectPrompt}
        aiProviders={aiProviders}
        activeModel={activeModel}
        onSelectAiModel={onSelectAiModel}
      />
    </main>
  )
}
