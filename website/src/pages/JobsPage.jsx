import "../styles/pages/jobs.css"
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
import { ConfirmDialog, CustomDropdown, EmptyState, FilterBar, SearchBar } from '../components/ui'
import { JobModals } from './jobs/JobModals'
import { JobPipelineSummary } from './jobs/JobPipelineSummary'

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
        actions={
          <button className="primary-button jobs-add-button" type="button" onClick={() => setFormOpen(true)}>
            <Plus size={17} />
            Add job
          </button>
        }
        isFiltered={Boolean(activeFilters)}
        onReset={() => {
          setSearchQuery('')
          setStatusFilter('All')
          setWorkTypeFilter('All')
        }}
      />

      <JobPipelineSummary
        jobs={jobs}
        jobStatuses={jobStatuses}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
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

      <JobModals
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        form={form}
        updateField={updateField}
        addJob={addJob}
        jobSaving={jobSaving}
        jobError={jobError}
        setJobError={setJobError}
        resumeDocuments={resumeDocuments}
        editingJob={editingJob}
        setEditingJob={setEditingJob}
        editForm={editForm}
        updateEditField={updateEditField}
        saveJobEdit={saveJobEdit}
        editSaving={editSaving}
        editError={editError}
        setEditError={setEditError}
      />
      <ConfirmDialog isOpen={Boolean(deleteId)} message="Are you sure you want to delete this job entry?" onCancel={() => setDeleteId(null)} onConfirm={confirmDeleteJob} />
    </section>
  )
}
