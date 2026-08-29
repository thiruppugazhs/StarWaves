/** Project form modal — single responsibility: add project dialog. */
import { Plus } from 'lucide-react'
import { Alert, Modal } from '../../components/ui'
import { PROJECT_LIFECYCLE_PHASES } from '../../utils/projectLifecycle'

export function ProjectFormModal({ isOpen, onClose, form, setForm, error, setError, saving, onSubmit }) {
  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="document-modal" subtitle="Projects" title="Add project">
      <form className="project-edit-form" onSubmit={onSubmit}>
        {error && (
          <Alert variant="error" onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}
        <label>
          Name
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required data-modal-initial-focus />
        </label>
        <label>
          Description
          <textarea rows="3" value={form.description} onChange={(event) => updateField('description', event.target.value)} />
        </label>
        <div className="project-edit-form-row">
          <label>
            Status
            <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
              <option>Planning</option>
              <option>Active</option>
              <option>On hold</option>
              <option>Completed</option>
            </select>
          </label>
          <label>
            Lifecycle phase
            <select value={form.lifecyclePhase} onChange={(event) => updateField('lifecyclePhase', event.target.value)}>
              {PROJECT_LIFECYCLE_PHASES.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Progress
            <input type="number" min="0" max="100" value={form.progress} onChange={(event) => updateField('progress', event.target.value)} />
          </label>
          <label>
            Members
            <input type="number" min="1" value={form.members} onChange={(event) => updateField('members', event.target.value)} />
          </label>
        </div>
        <label>
          Technologies
          <input value={form.technologies} onChange={(event) => updateField('technologies', event.target.value)} placeholder="React, FastAPI, Firebase" />
        </label>
        <div className="project-edit-form-row">
          <label>
            GitHub URL
            <input type="url" value={form.githubUrl} onChange={(event) => updateField('githubUrl', event.target.value)} />
          </label>
          <label>
            Live URL
            <input type="url" value={form.liveUrl} onChange={(event) => updateField('liveUrl', event.target.value)} />
          </label>
        </div>
        <div className="todo-modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            <Plus size={16} />
            {saving ? 'Saving…' : 'Add project'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
