import { useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  MapPin,
  Pencil,
  Rocket,
  Trash2,
  Users,
} from 'lucide-react'
import { deleteHackathon, updateHackathon } from '../lib/workspaceApi'
import { ConfirmDialog, Modal } from '../components/ui'

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

export function HackathonDetailPage({ hackathon, onBack, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(emptyHackathon)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  if (!hackathon) {
    return (
      <section className="hackathons-page">
        <button className="project-back-button" onClick={onBack} type="button">
          <ArrowLeft size={16} /> Back to hackathons
        </button>
        <div className="hackathon-empty-state">
          <Rocket size={22} />
          <strong>Hackathon not found</strong>
          <span>The requested hackathon could not be loaded or may have been deleted.</span>
          <button className="secondary-button" type="button" onClick={onBack}>
            Return to list
          </button>
        </div>
      </section>
    )
  }

  const startsAt = hackathon.startsAt ? new Date(hackathon.startsAt) : null
  const endsAt = hackathon.endsAt ? new Date(hackathon.endsAt) : null
  const isManual = hackathon.source === 'manual'

  const openEdit = () => {
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
    setError('')
    setEditing(true)
  }

  const handleSaveEdit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const updated = await updateHackathon(hackathon.id, {
        ...editForm,
        tags: editForm.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
      onSave?.(updated)
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Failed to update hackathon details.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    const targetId = deleteId
    setDeleteId(null)
    if (!targetId) return
    try {
      await deleteHackathon(targetId)
      onDelete?.(targetId)
      onBack()
    } catch (err) {
      setError(err.message || 'Could not delete hackathon.')
    }
  }

  return (
    <section className="hackathons-page hackathon-detail-page">
      <button className="project-back-button" onClick={onBack} type="button">
        <ArrowLeft size={16} /> Back to hackathons
      </button>

      <div className="page-heading hackathon-detail-header">
        <div>
          <div className="hackathon-card-topline">
            <span className="hackathon-card-source">
              {isManual ? 'StarWaves' : (hackathon.source || '').toUpperCase()}
            </span>
          </div>
          <h1>{hackathon.title}</h1>
          <p className="hackathon-organizer-subhead">
            Organized by <strong>{hackathon.organizer || 'Not specified'}</strong>
          </p>
        </div>
        <div className="page-heading-actions">
          {isManual && (
            <>
              <button className="secondary-button" type="button" onClick={openEdit}>
                <Pencil size={15} /> Edit details
              </button>
              <button className="secondary-button" type="button" onClick={() => setDeleteId(hackathon.id)}>
                <Trash2 size={15} /> Delete
              </button>
            </>
          )}
          {hackathon.url && (
            <a
              className="primary-button"
              href={hackathon.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={15} /> Open external page
            </a>
          )}
        </div>
      </div>

      <div className="workspace-insight-grid hackathon-detail-insights" aria-label="Hackathon overview">
        <div className="workspace-insight-card">
          <span><CalendarDays size={16} /> Start Date</span>
          <strong>{startsAt ? startsAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</strong>
          <small>{startsAt ? startsAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Time not specified'}</small>
        </div>
        <div className="workspace-insight-card">
          <span><CalendarDays size={16} /> End Date</span>
          <strong>{endsAt ? endsAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</strong>
          <small>{endsAt ? endsAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Time not specified'}</small>
        </div>
        <div className="workspace-insight-card">
          <span><MapPin size={16} /> Format</span>
          <strong>{hackathon.mode || 'Online'}</strong>
          <small>Event mode</small>
        </div>
        <div className="workspace-insight-card">
          <span><Users size={16} /> Team Size</span>
          <strong>{hackathon.teamSize || 'Not specified'}</strong>
          <small>Required members</small>
        </div>
      </div>

      <div className="hackathon-detail-section">
        <h3>Tags & Topics</h3>
        {Array.isArray(hackathon.tags) && hackathon.tags.length > 0 ? (
          <div className="hackathon-tags">
            {hackathon.tags.map((tag) => (
              <span key={tag} className="hackathon-tag-pill">{tag}</span>
            ))}
          </div>
        ) : (
          <p className="hackathon-detail-empty-tags">No tags attached to this hackathon.</p>
        )}
      </div>

      {hackathon.url && (
        <div className="hackathon-detail-section">
          <h3>External Event Link</h3>
          <p className="hackathon-url-display">
            <a href={hackathon.url} target="_blank" rel="noopener noreferrer">
              {hackathon.url} <ExternalLink size={14} />
            </a>
          </p>
        </div>
      )}

      <Modal
        isOpen={editing}
        onClose={() => setEditing(false)}
        className="document-modal"
        subtitle="Edit opportunity"
        title={hackathon.title || 'Edit hackathon'}
      >
        <form onSubmit={handleSaveEdit} className="todo-form">
          {error && <div className="auth-error-banner">{error}</div>}
          <div className="form-group">
            <label htmlFor="edit-title">Hackathon title</label>
            <input
              id="edit-title"
              value={editForm.title}
              onChange={(e) => setEditForm((c) => ({ ...c, title: e.target.value }))}
              required
              data-modal-initial-focus
            />
          </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-organizer">Organizer</label>
                  <input
                    id="edit-organizer"
                    value={editForm.organizer}
                    onChange={(e) => setEditForm((c) => ({ ...c, organizer: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-mode">Format</label>
                  <select
                    id="edit-mode"
                    value={editForm.mode}
                    onChange={(e) => setEditForm((c) => ({ ...c, mode: e.target.value }))}
                  >
                    <option value="Online">Online</option>
                    <option value="In person">In person</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-startsAt">Start date & time</label>
                  <input
                    id="edit-startsAt"
                    type="datetime-local"
                    value={editForm.startsAt}
                    onChange={(e) => setEditForm((c) => ({ ...c, startsAt: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-endsAt">End date & time</label>
                  <input
                    id="edit-endsAt"
                    type="datetime-local"
                    value={editForm.endsAt}
                    onChange={(e) => setEditForm((c) => ({ ...c, endsAt: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-teamSize">Team size</label>
                  <input
                    id="edit-teamSize"
                    value={editForm.teamSize}
                    onChange={(e) => setEditForm((c) => ({ ...c, teamSize: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-tags">Tags (comma separated)</label>
                  <input
                    id="edit-tags"
                    value={editForm.tags}
                    onChange={(e) => setEditForm((c) => ({ ...c, tags: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="edit-url">Event page URL</label>
                <input
                  id="edit-url"
                  type="url"
                  value={editForm.url}
                  onChange={(e) => setEditForm((c) => ({ ...c, url: e.target.value }))}
                />
              </div>
              <div className="todo-modal-actions">
                <button className="secondary-button" type="button" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        title="Delete hackathon"
        message="Are you sure you want to delete this hackathon? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </section>
  )
}
