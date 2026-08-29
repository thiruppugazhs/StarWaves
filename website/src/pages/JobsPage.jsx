import { useEffect, useMemo, useState } from 'react'
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FileText,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { usePersistentState } from '../hooks/usePersistentState'
import { createJob, deleteJob, updateJob } from '../lib/workspaceApi'
import { Alert, ConfirmDialog, CustomDropdown, EmptyState, FilterBar, Modal, PageHeader, SearchBar } from '../components/ui'
import { buildApplicationTimeline } from '../utils/jobTimeline'

const emptyJob = {
  company: '',
  role: '',
  status: 'Saved',
  location: '',
  workType: 'Full-time',
  salary: '',
  appliedDate: '',
  interviewDate: '',
  deadline: '',
  resumeId: '',
  jobUrl: '',
  notes: '',
}

export function JobsPage({ jobs, setJobs, documents, createIntent, canLoadMore, loadingMore, onLoadMore }) {
  const [openJobs, setOpenJobs] = useState(() => new Set([jobs[0]?.id]))
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyJob)
  const [jobSaving, setJobSaving] = useState(false)
  const [jobError, setJobError] = useState('')

  const [editingJob, setEditingJob] = useState(null)
  const [editForm, setEditForm] = useState(emptyJob)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = usePersistentState('starwaves.jobs.status', 'All')
  const [workTypeFilter, setWorkTypeFilter] = usePersistentState('starwaves.jobs.work-type', 'All')
  const [sortOrder, setSortOrder] = usePersistentState('starwaves.jobs.sort', 'recent')

  useEffect(() => {
    if (createIntent?.type === 'job') setFormOpen(true)
  }, [createIntent?.requestId, createIntent?.type])
  const resumeDocuments = documents.filter(
    (document) =>
      document.category === 'Career' ||
      document.name.toLowerCase().includes('resume'),
  )

  const jobStatuses = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected']
  const workTypes = [...new Set(jobs.map((job) => job.workType).filter(Boolean))]
  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return jobs
      .filter((job) => {
        const searchable = `${job.role} ${job.company} ${job.location}`.toLowerCase()
        return (!query || searchable.includes(query)) &&
          (statusFilter === 'All' || job.status === statusFilter) &&
          (workTypeFilter === 'All' || job.workType === workTypeFilter)
      })
      .sort((a, b) => {
        if (sortOrder === 'company') return (a.company || '').localeCompare(b.company || '')
        if (sortOrder === 'deadline') return (a.deadline || '9999').localeCompare(b.deadline || '9999')
        return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
      })
  }, [jobs, searchQuery, statusFilter, workTypeFilter, sortOrder])

  const activeFilters = statusFilter !== 'All' || workTypeFilter !== 'All' || searchQuery

  const { months, max, total } = useMemo(() => buildApplicationTimeline(jobs), [jobs])

  const toggleJob = (jobId) => {
    setOpenJobs((current) => {
      const next = new Set(current)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  const addJob = async (event) => {
    event.preventDefault()
    setJobSaving(true)
    setJobError('')
    try {
      const created = await createJob(form)
      setJobs((current) => [created, ...current])
      setForm(emptyJob)
      setFormOpen(false)
    } catch (error) {
      setJobError(error.message)
    } finally {
      setJobSaving(false)
    }
  }

  const openEditModal = (job) => {
    setEditingJob(job)
    setEditForm({
      company: job.company || '',
      role: job.role || '',
      status: job.status || 'Saved',
      location: job.location || '',
      workType: job.workType || 'Full-time',
      salary: job.salary || '',
      appliedDate: job.appliedDate || '',
      interviewDate: job.interviewDate || '',
      deadline: job.deadline || '',
      resumeId: job.resumeId || '',
      jobUrl: job.jobUrl || '',
      notes: job.notes || '',
    })
    setEditError('')
  }

  const saveJobEdit = async (event) => {
    event.preventDefault()
    if (!editingJob) return
    setEditSaving(true)
    setEditError('')
    try {
      const updated = await updateJob(editingJob.id, editForm)
      setJobs((current) =>
        current.map((item) => (item.id === editingJob.id ? updated : item)),
      )
      setEditingJob(null)
    } catch (error) {
      setEditError(error.message)
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteJob = async (jobId) => {
    setDeleteId(jobId)
  }

  const confirmDeleteJob = async () => {
    const jobId = deleteId
    setDeleteId(null)
    if (!jobId) return
    try {
      await deleteJob(jobId)
      setJobs((current) => current.filter((item) => item.id !== jobId))
    } catch (error) {
      setEditError(error.message || 'Could not delete job.')
    }
  }

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateEditField = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <section className="jobs-page">
      <PageHeader
        eyebrow="Career tracker"
        title="Jobs"
        description={`${jobs.length} opportunities in your pipeline`}
        actions={
          <button
            className="primary-button jobs-add-button"
            onClick={() => setFormOpen(true)}
          >
            <Plus size={17} />
            Add job
          </button>
        }
      />

      <div className="jobs-summary" aria-label="Job pipeline summary">
        {jobStatuses.slice(0, 4).map((status) => (
          <button key={status} className={`jobs-summary-item ${statusFilter === status ? 'active' : ''}`} onClick={() => setStatusFilter(statusFilter === status ? 'All' : status)}>
            <strong>{jobs.filter((job) => job.status === status).length}</strong><span>{status}</span>
          </button>
        ))}
<div className="jobs-summary-item jobs-summary-total"><strong>{jobs.length}</strong><span>Total tracked</span></div>
      </div>

      <article className="jobs-timeline-card" aria-label={`Applications per month over the last 12 months: ${total} applications`}>
        <header className="jobs-timeline-heading">
          <div>
            <p>Activity</p>
            <h2>Application frequency</h2>
          </div>
          <span>{total} applications · 12 months</span>
        </header>
        <div className="jobs-timeline-chart" role="img" aria-label={`Bar chart of ${total} job applications across the last 12 months`}>
          {months.map((month) => (
            <div className="jobs-timeline-bar-wrap" key={month.key} title={`${month.fullLabel}: ${month.count}`}>
              <div className="jobs-timeline-bar" style={{ height: max ? `${Math.max(6, Math.round((month.count / max) * 100))}%` : '6%' }}>
                {month.count > 0 && <span className="jobs-timeline-bar-count">{month.count}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="jobs-timeline-labels" aria-hidden="true">
          {months.map((month) => (
            <span key={month.key}>{month.label}</span>
          ))}
        </div>
      </article>

      <FilterBar
        className="jobs-toolbar"
        search={
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search role, company, or location"
            ariaLabel="Search jobs"
          />
        }
        filters={
          <>
            <SlidersHorizontal size={15} className="text-muted" aria-hidden="true" />
            <CustomDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Filter by status"
              options={[{ value: 'All', label: 'All statuses' }, ...jobStatuses.map((s) => ({ value: s, label: s }))]}
            />
            <CustomDropdown
              value={workTypeFilter}
              onChange={setWorkTypeFilter}
              ariaLabel="Filter by work type"
              options={[{ value: 'All', label: 'All work types' }, ...workTypes.map((t) => ({ value: t, label: t }))]}
            />
            <CustomDropdown
              value={sortOrder}
              onChange={setSortOrder}
              ariaLabel="Sort jobs"
              options={[
                { value: 'recent', label: 'Recently updated' },
                { value: 'deadline', label: 'Deadline soonest' },
                { value: 'company', label: 'Company A–Z' },
              ]}
            />
          </>
        }
        isFiltered={Boolean(activeFilters)}
        onReset={() => {
          setSearchQuery('')
          setStatusFilter('All')
          setWorkTypeFilter('All')
        }}
      />

      <div className="job-list">
        {filteredJobs.map((job) => {
          const isOpen = openJobs.has(job.id)
          const selectedResume = documents.find(
            (document) => document.id === job.resumeId,
          )

          return (
            <article
              className={`contest-site-card job-list-card ${isOpen ? 'open' : ''}`}
              key={job.id}
              data-record-id={job.id}
            >
              <button
                className="contest-site-header"
                onClick={() => toggleJob(job.id)}
                aria-expanded={isOpen}
              >
                <span className="contest-site-logo">
                  <BriefcaseBusiness size={18} />
                </span>
                <span className="contest-site-copy">
                  <strong>{job.role}</strong>
                  <small>{job.company}</small>
                </span>
                <span className="project-status">{job.status}</span>
                <ChevronDown size={18} />
              </button>

              {isOpen && (
                <div className="contest-site-content job-detail-content">
                  <div className="job-detail-grid">
                    <div className="job-detail-item">
                      <MapPin size={17} />
                      <div><span>Location</span><strong>{job.location}</strong></div>
                    </div>
                    <div className="job-detail-item">
                      <BriefcaseBusiness size={17} />
                      <div><span>Work type</span><strong>{job.workType}</strong></div>
                    </div>
                    <div className="job-detail-item">
                      <span className="job-currency">₹</span>
                      <div><span>Salary</span><strong>{job.salary || 'Not listed'}</strong></div>
                    </div>
                  </div>

                  <div className="job-dates">
                    {[
                      ['Applied', job.appliedDate],
                      ['Interview', job.interviewDate],
                      ['Deadline', job.deadline],
                    ].map(([label, date]) => (
                      <div key={label}>
                        <CalendarDays size={15} />
                        <span>{label}</span>
                        <strong>{date || 'Not set'}</strong>
                      </div>
                    ))}
                  </div>

                  {job.notes && <p className="job-notes">{job.notes}</p>}
                  {selectedResume && (
                    <div className="job-resume">
                      <FileText size={17} />
                      <div>
                        <span>Resume used</span>
                        <strong>{selectedResume.name}</strong>
                        <small>
                          {selectedResume.type} · {selectedResume.size}
                        </small>
                      </div>
                      <a
                        href={selectedResume.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={14} />
                        Open
                      </a>
                    </div>
                  )}
                  <div className="job-detail-actions">
                    {job.jobUrl ? (
                      <a
                        className="job-link"
                        href={job.jobUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={14} />
                        View job posting
                      </a>
                    ) : <span />}

                    <div className="job-action-buttons">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => openEditModal(job)}
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => handleDeleteJob(job.id)}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          )
        })}
        {!filteredJobs.length && (
          <EmptyState
            icon={Search}
            title="No jobs match these filters"
            description="Try a different search or reset your filters."
            action={
              activeFilters ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('All')
                    setWorkTypeFilter('All')
                  }}
                >
                  Clear filters
                </button>
              ) : null
            }
          />
        )}
      </div>

      {canLoadMore && <button className="secondary-button" type="button" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more jobs'}</button>}

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
          <div className="project-edit-form-row">
            <label>Company<input value={form.company} onChange={(event) => updateField('company', event.target.value)} required data-modal-initial-focus /></label>
            <label>Role<input value={form.role} onChange={(event) => updateField('role', event.target.value)} required /></label>
            <label>Status<select value={form.status} onChange={(event) => updateField('status', event.target.value)}><option>Saved</option><option>Applied</option><option>Interview</option><option>Offer</option><option>Rejected</option></select></label>
          </div>
          <div className="project-edit-form-row">
            <label>Location<input value={form.location} onChange={(event) => updateField('location', event.target.value)} /></label>
            <label>Work type<select value={form.workType} onChange={(event) => updateField('workType', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option><option>Hybrid</option></select></label>
            <label>Salary<input value={form.salary} onChange={(event) => updateField('salary', event.target.value)} /></label>
          </div>
          <div className="project-edit-form-row">
            <label>Applied date<input type="date" value={form.appliedDate} onChange={(event) => updateField('appliedDate', event.target.value)} /></label>
            <label>Interview date<input type="date" value={form.interviewDate} onChange={(event) => updateField('interviewDate', event.target.value)} /></label>
            <label>Deadline<input type="date" value={form.deadline} onChange={(event) => updateField('deadline', event.target.value)} /></label>
          </div>
          <label>
            Resume used
            <select
              value={form.resumeId}
              onChange={(event) =>
                updateField('resumeId', event.target.value)
              }
            >
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
          <div className="project-edit-form-row">
            <label>Company<input value={editForm.company} onChange={(event) => updateEditField('company', event.target.value)} required data-modal-initial-focus /></label>
                <label>Location<input value={editForm.location} onChange={(event) => updateEditField('location', event.target.value)} /></label>
                <label>Work type<select value={editForm.workType} onChange={(event) => updateEditField('workType', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option><option>Hybrid</option></select></label>
                <label>Salary<input value={editForm.salary} onChange={(event) => updateEditField('salary', event.target.value)} /></label>
              </div>
              <div className="project-edit-form-row">
                <label>Applied date<input type="date" value={editForm.appliedDate} onChange={(event) => updateEditField('appliedDate', event.target.value)} /></label>
                <label>Interview date<input type="date" value={editForm.interviewDate} onChange={(event) => updateEditField('interviewDate', event.target.value)} /></label>
                <label>Deadline<input type="date" value={editForm.deadline} onChange={(event) => updateEditField('deadline', event.target.value)} /></label>
              </div>
              <label>
                Resume used
                <select
                  value={editForm.resumeId}
                  onChange={(event) =>
                    updateEditField('resumeId', event.target.value)
                  }
                >
                  <option value="">No resume selected</option>
                  {resumeDocuments.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>Job URL<input type="url" value={editForm.jobUrl} onChange={(event) => updateEditField('jobUrl', event.target.value)} /></label>
              <label>Notes<textarea rows="3" value={editForm.notes} onChange={(event) => updateEditField('notes', event.target.value)} /></label>
              <div className="todo-modal-actions">
                <button className="secondary-button" type="button" onClick={() => setEditingJob(null)} disabled={editSaving}>Cancel</button>
                <button className="primary-button jobs-add-button" type="submit" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </Modal>
      <ConfirmDialog isOpen={Boolean(deleteId)} message="Are you sure you want to delete this job entry?" onCancel={() => setDeleteId(null)} onConfirm={confirmDeleteJob} />
    </section>
  )
}

