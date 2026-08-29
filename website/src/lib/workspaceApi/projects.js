import { request } from './_shared'

function mapProject(project) {
  const rawId = String(project.id)
  const isGithub = rawId.startsWith('github-')
  const formattedId = isGithub || rawId.startsWith('project-') ? rawId : `project-${rawId}`
  return {
    id: formattedId,
    name: project.name,
    description: project.description,
    status: project.status,
    progress: project.progress,
    members: project.members,
    technologies: project.technologies,
    githubUrl: project.github_url,
    liveUrl: project.live_url,
    lifecyclePhase: project.lifecycle_phase,
    updatedAt: project.updated_at,
    source: project.source ?? (isGithub ? 'github' : 'manual'),
  }
}

function cleanProjectId(projectId) {
  return String(projectId).replace(/^project-/, '')
}

export async function loadProjects(cursor = null) {
  const page = await request(`/projects?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
  return { ...page, items: page.items.map(mapProject) }
}

export async function createProject(project) {
  return mapProject(
    await request('/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: project.name,
        description: project.description,
        status: project.status,
        progress: Number(project.progress),
        members: Number(project.members),
        technologies: project.technologies,
        github_url: project.githubUrl,
        live_url: project.liveUrl,
        lifecycle_phase: project.lifecyclePhase ?? 'idea',
      }),
    }),
  )
}

export async function updateProject(projectId, project) {
  const rawId = cleanProjectId(projectId)
  const payload = {}
  if ('name' in project) payload.name = project.name
  if ('description' in project) payload.description = project.description
  if ('status' in project) payload.status = project.status
  if ('progress' in project) payload.progress = Number(project.progress)
  if ('members' in project) payload.members = Number(project.members)
  if ('technologies' in project) payload.technologies = project.technologies
  if ('githubUrl' in project) payload.github_url = project.githubUrl
  if ('liveUrl' in project) payload.live_url = project.liveUrl
  if ('lifecyclePhase' in project) payload.lifecycle_phase = project.lifecyclePhase

  return mapProject(
    await request(`/projects/${encodeURIComponent(rawId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  )
}

export function deleteProject(projectId) {
  const rawId = cleanProjectId(projectId)
  return request(`/projects/${encodeURIComponent(rawId)}`, { method: 'DELETE' })
}