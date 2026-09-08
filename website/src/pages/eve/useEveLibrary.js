import { useCallback, useState } from 'react'
import { loadAiModels, saveAiModelPreference } from '../../lib/aiModelsApi'
import {
  createEveMemory,
  deleteEveMemory,
  deleteEveSession,
  listEveMemories,
  listEveSessions,
} from '../../lib/eveApi'

const DEFAULT_MODEL = { provider: 'openrouter', model: 'openrouter/free', label: 'Free Models Router' }

export function useEveLibrary({ notifyError, onActiveSessionDeleted }) {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [memories, setMemories] = useState([])
  const [memoryDraft, setMemoryDraft] = useState('')
  const [isAddingMemory, setIsAddingMemory] = useState(false)
  const [isLoadingSidebar, setIsLoadingSidebar] = useState(true)
  const [aiProviders, setAiProviders] = useState([])
  const [activeModel, setActiveModel] = useState(DEFAULT_MODEL)

  const refreshSidebar = useCallback(async () => {
    try {
      const [sessionData, memoryData, modelsData] = await Promise.all([
        listEveSessions().catch(() => ({ sessions: [] })),
        listEveMemories().catch(() => ({ memories: [] })),
        loadAiModels().catch(() => null),
      ])
      setSessions(sessionData.sessions ?? [])
      setMemories(memoryData.memories ?? [])

      if (modelsData?.providers) {
        const available = modelsData.providers.filter((p) => p.available)
        setAiProviders(available)
        const pref = modelsData.preference
        const selectedProv = available.find((p) => p.id === (pref?.provider || '')) || available[0]
        if (selectedProv) {
          const modelObj = selectedProv.models?.find((m) => m.id === (pref?.model || '')) || selectedProv.models?.[0]
          setActiveModel({
            provider: selectedProv.id,
            model: modelObj?.id || pref?.model || selectedProv.default_model || 'openrouter/free',
            label: modelObj?.label || modelObj?.id || 'Free Models Router',
          })
        }
      }
    } catch (sidebarError) {
      notifyError?.(sidebarError.message || 'Could not load Eve sessions and memory.')
    } finally {
      setIsLoadingSidebar(false)
    }
  }, [notifyError])

  const handleSelectAiModel = async (providerId, modelId, modelLabel) => {
    setActiveModel({ provider: providerId, model: modelId, label: modelLabel })
    try {
      await saveAiModelPreference({ provider: providerId, model: modelId })
    } catch (err) {
      console.warn('Could not save model preference:', err)
    }
  }

  const removeSession = async (sessionId) => {
    try {
      await deleteEveSession(sessionId)
      if (activeSessionId === sessionId) onActiveSessionDeleted?.()
      refreshSidebar()
    } catch (sessionError) {
      notifyError?.(sessionError.message || 'Could not delete that Eve session.')
    }
  }

  const addMemory = async (e) => {
    e.preventDefault()
    const content = memoryDraft.trim()
    if (!content || isAddingMemory) return
    setIsAddingMemory(true)
    notifyError?.('')
    try {
      const memoryData = await createEveMemory(content)
      setMemories(memoryData.memories ?? [])
      setMemoryDraft('')
    } catch (memoryError) {
      notifyError?.(memoryError.message || 'Could not save that memory.')
    } finally {
      setIsAddingMemory(false)
    }
  }

  const removeMemory = async (memoryId) => {
    try {
      await deleteEveMemory(memoryId)
      setMemories((current) => current.filter((memory) => memory.id !== memoryId))
    } catch (memoryError) {
      notifyError?.(memoryError.message || 'Could not delete that memory.')
    }
  }

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    memories,
    memoryDraft,
    setMemoryDraft,
    isAddingMemory,
    isLoadingSidebar,
    aiProviders,
    activeModel,
    refreshSidebar,
    handleSelectAiModel,
    removeSession,
    addMemory,
    removeMemory,
  }
}
