/** Projects page — single responsibility: orchestrate project list, filters and dialogs. */
import { useState } from 'react'
import { FolderKanban, LayoutGrid, List, Search, SlidersHorizontal } from 'lucide-react'
import { createProject, deleteProject, updateProject } from '../../lib/workspaceApi'
import { ConfirmDialog, CustomDropdown, EmptyState, FilterBar, FilterPills, PageHeader, SearchBar } from '../../components/ui'
import { usePersistentState } from '../../hooks/usePersistentState'
import { emptyProject } from './constants'
import { useProjectFilters } from './useProjectFilters'
import { ProjectMetrics } from './ProjectMetrics'
import { ProjectGridCard } from './ProjectGridCard'
import { ProjectListCard } from './ProjectListCard'
import { ProjectFormModal } from './ProjectFormModal'

export function ProjectsPage({ projects, setProjects, onOpenProject, canLoadMore, loadingMore, onLoadMore }) {
  const [openProjects, setOpenProjects] = useState(() => new Set([projects[0]?.id]))
  const [viewMode, setViewMode] = usePersistentState('starwaves.projects.view_mode', 'grid')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyProject)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = usePersistentState('starwaves.projects.status', 'All')
  const [sortOrder, setSortOrder] = usePersistentState('starwaves.projects.sort', 'updated')

  const { statusCounts, filteredProjects, hasFilters } = useProjectFilters({ projects, query, statusFilter, sortOrder })

  const resetFilters = () => {
    setQuery('')
    setStatusFilter('All')
    setSortOrder('updated')
  }

  const toggleProject = (projectId) => {
    setOpenProjects((current) => {
      const next = new Set(current)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const submitProject = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const project = await createProject({
        ...form,
        technologies: form.technologies
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
      setProjects((current) => [project, ...current])
      setForm(emptyProject)
      setFormOpen(false)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  const handleQuickProgress = async (event, project, delta) => {
    event.stopPropagation()
    const newProgress = Math.min(100, Math.max(0, (Number(project.progress) || 0) + delta))
    try {
      const updated = await updateProject(project.id, { progress: newProgress })
      setProjects((current) => current.map((item) => (item.id === project.id ? updated : item)))
    } catch (err) {
      setError(err.message || 'Failed to update progress')
    }
  }

  const handleDelete = async (event, projectId) => {
    event.stopPropagation()
    setDeleteId(projectId)
  }

  const confirmDelete = async () => {
    const projectId = deleteId
    setDeleteId(null)
    if (!projectId) return
    try {
      await deleteProject(projectId)
      setProjects((current) => current.filter((p) => p.id !== projectId))
    } catch (err) {
      setError(err.message || 'Failed to delete project')
    }
  }

  return (
    <section className="projects-page">
      <PageHeader
        eyebrow="Work & build"
        title="Projects"
        description="Turn ideas into momentum with a clear view of what is moving."
        actions={
          <>
            <div className="project-summary">
              <FolderKanban size={16} />
              <span>
                {filteredProjects.length} of {projects.length} projects
              </span>
            </div>
            <button className="primary-button" onClick={() => setFormOpen(true)}>
              <Search size={16} style={{ display: 'none' }} />
              Add project
            </button>
          </>
        }
      />

      <ProjectMetrics projects={projects} statusCounts={statusCounts} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />

      <FilterPills
        className="project-status-chips"
        ariaLabel="Status filter options"
        items={['All', 'Active', 'Planning', 'On hold', 'Completed'].map((status) => ({
          id: status,
          label: status === 'All' ? 'All projects' : status,
          count: statusCounts[status] || 0,
        }))}
        activeId={statusFilter}
        onChange={setStatusFilter}
      />

      <FilterBar
        className="project-toolbar"
        search={<SearchBar value={query} onChange={setQuery} placeholder="Search projects, tools, or descriptions" ariaLabel="Search projects" />}
        filters={
          <>
            <SlidersHorizontal size={15} className="text-muted" aria-hidden="true" />
            <CustomDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Filter by status"
              options={['All', 'Active', 'Planning', 'On hold', 'Completed'].map((value) => ({
                value,
                label: value === 'All' ? 'All statuses' : value,
              }))}
            />
            <CustomDropdown
              value={sortOrder}
              onChange={setSortOrder}
              ariaLabel="Sort projects"
              options={[
                { value: 'updated', label: 'Recently updated' },
                { value: 'progress', label: 'Progress' },
                { value: 'name', label: 'Name' },
              ]}
            />
          </>
        }
        actions={
          <div className="project-view-toggle" aria-label="View layout switcher">
            <button type="button" className={`project-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view" aria-label="Switch to grid view">
              <LayoutGrid size={15} />
            </button>
            <button type="button" className={`project-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="List view" aria-label="Switch to list view">
              <List size={15} />
            </button>
          </div>
        }
        isFiltered={Boolean(hasFilters)}
        onReset={resetFilters}
      />

      {viewMode === 'grid' ? (
        <div className="projects-grid-layout" aria-label="Projects grid">
          {filteredProjects.map((project) => (
            <ProjectGridCard key={project.id} project={project} onOpenProject={onOpenProject} onDelete={handleDelete} onQuickProgress={handleQuickProgress} />
          ))}
        </div>
      ) : (
        <div className="project-list" aria-label="Projects list">
          {filteredProjects.map((project) => (
            <ProjectListCard
              key={project.id}
              project={project}
              isOpen={openProjects.has(project.id)}
              onToggle={toggleProject}
              onOpenProject={onOpenProject}
              onDelete={handleDelete}
              onQuickProgress={handleQuickProgress}
            />
          ))}
        </div>
      )}

      {!filteredProjects.length && (
        <EmptyState
          icon={Search}
          title="No projects match these filters"
          description="Try a different search or status."
          action={hasFilters ? <button className="secondary-button" type="button" onClick={resetFilters}>Clear filters</button> : null}
        />
      )}

      {canLoadMore && (
        <button className="secondary-button" type="button" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more projects'}
        </button>
      )}

      <ProjectFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} form={form} setForm={setForm} error={error} setError={setError} saving={saving} onSubmit={submitProject} />
      <ConfirmDialog isOpen={Boolean(deleteId)} message="Are you sure you want to delete this project?" onCancel={() => setDeleteId(null)} onConfirm={confirmDelete} />
    </section>
  )
}
