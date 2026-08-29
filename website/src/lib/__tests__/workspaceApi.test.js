import { describe, expect, it } from 'vitest'

describe('Workspace API Data Transformers', () => {
  it('formats project IDs correctly', () => {
    const cleanProjectId = (id) => String(id).replace(/^project-/, '')
    expect(cleanProjectId('project-abc12345')).toBe('abc12345')
    expect(cleanProjectId('rawId999')).toBe('rawId999')
  })

  it('maps job payload fields correctly', () => {
    const mapJob = (job) => ({
      id: job.id,
      company: job.company,
      role: job.role,
      status: job.status,
      workType: job.work_type,
    })

    const apiJob = {
      id: 'job-1',
      company: 'Google',
      role: 'Software Engineer',
      status: 'Interview',
      work_type: 'Full-time',
    }

    const mapped = mapJob(apiJob)
    expect(mapped.id).toBe('job-1')
    expect(mapped.company).toBe('Google')
    expect(mapped.workType).toBe('Full-time')
  })
})

