import { TabNav } from '../../components/ui'
import { EveInlineAvatar } from '../../components/eve/avatar/EveInlineAvatar'
import { EveCallSection } from './EveCallSection'
import { EveChatSection } from './EveChatSection'
import { EveMemorySection } from './EveMemorySection'
import { EveSchedulesSection } from './EveSchedulesSection'
import { EveSessionsSection } from './EveSessionsSection'
import { EVE_TABS } from './eveConstants'

export function EveActiveView({
  activeTab,
  onTabChange,
  avatarPrefs,
  setAvatarPrefs,
  activePreset,
  avatarModel,
  messages,
  draft,
  setDraft,
  isSending,
  streamText,
  thinkingText,
  toolCalls,
  activeTool,
  stopGenerating,
  error,
  promptQueue,
  addToQueue,
  removeFromQueue,
  clearQueue,
  runQueue,
  handleSubmit,
  matchingTools,
  matchingPrompts,
  selectTool,
  selectPrompt,
  EVE_PRESET_PROMPTS,
  aiProviders,
  activeModel,
  onSelectAiModel,
  callCenter,
  sessions,
  activeSessionId,
  isLoadingSidebar,
  resumeSession,
  removeSession,
  startNewChat,
  memories,
  addMemory,
  removeMemory,
  memoryDraft,
  setMemoryDraft,
  isAddingMemory,
  refreshSidebar,
}) {
  const handleAvatarToggleRenderer = () => {
    const next = avatarPrefs?.renderer === 'vrm' ? 'live2d' : avatarPrefs?.renderer === 'live2d' ? 'auto' : 'vrm'
    setAvatarPrefs({ renderer: next })
    import('../../lib/eveAvatarApi').then(({ saveAvatarPreferences }) => { saveAvatarPreferences({ ...avatarPrefs, renderer: next }).catch(() => {}) }).catch(() => {})
  }

  return (
    <div className="eve-page-container">
      <TabNav tabs={EVE_TABS} activeTab={activeTab} onChange={onTabChange} ariaLabel="Eve sections" />
      {activeTab === 'chat' && avatarPrefs?.inlineEnabled !== false && avatarPrefs?.enabled !== false && (
        <div className="eve-inline-avatar-wrap" data-eve-target="eve-inline-avatar">
          <EveInlineAvatar
            size="md"
            presetId={activePreset}
            prefs={avatarPrefs}
            activeModel={avatarModel}
            isSending={isSending}
            isEveSpeaking={Boolean(streamText) && isSending}
            isEveThinking={Boolean(thinkingText) && isSending}
            thinkingText={thinkingText}
            activeTool={activeTool}
            streamText={streamText}
            error={error}
            onToggleRenderer={handleAvatarToggleRenderer}
          />
        </div>
      )}
      <div className="eve-active-view-container full-width">
        {activeTab === 'chat' && (
          <EveChatSection
            messages={messages}
            draft={draft}
            setDraft={setDraft}
            isSending={isSending}
            streamText={streamText}
            thinkingText={thinkingText}
            toolCalls={toolCalls}
            activeTool={activeTool}
            onStop={stopGenerating}
            error={error}
            promptQueue={promptQueue}
            addToQueue={addToQueue}
            removeFromQueue={removeFromQueue}
            clearQueue={clearQueue}
            runQueue={runQueue}
            handleSubmit={handleSubmit}
            matchingTools={matchingTools}
            matchingPrompts={matchingPrompts}
            selectTool={selectTool}
            selectPrompt={selectPrompt}
            EVE_PRESET_PROMPTS={EVE_PRESET_PROMPTS}
            aiProviders={aiProviders}
            activeModel={activeModel}
            onSelectAiModel={onSelectAiModel}
          />
        )}

        {activeTab === 'call' && (
          <EveCallSection
            callCenter={callCenter}
            avatarPrefs={avatarPrefs}
            avatarModel={avatarModel}
            presetId={activePreset}
            onToggleAvatarRenderer={handleAvatarToggleRenderer}
          />
        )}

        {activeTab === 'sessions' && (
          <EveSessionsSection
            sessions={sessions}
            activeSessionId={activeSessionId}
            isLoading={isLoadingSidebar}
            onResumeSession={resumeSession}
            onRemoveSession={removeSession}
            onStartNewChat={startNewChat}
            isSending={isSending}
          />
        )}

        {activeTab === 'memory' && (
          <EveMemorySection
            memories={memories}
            isLoading={isLoadingSidebar}
            onAddMemory={addMemory}
            onRemoveMemory={removeMemory}
            memoryDraft={memoryDraft}
            setMemoryDraft={setMemoryDraft}
            isAddingMemory={isAddingMemory}
            isSending={isSending}
          />
        )}

        {activeTab === 'schedules' && (
          <EveSchedulesSection onScheduleTriggered={refreshSidebar} />
        )}
      </div>
    </div>
  )
}
