import "../../styles/pages/studio-shared.css"
import "../../styles/pages/studio-gallery.css"
import { useMemo, useState } from 'react'
import { AppWindow, ExternalLink, FileCode, Play, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { ConfirmDialog, EmptyState, LoadingState, SearchBar, SectionHeading } from '../../components/ui'
import { startPreview } from '../../lib/studioApi'
import { ProjectCard } from './ProjectCard'
import { useStudioProjects } from './useStudioProjects'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function StudioAppsPage({ onOpenProject, onNavigate }) {
  const { projects, isLoading, error, refresh, remove } = useStudioProjects()
  const [runningId, setRunningId] = useState(null)
  const [runError, setRunError] = useState('')
  const [projectToDelete, setProjectToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return projects

    return projects.filter((project) =>
      [project.name, project.description, project.stack]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    )
  }, [projects, searchQuery])

  const draftProjects = filteredProjects.filter((project) => project.build_status !== 'ready')
  const builtApps = filteredProjects.filter((project) => project.build_status === 'ready')

  const handleRunApp = async (project) => {
    if (runningId) return
    setRunningId(project.id)
    setRunError('')
    try {
      const { preview_url: previewUrl } = await startPreview(project.id)
      window.open(previewUrl, '_blank', 'noopener')
    } catch (previewError) {
      setRunError(previewError.message || 'Could not start the app preview.')
    } finally {
      setRunningId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!projectToDelete || isDeleting) return
    setIsDeleting(true)
    try {
      await remove(projectToDelete.id)
      setProjectToDelete(null)
    } catch (deleteError) {
      console.error('Could not delete Studio project:', deleteError)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="studio-page studio-page-gallery">
      <header className="studio-section-header studio-gallery-header">
        <SearchBar
          className="studio-apps-search"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search apps"
          ariaLabel="Search apps"
        />
        <div className="page-inline-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => onNavigate?.('studio')}
        >
          <Plus size={15} />
          New App
        </button>
        <button type="button" className="secondary-button" onClick={refresh}>
          <RefreshCw size={15} />
          Refresh
        </button>
        </div>
      </header>
      {(error || runError) && (
        <div className="studio-error-banner" role="alert">
          <span>{runError || error}</span>
          <button type="button" onClick={runError ? () => setRunError('') : refresh}>Retry</button>
        </div>
      )}

      {isLoading ? (
        <LoadingState message="Loading your apps…" />
      ) : (
        <>
          {draftProjects.length > 0 && (
            <section className="studio-apps-section" aria-label="In-progress projects">
              <SectionHeading
                title="In progress"
                description="Drafts and apps Eve is still building."
              />
              <div className="studio-project-grid">
                {draftProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={onOpenProject}
                    onDelete={setProjectToDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {builtApps.length > 0 ? (
            <section className="studio-apps-section" aria-label="Finished apps">
              <div className="studio-project-grid">
                {builtApps.map((project) => (
                  <article key={project.id} className="studio-project-card">
                    <div className="studio-project-card-icon" aria-hidden="true">
                      <AppWindow size={22} />
                    </div>
                    <div className="studio-project-card-body">
                      <h3 className="studio-project-card-title">{project.name}</h3>
                      {project.description && (
                        <p className="studio-project-card-desc">{project.description}</p>
                      )}
                      <div className="studio-project-card-meta">
                        {project.stack && <span className="studio-stack-tag">{project.stack}</span>}
                        <span className="studio-file-count">
                          <FileCode size={12} /> {project.file_count} files
                        </span>
                        <span className="studio-file-count">Updated {formatDate(project.updated_at)}</span>
                        <span className={`studio-preview-state ${project.preview_status}`}>
                          {project.preview_status === 'ready' ? 'Preview ready' : 'No preview yet'}
                        </span>
                        {project.last_activity && <span className="studio-file-count">{project.last_activity.label}</span>}
                      </div>
                    </div>
                    <div className="studio-project-card-actions">
                      <button
                        type="button"
                        className="primary-button studio-open-btn"
                        onClick={() => onOpenProject?.(project)}
                      >
                        <Play size={14} />
                        Open Builder
                      </button>
                      <button type="button" className="studio-delete-btn" onClick={() => setProjectToDelete(project)}>
                        <Trash2 size={13} /> Delete
                      </button>
                      <button
                        type="button"
                        className="secondary-button studio-open-btn"
                        onClick={() => handleRunApp(project)}
                        disabled={runningId === project.id}
                      >
                        <ExternalLink size={14} />
                        {runningId === project.id ? 'Starting…' : 'Run App'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : draftProjects.length === 0 && projects.length === 0 ? (
            <EmptyState
              icon={AppWindow}
              title="No finished apps yet"
              description='Ask Eve to build one — try "Build a habit tracker app" in Studio.'
            />
          ) : draftProjects.length === 0 ? (
            <EmptyState
              icon={AppWindow}
              title="No matching apps"
              description="Try a different app name, description, or technology."
              action={
                <button type="button" className="secondary-button" onClick={() => setSearchQuery('')}>
                  Clear search
                </button>
              }
            />
          ) : null}
        </>
      )}

      <ConfirmDialog
        isOpen={Boolean(projectToDelete)}
        title="Delete Studio Project"
        message={`Delete "${projectToDelete?.name}"? All files, git history, and preview access are permanently removed.`}
        confirmLabel="Delete Project"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  )
}
