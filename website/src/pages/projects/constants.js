/** Projects constants — single responsibility: project defaults and status styling. */

export const emptyProject = {
  name: '',
  description: '',
  status: 'Planning',
  progress: 0,
  members: 1,
  technologies: '',
  githubUrl: '',
  liveUrl: '',
  lifecyclePhase: 'idea',
}

export const getStatusClass = (status) => {
  switch (status) {
    case 'Active':
      return 'status-active'
    case 'Planning':
      return 'status-planning'
    case 'On hold':
      return 'status-on-hold'
    case 'Completed':
      return 'status-completed'
    default:
      return ''
  }
}
