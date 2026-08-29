import { useCallback, useEffect, useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { EmptyState, FormField, LoadingState, Modal, PageHeader } from '../../components/ui'
import {
  listStudioTemplates,
  remixStudioTemplate,
} from '../../lib/studioApi'

export function StudioTemplatesPage({ onOpenProject }) {
  const [templates, setTemplates] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [remixTarget, setRemixTarget] = useState(null)
  const [remixName, setRemixName] = useState('')
  const [isRemixing, setIsRemixing] = useState(false)
  const [remixError, setRemixError] = useState('')

  const loadTemplates = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setTemplates(await listStudioTemplates())
    } catch (loadError) {
      setError(loadError.message || 'Could not load templates.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const openRemixModal = (template) => {
    setRemixTarget(template)
    setRemixName(`${template.name} copy`)
    setRemixError('')
  }

  const handleRemix = async (event) => {
    event.preventDefault()
    if (!remixName.trim() || isRemixing) return
    setIsRemixing(true)
    setRemixError('')
    try {
      const project = await remixStudioTemplate(remixTarget.id, remixName.trim())
      setRemixTarget(null)
      onOpenProject?.(project)
    } catch (remixError_) {
      setRemixError(remixError_.message || 'Could not create a copy.')
    } finally {
      setIsRemixing(false)
    }
  }

  return (
    <div className="studio-page">
      <PageHeader
        title="Studio Templates"
        description="Curated starters plus templates you published from your own projects."
        actions={
          <button type="button" className="secondary-button" onClick={loadTemplates}>
            Refresh
          </button>
        }
      />

      {error && (
        <div className="studio-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadTemplates}>Retry</button>
        </div>
      )}

      {isLoading ? (
        <LoadingState message="Loading templates…" />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates yet"
          description="Publish one of your Studio projects to reuse it as a starting point."
        />
      ) : (
        <div className="studio-template-grid">
          {templates.map((template) => (
            <article key={template.id} className="studio-template-card">
              <header>
                <LayoutTemplate size={18} />
                <h3>{template.name}</h3>
                <span className={`studio-template-kind ${template.kind}`}>
                  {template.kind === 'custom' ? 'Yours' : 'Curated'}
                </span>
              </header>
              {template.description && <p>{template.description}</p>}
              {template.stack && <span className="studio-stack-tag">{template.stack}</span>}
              <button
                type="button"
                className="primary-button"
                onClick={() => openRemixModal(template)}
              >
                Use Template
              </button>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(remixTarget)}
        onClose={() => setRemixTarget(null)}
        title="Use Template"
        subtitle={remixTarget ? `Create a new Studio project from "${remixTarget.name}"` : ''}
      >
        <form onSubmit={handleRemix}>
          <FormField label="Project name" htmlFor="remix-name">
            <input
              id="remix-name"
              type="text"
              className="text-input"
              value={remixName}
              onChange={(e) => setRemixName(e.target.value)}
              autoFocus
              data-modal-initial-focus
              required
            />
          </FormField>
          {remixError && <p className="studio-form-error" role="alert">{remixError}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setRemixTarget(null)}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={!remixName.trim() || isRemixing}>
              {isRemixing ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
