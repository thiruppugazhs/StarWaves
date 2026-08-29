import { request } from './_shared'

function mapJob(job) {
  return {
    id: job.id,
    company: job.company,
    role: job.role,
    status: job.status,
    location: job.location,
    workType: job.work_type,
    salary: job.salary,
    appliedDate: job.applied_date ?? '',
    interviewDate: job.interview_date ?? '',
    deadline: job.deadline ?? '',
    resumeId: job.resume_id,
    jobUrl: job.job_url,
    notes: job.notes,
  }
}

export async function loadJobs(cursor = null) {
  const page = await request(`/jobs?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
  return { ...page, items: page.items.map(mapJob) }
}

export async function createJob(job) {
  return mapJob(
    await request('/jobs', {
      method: 'POST',
      body: JSON.stringify({
        company: job.company,
        role: job.role,
        status: job.status,
        location: job.location,
        work_type: job.workType,
        salary: job.salary,
        applied_date: job.appliedDate || null,
        interview_date: job.interviewDate || null,
        deadline: job.deadline || null,
        resume_id: job.resumeId,
        job_url: job.jobUrl,
        notes: job.notes,
      }),
    }),
  )
}

export async function updateJob(jobId, job) {
  const payload = {}
  if ('company' in job) payload.company = job.company
  if ('role' in job) payload.role = job.role
  if ('status' in job) payload.status = job.status
  if ('location' in job) payload.location = job.location
  if ('workType' in job) payload.work_type = job.workType
  if ('salary' in job) payload.salary = job.salary
  if ('appliedDate' in job) payload.applied_date = job.appliedDate || null
  if ('interviewDate' in job) payload.interview_date = job.interviewDate || null
  if ('deadline' in job) payload.deadline = job.deadline || null
  if ('resumeId' in job) payload.resume_id = job.resumeId
  if ('jobUrl' in job) payload.job_url = job.jobUrl
  if ('notes' in job) payload.notes = job.notes

  return mapJob(
    await request(`/jobs/${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  )
}

export function deleteJob(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
}