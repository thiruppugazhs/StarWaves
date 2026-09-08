import { Plus } from 'lucide-react'
import { Alert, Modal } from '../../components/ui'

const STATUS_OPTIONS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected']
const WORK_TYPE_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Hybrid']

function JobFields({ form, updateField, resumeDocuments, initialFocus }) {
  return (
    <>
      <div className="project-edit-form-row">
        <label>Company<input value={form.company} onChange={(event) => updateField('company', event.target.value)} required data-modal-initial-focus={initialFocus || undefined} /></label>
        <label>Role<input value={form.role} onChange={(event) => updateField('role', event.target.value)} required /></label>
        <label>Status<select value={form.status} onChange={(event) => updateField('status', event.target.value)}>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label>
      </div>
      <div className="project-edit-form-row">
        <label>Location<input value={form.location} onChange={(event) => updateField('location', event.target.value)} /></label>
        <label>Work type<select value={form.workType} onChange={(event) => updateField('workType', event.target.value)}>{WORK_TYPE_OPTIONS.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Salary<input value={form.salary} onChange={(event) => updateField('salary', event.target.value)} /></label>
      </div>
      <div className="project-edit-form-row">
        <label>Applied date<input type="date" value={form.appliedDate} onChange={(event) => updateField('appliedDate', event.target.value)} /></label>
        <label>Interview date<input type="date" value={form.interviewDate} onChange={(event) => updateField('interviewDate', event.target.value)} /></label>
        <label>Deadline<input type="date" value={form.deadline} onChange={(event) => updateField('deadline', event.target.value)} /></label>
      </div>
      <label>
        Resume used
        <select value={form.resumeId} onChange={(event) => updateField('resumeId', event.target.value)}>
          <option value="">No resume selected</option>
          {resumeDocuments.map((document) => (
            <option key={document.id} value={document.id}>
              {document.name}
            </option>
          ))}
        </select>
      </label>
      <label>Job URL<input type="url" value={form.jobUrl} onChange={(event) => updateField('jobUrl', event.target.value)} /></label>
      <label>Notes<textarea rows="3" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} /></label>
    </>
  )
}

export function JobModals({
  formOpen,
  setFormOpen,
  form,
  updateField,
  addJob,
  jobSaving,
  jobError,
  setJobError,
  resumeDocuments,
  editingJob,
  setEditingJob,
  editForm,
  updateEditField,
  saveJobEdit,
  editSaving,
  editError,
  setEditError,
}) {
  return (
    <>
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        className="job-modal"
        subtitle="Career"
        title="Add job record"
      >
        <form className="project-edit-form" onSubmit={addJob}>
          {jobError && (
            <Alert variant="error" onDismiss={() => setJobError('')}>
              {jobError}
            </Alert>
          )}
          <JobFields form={form} updateField={updateField} resumeDocuments={resumeDocuments} initialFocus />
          <div className="todo-modal-actions"><button className="secondary-button" type="button" onClick={() => setFormOpen(false)} disabled={jobSaving}>Cancel</button><button className="primary-button jobs-add-button" type="submit" disabled={jobSaving}><Plus size={16} />{jobSaving ? 'Saving…' : 'Add job'}</button></div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(editingJob)}
        onClose={() => setEditingJob(null)}
        className="job-modal"
        subtitle="Career"
        title="Edit job record"
      >
        <form className="project-edit-form" onSubmit={saveJobEdit}>
          {editError && (
            <Alert variant="error" onDismiss={() => setEditError('')}>
              {editError}
            </Alert>
          )}
          <JobFields form={editForm} updateField={updateEditField} resumeDocuments={resumeDocuments} initialFocus />
          <div className="todo-modal-actions">
            <button className="secondary-button" type="button" onClick={() => setEditingJob(null)} disabled={editSaving}>Cancel</button>
            <button className="primary-button jobs-add-button" type="submit" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </Modal>
    </>
  )
}
