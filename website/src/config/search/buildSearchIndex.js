import { BriefcaseBusiness, CheckSquare, Files, FolderKanban, Rocket } from 'lucide-react'
import { STATIC_SEARCH_ITEMS } from './staticItems'

export function buildSearchIndex(workspaceData = {}) {
  const items = [...STATIC_SEARCH_ITEMS]
  const { projects = [], jobs = [], documents = [], hackathons = [], tasks = [] } = workspaceData

  projects.forEach((project) => {
    if (!project?.title && !project?.name) return
    const title = project.title || project.name
    items.push({
      id: `record-project-${project.id}`,
      type: 'record',
      category: 'records',
      group: 'Projects',
      title,
      subtitle: project.description || `Phase: ${project.lifecycle_phase || 'Active'}`,
      badge: 'Project Record',
      page: 'project-detail',
      recordId: project.id,
      recordType: 'project',
      icon: FolderKanban,
      keywords: ['project', title.toLowerCase(), project.lifecycle_phase || '', project.status || '', ...(project.tags || [])].filter(Boolean),
    })
  })

  jobs.forEach((job) => {
    if (!job?.title && !job?.role && !job?.company) return
    const title = job.title || job.role || 'Job Application'
    const company = job.company || 'Unknown Company'
    items.push({
      id: `record-job-${job.id}`,
      type: 'record',
      category: 'records',
      group: 'Job Applications',
      title: `${title} — ${company}`,
      subtitle: `Status: ${job.status || 'Applied'} • ${job.location || 'Remote'}`,
      badge: 'Job Record',
      page: 'jobs',
      recordId: job.id,
      recordType: 'job',
      icon: BriefcaseBusiness,
      keywords: ['job', 'application', title.toLowerCase(), company.toLowerCase(), job.status || '', job.location || ''].filter(Boolean),
    })
  })

  documents.forEach((doc) => {
    if (!doc?.title && !doc?.name) return
    const title = doc.title || doc.name
    items.push({
      id: `record-doc-${doc.id}`,
      type: 'record',
      category: 'records',
      group: 'Documents',
      title,
      subtitle: doc.content ? `${doc.content.slice(0, 60)}…` : 'Workspace Document',
      badge: 'Document Record',
      page: 'document-opener',
      recordId: doc.id,
      recordType: 'document',
      icon: Files,
      keywords: ['doc', 'document', 'note', title.toLowerCase()].filter(Boolean),
    })
  })

  hackathons.forEach((hack) => {
    if (!hack?.title && !hack?.name) return
    const title = hack.title || hack.name
    items.push({
      id: `record-hack-${hack.id}`,
      type: 'record',
      category: 'records',
      group: 'Hackathons',
      title,
      subtitle: hack.description || hack.source || 'Hackathon Event',
      badge: 'Hackathon Record',
      page: 'hackathon-detail',
      recordId: hack.id,
      recordType: 'hackathon',
      icon: Rocket,
      keywords: ['hackathon', title.toLowerCase(), hack.source || '', hack.location || ''].filter(Boolean),
    })
  })

  tasks.forEach((task) => {
    if (!task?.text && !task?.title) return
    const title = task.text || task.title
    items.push({
      id: `record-task-${task.id}`,
      type: 'record',
      category: 'records',
      group: 'Tasks',
      title,
      subtitle: task.completed ? 'Completed' : `Priority: ${task.priority || 'Medium'}`,
      badge: 'Task Record',
      page: 'todo',
      recordId: task.id,
      recordType: 'task',
      icon: CheckSquare,
      keywords: ['task', 'todo', title.toLowerCase(), task.completed ? 'completed' : 'pending'].filter(Boolean),
    })
  })

  return items
}
