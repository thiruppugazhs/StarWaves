import { useCallback, useEffect, useMemo, useState } from 'react'

const workspacePages = new Set([
  'dashboard',
  'eve',
  'eve-chat',
  'eve-sessions',
  'eve-memory',
  'eve-call',
  'eve-schedules',
  'stats',
  'todo',
  'calendar',
  'mails',
  'whatsapp',
  'chats',
  'calls',
  'contacts',
  'competitive-coding',
  'hackathons',
  'projects',
  'jobs',
  'documents',
  'workspace',
  'studio',
  'studio-apps',
  'studio-templates',
  'profile',
  'themes',
  'setting',
  'usage',
])

export function workspaceStateFromPath(pathname) {
  const [, root, page, detailId] = pathname.split('/')
  if (root !== 'app') return { page: 'dashboard', projectId: null, documentId: null, hackathonId: null }
  if (page === 'custom' && detailId) {
    return { page: `custom-${detailId}`, projectId: null, documentId: null, hackathonId: null }
  }
  if (page === 'competitive') {
    return { page: 'competitive-coding', projectId: null, documentId: null, hackathonId: null }
  }
  if (page === 'projects' && detailId) {
    return { page: 'project-detail', projectId: detailId, documentId: null, hackathonId: null }
  }
  if (page === 'studio' && detailId) {
    return { page: 'studio-detail', projectId: detailId, documentId: null, hackathonId: null }
  }
  if (page === 'documents' && detailId) {
    return { page: 'document-opener', projectId: null, documentId: detailId, hackathonId: null }
  }
  if (page === 'hackathons' && detailId) {
    return { page: 'hackathon-detail', projectId: null, documentId: null, hackathonId: detailId }
  }
  if (page === 'eve' && detailId) {
    const validEveSubpages = {
      chat: 'eve',
      sessions: 'eve-sessions',
      memory: 'eve-memory',
      call: 'eve-call',
      schedules: 'eve-schedules',
    }
    return { page: validEveSubpages[detailId] || 'eve', projectId: null, documentId: null, hackathonId: null }
  }
  return {
    page: workspacePages.has(page) ? page : 'dashboard',
    projectId: null,
    documentId: null,
    hackathonId: null,
  }
}

export function useRouter() {
  const [route, setRoute] = useState(() => window.location.pathname)
  const initialWorkspace = useMemo(
    () => workspaceStateFromPath(window.location.pathname),
    [],
  )
  const [activePage, setActivePage] = useState(initialWorkspace.page)
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialWorkspace.projectId,
  )
  const [selectedDocumentId, setSelectedDocumentId] = useState(
    initialWorkspace.documentId,
  )
  const [selectedHackathonId, setSelectedHackathonId] = useState(
    initialWorkspace.hackathonId,
  )

  useEffect(() => {
    const syncRoute = () => {
      const pathname = window.location.pathname
      const workspace = workspaceStateFromPath(pathname)
      setRoute(pathname)
      if (pathname.startsWith('/app')) {
        setActivePage(workspace.page)
        setSelectedProjectId(workspace.projectId)
        setSelectedDocumentId(workspace.documentId)
        setSelectedHackathonId(workspace.hackathonId)
      }
    }

    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  const navigate = useCallback((page, options = {}) => {
    let path = '/app/dashboard'

    if (page.startsWith('custom-')) {
      const slug = page.slice(7)
      path = `/app/custom/${slug}`
    } else if (page === 'landing') path = '/'
    else if (page === 'auth') path = '/login'
    else if (page === 'privacy') path = '/privacy'
    else if (page === 'terms') path = '/terms'
    else if (page === 'onboarding') path = '/onboarding'
    else if (page === 'project-detail' && options.projectId) {
      path = `/app/projects/${options.projectId}`
    } else if (page === 'studio-detail' && options.projectId) {
      path = `/app/studio/${options.projectId}`
    } else if (page === 'document-opener' && options.documentId) {
      path = `/app/documents/${options.documentId}`
    } else if (page === 'hackathon-detail' && options.hackathonId) {
      path = `/app/hackathons/${options.hackathonId}`
    } else if (page === 'competitive-coding') {
      path = '/app/competitive'
    } else if (page === 'eve-sessions') {
      path = '/app/eve/sessions'
    } else if (page === 'eve-memory') {
      path = '/app/eve/memory'
    } else if (page === 'eve-call') {
      path = '/app/eve/call'
    } else if (page === 'eve-schedules') {
      path = '/app/eve/schedules'
    } else if (page === 'eve-chat') {
      path = '/app/eve'
    } else if (workspacePages.has(page)) {
      path = `/app/${page}`
    }

    window.history.pushState({}, '', path)
    setRoute(path)

    if (path.startsWith('/app')) {
      setActivePage(page)
      setSelectedProjectId(options.projectId ?? null)
      setSelectedDocumentId(options.documentId ?? null)
      setSelectedHackathonId(options.hackathonId ?? null)
    }
  }, [])

  return {
    route,
    setRoute,
    activePage,
    setActivePage,
    selectedProjectId,
    setSelectedProjectId,
    selectedDocumentId,
    setSelectedDocumentId,
    selectedHackathonId,
    setSelectedHackathonId,
    navigate,
  }
}
