import "../../styles/pages/studio-shared.css"
import "../../styles/pages/studio-gallery.css"
import { useCallback, useEffect, useState } from 'react'
import { LayoutTemplate, Search, Sparkles } from 'lucide-react'
import { EmptyState, FormField, LoadingState, Modal } from '../../components/ui'
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
  const [activeCategory, setActiveCategory] = useState('all')

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

  const categories = ['all', ...new Set(templates.map((template) => template.category).filter(Boolean))]
  const visibleTemplates = templates
    .filter((template) => activeCategory === 'all' || template.category === activeCategory)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return (
    <div className="studio-page studio-page-gallery">
      <header className="studio-section-header studio-gallery-header">
        <div>
          <span className="studio-eyebrow"><Sparkles size={13} /> Studio library</span>
          <h2>Start with a strong foundation.</h2>
          <p>Remix a curated stack or return to one of your own patterns.</p>
        </div>
        <div className="page-inline-actions">
        <button type="button" className="secondary-button" onClick={loadTemplates}>
          Refresh
        </button>
        </div>
      </header>

      {templates.length > 0 && (
        <div className="studio-template-toolbar">
          <div className="studio-template-filters" aria-label="Template categories">
            {categories.map((category) => (
              <button key={category} type="button" className={activeCategory === category ? 'active' : ''} onClick={() => setActiveCategory(category)}>
                {category === 'all' ? 'All templates' : category}
              </button>
            ))}
          </div>
          <span className="studio-template-count"><Search size={14} /> {visibleTemplates.length} available</span>
        </div>
      )}

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
          {visibleTemplates.map((template) => (
            <article key={template.id} className="studio-template-card">
              <header>
                <LayoutTemplate size={18} />
                <h3>{template.name}</h3>
                {template.featured && <span className="studio-template-featured">Featured</span>}
                <span className={`studio-template-kind ${template.kind}`}>
                  {template.kind === 'custom' ? 'Yours' : 'Curated'}
                </span>
              </header>
              {template.description && <p>{template.description}</p>}
              {template.tags?.length > 0 && <div className="studio-template-tags">{template.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
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
