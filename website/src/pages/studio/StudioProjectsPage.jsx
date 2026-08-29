import { useState } from 'react'
import { createStudioProject } from '../../lib/studioApi'
import { StudioHero } from './StudioHero'
import { deriveProjectName } from './studioConstants'
import { setStudioBrief } from './studioBrief'

export function StudioProjectsPage({ onOpenProject }) {
  const [isCreatingFromPrompt, setIsCreatingFromPrompt] = useState(false)
  const [promptError, setPromptError] = useState('')

  const handlePromptSubmit = async (prompt, mode = 'plan', model = 'gpt-5-mini', attachments = []) => {
    setIsCreatingFromPrompt(true)
    setPromptError('')
    try {
      const created = await createStudioProject({
        name: deriveProjectName(prompt),
        description: prompt,
        template_id: null,
        db_preference: 'sqlite',
        auth_enabled: false,
      })
      if (created?.id) {
        setStudioBrief(created.id, { prompt, attachments, mode, model })
        onOpenProject(created)
      }
    } catch (submitError) {
      setPromptError(submitError.message || 'Could not create the project.')
      throw submitError
    } finally {
      setIsCreatingFromPrompt(false)
    }
  }

  return (
    <div className="studio-page">
      <StudioHero
        isSubmitting={isCreatingFromPrompt}
        onSubmitPrompt={handlePromptSubmit}
      />

      {promptError && (
        <div className="studio-error-banner" role="alert">
          <span>{promptError}</span>
        </div>
      )}
    </div>
  )
}
