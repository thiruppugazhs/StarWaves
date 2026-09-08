import { Save, Upload } from 'lucide-react'
import { Modal } from '../../components/ui'

export function DocumentEditorModal({
  editorOpen,
  setEditorOpen,
  editingId,
  form,
  updateField,
  saveDocument,
  documentSaving,
  documentSaveError,
}) {
  return (
    <Modal
      isOpen={editorOpen}
      onClose={() => setEditorOpen(false)}
      className="document-modal"
      subtitle="Documents"
      title={editingId ? 'Edit document' : 'Upload document'}
    >
      <form className="project-edit-form" onSubmit={saveDocument}>
        <label>
          File
          <input
            type="file"
            onChange={(event) =>
              updateField('file', event.target.files?.[0] ?? null)
            }
            required={!editingId}
            disabled={documentSaving}
          />
          <small className="document-upload-note">
            The selected file will be stored in your Google Drive.
          </small>
        </label>
        <div className="project-edit-form-row document-form-row">
          <label>
            Document name
            <input
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Uses the file name if empty"
            />
          </label>
          <label>
            Category
            <select
              value={form.category}
              onChange={(event) =>
                updateField('category', event.target.value)
              }
            >
              <option>General</option>
              <option>Career</option>
              <option>Projects</option>
              <option>Learning</option>
              <option>Personal</option>
            </select>
          </label>
        </div>
        <label>
          Description
          <textarea
            rows="3"
            value={form.description}
            onChange={(event) =>
              updateField('description', event.target.value)
            }
          />
        </label>
        <label>
          Tags
          <input
            value={form.tags}
            onChange={(event) => updateField('tags', event.target.value)}
            placeholder="Resume, Career, Application"
          />
        </label>
        {documentSaveError && (
          <div className="document-save-error" role="alert">
            {documentSaveError}
          </div>
        )}
        <div className="todo-modal-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setEditorOpen(false)}
            disabled={documentSaving}
          >
            Cancel
          </button>
          <button
            className="primary-button document-save-button"
            type="submit"
            disabled={documentSaving}
          >
            {editingId ? <Save size={16} /> : <Upload size={16} />}
            {documentSaving
              ? 'Uploading to Drive…'
              : editingId
                ? 'Save changes'
                : 'Upload to Drive'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
