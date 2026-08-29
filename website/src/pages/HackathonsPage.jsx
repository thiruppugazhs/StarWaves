import { useEffect, useState } from 'react'
import {
  CalendarDays,
  ExternalLink,
  Filter,
  MapPin,
  Pencil,
  Plus,
  Rocket,
  Trash2,
  Users,
} from 'lucide-react'
import { usePersistentState } from '../hooks/usePersistentState'
import { createHackathon, deleteHackathon, updateHackathon } from '../lib/workspaceApi'
import { ConfirmDialog, CustomDropdown, EmptyState, FilterBar, MetricCard, MetricGrid, Modal, PageHeader, SearchBar, Alert } from '../components/ui'

const emptyHackathon = {
  title: '',
  organizer: '',
  startsAt: '',
  endsAt: '',
  mode: 'Online',
  teamSize: '',
  tags: '',
  url: '',
}

export function HackathonsPage({ hackathons, setHackathons, canLoadMore, loadingMore, onLoadMore, onOpenHackathon }) {
  const [cardLayout, setCardLayout] = useState(
    () => window.localStorage.getItem('starwaves-hackathon-layout') || 'compact',
  )
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem('starwaves-hackathon-layout', cardLayout)
  }, [cardLayout])
  const [form, setForm] = useState(emptyHackathon)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingHackathon, setEditingHackathon] = useState(null)
  const [editForm, setEditForm] = useState(emptyHackathon)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [modeFilter, setModeFilter] = usePersistentState('starwaves.hackathons.mode', 'All formats')
  const [sourceFilter, setSourceFilter] = usePersistentState('starwaves.hackathons.source', 'All sources')
  const [sortOrder, setSortOrder] = usePersistentState('starwaves.hackathons.sort', 'Soonest')

  const sourceOptions = [...new Set(hackathons.map((item) => item.source || 'manual'))]
  const filteredHackathons = hackathons
    .filter((hackathon) => {
      const haystack = [hackathon.title, hackathon.organizer, hackathon.mode, ...(Array.isArray(hackathon.tags) ? hackathon.tags : [])]
        .join(' ')
        .toLowerCase()
      return (!searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase()))
        && (modeFilter === 'All formats' || hackathon.mode === modeFilter)
        && (sourceFilter === 'All sources' || (hackathon.source || 'manual') === sourceFilter)
    })
    .sort((first, second) => {
      const direction = sortOrder === 'Latest' ? -1 : 1
      return (new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()) * direction
    })

  const clearFilters = () => {
    setSearchQuery('')
    setModeFilter('All formats')
    setSourceFilter('All sources')
    setSortOrder('Soonest')
  }

  useEffect(() => {
    const rawFocus = localStorage.getItem('starwaves.hackathon-focus')
    if (!rawFocus) return

    try {
      const { hackathonId } = JSON.parse(rawFocus)
      const focusedHackathon = hackathons.find((hackathon) => hackathon.id === hackathonId)
      if (focusedHackathon) onOpenHackathon?.(focusedHackathon.id)
    } finally {
      localStorage.removeItem('starwaves.hackathon-focus')
    }
  }, [hackathons, onOpenHackathon])

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateEditField = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  const submitHackathon = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const hackathon = await createHackathon({
        ...form,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
      setHackathons((current) => [...current, hackathon].sort(
        (first, second) =>
          new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
      ))
      setForm(emptyHackathon)
      setFormOpen(false)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (hackathon) => {
    setEditingHackathon(hackathon)
    setEditForm({
      title: hackathon.title || '',
      organizer: hackathon.organizer || '',
      startsAt: hackathon.startsAt ? new Date(hackathon.startsAt).toISOString().slice(0, 16) : '',
      endsAt: hackathon.endsAt ? new Date(hackathon.endsAt).toISOString().slice(0, 16) : '',
      mode: hackathon.mode || 'Online',
      teamSize: hackathon.teamSize || '',
      tags: Array.isArray(hackathon.tags) ? hackathon.tags.join(', ') : '',
      url: hackathon.url || '',
    })
    setEditError('')
  }

  const saveHackathonEdit = async (event) => {
    event.preventDefault()
    if (!editingHackathon) return
    setEditSaving(true)
    setEditError('')
    try {
      const updated = await updateHackathon(editingHackathon.id, {
        ...editForm,
        tags: editForm.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
      setHackathons((current) =>
        current.map((item) => (item.id === editingHackathon.id ? updated : item)),
      )
      setEditingHackathon(null)
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteHackathon = async (hackathonId) => {
    setDeleteId(hackathonId)
  }

  const confirmDeleteHackathon = async () => {
    const hackathonId = deleteId
    setDeleteId(null)
    if (!hackathonId) return
    try {
      await deleteHackathon(hackathonId)
      setHackathons((current) => current.filter((item) => item.id !== hackathonId))
    } catch (err) {
      setEditError(err.message || 'Could not delete hackathon.')
    }
  }

  return (
    <section className="hackathons-page">
      <PageHeader
        eyebrow="Build & collaborate"
        title="Hackathons"
        description="Find a room, a team, and a deadline worth building toward."
        actions={
          <>
            <div className="hackathon-summary">
              <Rocket size={16} />
              <span>{hackathons.length} upcoming</span>
            </div>
            <button className="primary-button" onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Add hackathon
            </button>
          </>
        }
      />

      <MetricGrid className="workspace-insight-grid" ariaLabel="Hackathon overview">
        <MetricCard className="compact" label="Opportunities" value={hackathons.length} detail="in your pipeline" />
        <MetricCard className="compact" label="Online" value={hackathons.filter((item) => item.mode === 'Online').length} detail="join from anywhere" />
        <MetricCard className="compact" label="Next step" value={hackathons.length ? 'Choose' : 'Add one'} detail={hackathons.length ? 'a challenge to pursue' : 'your first challenge'} />
      </MetricGrid>

      <FilterBar
        className="hackathon-toolbar"
        search={
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name, organizer, or skill"
            ariaLabel="Search hackathons"
          />
        }
        filters={
          <>
            <Filter size={15} className="text-muted" aria-hidden="true" />
            <CustomDropdown
              value={modeFilter}
              onChange={setModeFilter}
              ariaLabel="Filter by format"
              options={[
                { value: 'All formats', label: 'All formats' },
                { value: 'Online', label: 'Online' },
                { value: 'In person', label: 'In person' },
                { value: 'Hybrid', label: 'Hybrid' },
              ]}
            />
            <CustomDropdown
              value={sourceFilter}
              onChange={setSourceFilter}
              ariaLabel="Filter by source"
              options={[
                { value: 'All sources', label: 'All sources' },
                ...sourceOptions.map((source) => ({
                  value: source,
                  label: source === 'manual' ? 'Manual' : source.toUpperCase(),
                })),
              ]}
            />
            <CustomDropdown
              value={sortOrder}
              onChange={setSortOrder}
              ariaLabel="Sort hackathons"
              options={[
                { value: 'Soonest', label: 'Soonest' },
                { value: 'Latest', label: 'Latest' },
              ]}
            />
            <CustomDropdown
              value={cardLayout}
              onChange={setCardLayout}
              ariaLabel="Customize card layout"
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'spacious', label: 'Spacious' },
              ]}
            />
          </>
        }
        isFiltered={Boolean(searchQuery || modeFilter !== 'All formats' || sourceFilter !== 'All sources' || sortOrder !== 'Soonest')}
        onReset={clearFilters}
      />
      <div className="hackathon-results-meta"><span>{filteredHackathons.length} of {hackathons.length} opportunities</span><span>{filteredHackathons.length ? 'Open one to see the details' : 'Try a different filter'}</span></div>

      <div className={`hackathon-list hackathon-layout-${cardLayout}`}>
        {filteredHackathons.map((hackathon) => {
          const startsAt = new Date(hackathon.startsAt)
          const endsAt = new Date(hackathon.endsAt)
          const isManual = hackathon.source === 'manual'

          return (
            <article
              className="contest-site-card hackathon-list-card"
              key={hackathon.id}
              data-record-id={hackathon.id}
            >
              <div
                className="contest-site-header"
              >
                <div className="hackathon-card-topline">
                  <span className="hackathon-card-source">{hackathon.source === 'manual' ? 'StarWaves' : hackathon.source.toUpperCase()}</span>
                </div>
                <span className="contest-site-copy">
                  {hackathon.url ? (
                    <a
                      className="hackathon-title-link"
                      href={hackathon.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      title="Open hackathon details page in a new tab"
                    >
                      <strong>{hackathon.title}</strong>
                      <ExternalLink size={13} className="hackathon-link-icon" />
                    </a>
                  ) : (
                    <strong
                      className="hackathon-title-clickable"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenHackathon?.(hackathon.id)
                      }}
                      title="View hackathon details"
                    >
                      {hackathon.title}
                    </strong>
                  )}
                  <small>
                    {hackathon.organizer}
                  </small>
                </span>
                <div className="hackathon-card-meta">
                  <span><CalendarDays size={13} />{startsAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {endsAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>

              <div className="contest-site-content hackathon-detail-content">
                  <div className="hackathon-detail-grid">
                    <div className="hackathon-detail-item">
                      <CalendarDays size={17} />
                      <div>
                        <span>Dates</span>
                        <strong>
                          {startsAt.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                          {' – '}
                          {endsAt.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </strong>
                      </div>
                    </div>
                    <div className="hackathon-detail-item">
                      <MapPin size={17} />
                      <div>
                        <span>Format</span>
                        <strong>{hackathon.mode}</strong>
                      </div>
                    </div>
                    <div className="hackathon-detail-item">
                      <Users size={17} />
                      <div>
                        <span>Team size</span>
                      <strong>{hackathon.teamSize || 'Not specified'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="hackathon-list-footer">
                    <div className="hackathon-tags">
                      {hackathon.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <div className="hackathon-card-actions">
                      <button
                        className="secondary-button hackathon-card-action"
                        type="button"
                        onClick={() => onOpenHackathon?.(hackathon.id)}
                      >
                        All details
                      </button>
                      {isManual && (
                        <>
                          <button
                            className="secondary-button hackathon-card-action"
                            type="button"
                            onClick={() => openEditModal(hackathon)}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            className="secondary-button hackathon-card-action"
                            type="button"
                            onClick={() => handleDeleteHackathon(hackathon.id)}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </>
                      )}
                      {hackathon.url && (
                        <a
                          className="primary-button hackathon-card-action"
                          href={hackathon.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View details <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
              </div>
            </article>
          )
        })}
        {!filteredHackathons.length && (
          <EmptyState
            icon={Rocket}
            title="No hackathons match these filters"
            description="Adjust your search or reset the filters to see more opportunities."
            action={
              <button className="secondary-button" type="button" onClick={clearFilters}>
                Reset filters
              </button>
            }
          />
        )}
      </div>

      {canLoadMore && <button className="secondary-button" type="button" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more hackathons'}</button>}

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        className="document-modal"
        subtitle="Hackathons"
        title="Add hackathon"
      >
        <form className="project-edit-form" onSubmit={submitHackathon}>
          {error && (
            <Alert variant="error" onDismiss={() => setError('')}>
              {error}
            </Alert>
          )}
          <div className="project-edit-form-row">
            <label>Title<input value={form.title} onChange={(event) => updateField('title', event.target.value)} required data-modal-initial-focus /></label>
            <label>Organizer<input value={form.organizer} onChange={(event) => updateField('organizer', event.target.value)} /></label>
          </div>
          <div className="project-edit-form-row">
            <label>Starts<input type="datetime-local" value={form.startsAt} onChange={(event) => updateField('startsAt', event.target.value)} required /></label>
            <label>Ends<input type="datetime-local" value={form.endsAt} onChange={(event) => updateField('endsAt', event.target.value)} required /></label>
          </div>
          <div className="project-edit-form-row">
            <label>Mode<select value={form.mode} onChange={(event) => updateField('mode', event.target.value)}><option>Online</option><option>In person</option><option>Hybrid</option></select></label>
            <label>Team size<input value={form.teamSize} onChange={(event) => updateField('teamSize', event.target.value)} placeholder="1–4 members" /></label>
          </div>
          <label>Tags<input value={form.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder="AI, Web, Open Source" /></label>
          <label>Event URL<input type="url" value={form.url} onChange={(event) => updateField('url', event.target.value)} /></label>
          <div className="todo-modal-actions">
            <button className="secondary-button" type="button" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
            <button className="primary-button" type="submit" disabled={saving}><Plus size={16} />{saving ? 'Saving…' : 'Add hackathon'}</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(editingHackathon)}
        onClose={() => setEditingHackathon(null)}
        className="document-modal"
        subtitle="Hackathons"
        title="Edit hackathon"
      >
        <form className="project-edit-form" onSubmit={saveHackathonEdit}>
          {editError && (
            <Alert variant="error" onDismiss={() => setEditError('')}>
              {editError}
            </Alert>
          )}
          <div className="project-edit-form-row">
            <label>Title<input value={editForm.title} onChange={(event) => updateEditField('title', event.target.value)} required data-modal-initial-focus /></label>
            <label>Organizer<input value={editForm.organizer} onChange={(event) => updateEditField('organizer', event.target.value)} /></label>
          </div>
          <div className="project-edit-form-row">
            <label>Starts<input type="datetime-local" value={editForm.startsAt} onChange={(event) => updateEditField('startsAt', event.target.value)} required /></label>
            <label>Ends<input type="datetime-local" value={editForm.endsAt} onChange={(event) => updateEditField('endsAt', event.target.value)} required /></label>
          </div>
          <div className="project-edit-form-row">
            <label>Mode<select value={editForm.mode} onChange={(event) => updateEditField('mode', event.target.value)}><option>Online</option><option>In person</option><option>Hybrid</option></select></label>
            <label>Team size<input value={editForm.teamSize} onChange={(event) => updateEditField('teamSize', event.target.value)} placeholder="1–4 members" /></label>
          </div>
          <label>Tags<input value={editForm.tags} onChange={(event) => updateEditField('tags', event.target.value)} placeholder="AI, Web, Open Source" /></label>
          <label>Event URL<input type="url" value={editForm.url} onChange={(event) => updateEditField('url', event.target.value)} /></label>
          <div className="todo-modal-actions">
            <button className="secondary-button" type="button" onClick={() => setEditingHackathon(null)} disabled={editSaving}>Cancel</button>
            <button className="primary-button" type="submit" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={Boolean(deleteId)} message="Are you sure you want to delete this manual hackathon entry?" onCancel={() => setDeleteId(null)} onConfirm={confirmDeleteHackathon} />
    </section>
  )
}
