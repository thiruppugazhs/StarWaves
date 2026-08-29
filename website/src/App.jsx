import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AppLayout } from './layouts/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { DocumentOpenerPage } from './pages/DocumentOpenerPage'
import { HackathonsPage } from './pages/HackathonsPage'
import { HackathonDetailPage } from './pages/HackathonDetailPage'
import { JobsPage } from './pages/JobsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { SettingPage } from './pages/SettingPage'
import { ThemesPage } from './pages/ThemesPage'
import { StatsPage } from './pages/StatsPage'
import { TodoPage } from './pages/TodoPage'
import { ProfilePage } from './pages/ProfilePage'
import { IncomingCallOverlay } from './components/calls/IncomingCallOverlay'
// Heavy pages lazy (Vercel split: monaco, whatsapp 1.3k, WebRTC, Eve)
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const CompetitiveCodingPage = lazy(() => import('./pages/CompetitiveCodingPage').then((m) => ({ default: m.CompetitiveCodingPage })))
const EvePage = lazy(() => import('./pages/EvePage').then((m) => ({ default: m.EvePage })))
const MailsPage = lazy(() => import('./pages/MailsPage').then((m) => ({ default: m.MailsPage })))
const WhatsAppPage = lazy(() => import('./pages/WhatsAppPage').then((m) => ({ default: m.WhatsAppPage })))
const ChatsPage = lazy(() => import('./pages/ChatsPage').then((m) => ({ default: m.ChatsPage })))
const CallsPage = lazy(() => import('./pages/CallsPage').then((m) => ({ default: m.CallsPage })))
const ContactsPage = lazy(() => import('./pages/ContactsPage').then((m) => ({ default: m.ContactsPage })))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((m) => ({ default: m.WorkspacePage })))
const StudioProjectsPage = lazy(() => import('./pages/studio/StudioProjectsPage').then((m) => ({ default: m.StudioProjectsPage })))
const StudioAppsPage = lazy(() => import('./pages/studio/StudioAppsPage').then((m) => ({ default: m.StudioAppsPage })))
const StudioBuilderPage = lazy(() => import('./pages/studio/StudioBuilderPage').then((m) => ({ default: m.StudioBuilderPage })))
const StudioTemplatesPage = lazy(() => import('./pages/studio/StudioTemplatesPage').then((m) => ({ default: m.StudioTemplatesPage })))
const UsagePage = lazy(() => import('./pages/UsagePage').then((m) => ({ default: m.UsagePage })))
import { AuthPage } from './pages/AuthPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { LandingPage } from './pages/LandingPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { TermsOfServicePage } from './pages/TermsOfServicePage'
import { CustomPage } from './pages/CustomPage'
import { updateNotification } from './lib/workspaceApi'
import { confirmEmailVerification } from './lib/emailApi'
import { clearAuthSession, verifyAccountCombine } from './lib/authApi'
import { CALENDAR_REMINDER_PREFIX } from './utils/calendarReminders'
import { useAuth, useRouter, useWorkspaceData, useCallCenter } from './hooks'
import { useSyncEvents } from './hooks/useSyncEvents'
import { applyThemeVariables } from './themes'
import { NetworkStatus } from './components/NetworkStatus'
import { WaveLoader } from './components/WaveLoader'
import { useDialogAccessibility } from './hooks/useDialogAccessibility'
import { useCustomUI } from './hooks/useCustomUI'
import { EveUiBanner } from './components/ui/EveUiBanner'

const routeTitles = {
  '/': 'StarWaves — Developer productivity workspace',
  '/login': 'Log in — StarWaves',
  '/signup': 'Create account — StarWaves',
  '/forgot-password': 'Forgot password — StarWaves',
  '/onboarding': 'Set up your workspace — StarWaves',
  '/privacy': 'Privacy policy — StarWaves',
  '/terms': 'Terms of service — StarWaves',
}

function publicRoute(content) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <NetworkStatus />
      {content}
    </>
  )
}

function App() {
  useDialogAccessibility()
  const { currentUser, authReady } = useAuth()
  const [sessionUser, setSessionUser] = useState(null)
  const activeUser = currentUser || sessionUser
  const callCenter = useCallCenter({ user: activeUser })
  useSyncEvents({ user: activeUser, onInvalidate: () => setWorkspaceRefreshKey((k) => k + 1) })

  const resetToken = (() => {
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    const full = hash + search
    if (full.includes('reset-token=')) {
      const val = full.split('reset-token=')[1] || ''
      return decodeURIComponent(val.split('&')[0] || '').trim() || null
    }
    if (full.includes('reset_token=')) {
      const val = full.split('reset_token=')[1] || ''
      return decodeURIComponent(val.split('&')[0] || '').trim() || null
    }
    if (search.includes('token=')) {
      const val = search.split('token=')[1] || ''
      return decodeURIComponent(val.split('&')[0] || '').trim() || null
    }
    return null
  })()

  const {
    route,
    setRoute,
    activePage,
    setActivePage,
    selectedProjectId,
    setSelectedProjectId,
    selectedDocumentId,
    selectedHackathonId,
    navigate,
  } = useRouter()

  // Eve UI runtime overrides (global + per-page) — must live after useRouter
  useCustomUI()

  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0)
  const [creationIntent, setCreationIntent] = useState(null)
  const [eveChatKey, setEveChatKey] = useState(0)

  const {
    projects,
    setProjects,
    jobs,
    setJobs,
    documents,
    setDocuments,
    codingStats,
    tasks,
    setTasks,
    notifications,
    setNotifications,
    contestSites,
    setContestSites,
    hackathons,
    setHackathons,
    googleCalendarEvents,
    setGoogleCalendarEvents,
    importedIcsCalendars,
    setImportedIcsCalendars,
    importedIcsEvents,
    setImportedIcsEvents,
    calendarEventIndex,
    pagination,
    loadingMore,
    loadMore,
  } = useWorkspaceData(activeUser, activePage, workspaceRefreshKey)

  const previousRouteRef = useRef(route)

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  )
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId)
  const selectedHackathon = hackathons.find((hackathon) => hackathon.id === selectedHackathonId)

  useEffect(() => {
    const pageName = activePage
      .split('-')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ')
    document.title = routeTitles[route] ?? `${pageName} — StarWaves`

    if (previousRouteRef.current !== route) {
      window.requestAnimationFrame(() => {
        const main = document.getElementById('main-content')
        main?.focus({ preventScroll: true })
      })
      previousRouteRef.current = route
    }
  }, [activePage, route])

  useEffect(() => {
    const hash = window.location.hash || ''
    if (hash.includes('#combine-account?token=')) {
      const token = decodeURIComponent(hash.split('#combine-account?token=')[1] || '').trim()
      if (token) {
        verifyAccountCombine(token)
          .then((res) => {
            alert(res.message || 'Account verification successful! Accounts combined.')
            window.history.replaceState({}, '', window.location.pathname + window.location.search)
            setWorkspaceRefreshKey((prev) => prev + 1)
          })
          .catch((err) => {
            alert(err.message || 'Account combination link invalid or expired.')
            window.history.replaceState({}, '', window.location.pathname + window.location.search)
          })
      }
    } else if (hash.includes('#verify-email?token=')) {
      const token = decodeURIComponent(hash.split('#verify-email?token=')[1] || '').trim()
      if (token) {
        confirmEmailVerification(token)
          .then((res) => {
            alert(res.message || 'Email address verified successfully!')
            window.history.replaceState({}, '', window.location.pathname + window.location.search)
            setSessionUser((current) => (current ? { ...current, emailVerified: true } : null))
            fetchCurrentUser().then((u) => {
              if (u) setSessionUser(u)
            })
            setWorkspaceRefreshKey((prev) => prev + 1)
          })
          .catch((err) => {
            alert(err.message || 'Verification link invalid or expired.')
            window.history.replaceState({}, '', window.location.pathname + window.location.search)
          })
      }
    }
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem('starwaves.custom_theme')
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme)
        if (parsed && typeof parsed === 'object') {
          applyThemeVariables(parsed)
        }
      } catch (err) {
        console.error('Could not load custom theme:', err)
      }
    }
  }, [])


  useEffect(() => {
    if (
      authReady &&
      activeUser &&
      !resetToken &&
      (route === '/' || route === '/login' || route === '/signup' || route === '/forgot-password' || route === '/auth')
    ) {
      if (activeUser.needsOnboarding) {
        window.history.replaceState({}, '', '/onboarding')
        setRoute('/onboarding')
      } else {
        window.history.replaceState({}, '', '/app/dashboard')
        setRoute('/app/dashboard')
        setActivePage('dashboard')
        setSelectedProjectId(null)
      }
    }
  }, [authReady, activeUser, route, setRoute, setActivePage, setSelectedProjectId, resetToken])

  useEffect(() => {
    if (route === '/app') {
      window.history.replaceState({}, '', '/app/dashboard')
      setRoute('/app/dashboard')
      setActivePage('dashboard')
    }
    if (route === '/app/competitive') {
      window.history.replaceState({}, '', '/app/competitive-coding')
      setRoute('/app/competitive-coding')
      setActivePage('competitive-coding')
    }
  }, [route, setRoute, setActivePage])

  const navigateRoute = (path) => {
    window.history.pushState({}, '', path)
    setRoute(path)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navigateWorkspace = (page, projectId = null, documentId = null) => {
    navigate(page, { projectId, documentId })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const beginOnboarding = (user) => {
    setSessionUser(user)
    navigateRoute('/onboarding')
  }

  const completeOnboarding = (user, displayName) => {
    setSessionUser({
      uid: user.uid,
      displayName,
      email: user.email,
      providerData: user.providerData,
      needsOnboarding: false,
    })
    navigateRoute('/app/dashboard')
  }

  const userProfile = useMemo(() => {
    if (!activeUser) return null
    const fullName =
      activeUser.displayName?.trim() ||
      activeUser.email?.split('@')[0] ||
      'StarWaves user'
    const nameParts = fullName.split(/\s+/).filter(Boolean)
    const isGoogle = Boolean(
      activeUser.providerData?.some(
        ({ providerId }) => providerId === 'google.com',
      ) || activeUser.google_auth
    )
    return {
      uid: activeUser.uid,
      fullName,
      firstName: nameParts[0],
      initials: nameParts.slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
      email: activeUser.email ?? 'No email available',
      emailVerified: Boolean(activeUser.emailVerified || activeUser.email_verified || isGoogle),
      role: 'Member',
      roleLabel: isGoogle ? 'Google account' : 'Email account',
      photoURL: activeUser.photoURL || activeUser.photoUrl || activeUser.photo_url || activeUser.avatar_url || activeUser.picture || null,
    }
  }, [activeUser])

  const openProject = (project) => {
    navigateWorkspace('project-detail', project.id)
  }

  const requestCreation = (type) => {
    const destinations = { todo: 'todo', job: 'jobs', document: 'documents' }
    setCreationIntent({ type, requestId: Date.now() })
    navigateWorkspace(destinations[type])
  }

  const updateNotifications = (updater) => {
    setNotifications((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      next.forEach((notification) => {
        const previous = current.find((item) => item.id === notification.id)
        if (
          previous &&
          previous.unread !== notification.unread &&
          !notification.id.startsWith(CALENDAR_REMINDER_PREFIX)
        ) {
          updateNotification(notification.id, notification.unread).catch(
            (error) => console.error('Could not update notification:', error),
          )
        }
      })
      return next
    })
  }

  const handleSignOut = () => {
    clearAuthSession()
    setSessionUser(null)
    navigateRoute('/login')
  }

  useEffect(() => {
    const onRevoked = () => {
      clearAuthSession()
      setSessionUser(null)
      window.history.pushState({}, '', '/login')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
    window.addEventListener('starwaves:session-revoked', onRevoked)
    const onSync = () => setWorkspaceRefreshKey((k) => k + 1)
    window.addEventListener('starwaves:sync-invalidate', onSync)
    return () => {
      window.removeEventListener('starwaves:session-revoked', onRevoked)
      window.removeEventListener('starwaves:sync-invalidate', onSync)
    }
  }, [])

  const pages = {
    dashboard: (
        <DashboardPage
          tasks={tasks}
          projects={projects}
          jobs={jobs}
          documents={documents}
          contestSites={contestSites}
          hackathons={hackathons}
          notifications={notifications}
          calendarEventIndex={calendarEventIndex}
          onNavigate={navigateWorkspace}
          onCreate={requestCreation}
          onOpenNotifications={() => setNotificationsOpen(true)}
        />
      ),
    eve: (
      <EvePage
        activeSubpage="chat"
        callCenter={callCenter}
        onNavigate={navigateWorkspace}
        onWorkspaceChanged={() => setWorkspaceRefreshKey((current) => current + 1)}
        chatResetKey={eveChatKey}
      />
    ),
    'eve-chat': (
      <EvePage
        activeSubpage="chat"
        callCenter={callCenter}
        onNavigate={navigateWorkspace}
        onWorkspaceChanged={() => setWorkspaceRefreshKey((current) => current + 1)}
        chatResetKey={eveChatKey}
      />
    ),
    'eve-sessions': (
      <EvePage
        activeSubpage="sessions"
        callCenter={callCenter}
        onNavigate={navigateWorkspace}
        onWorkspaceChanged={() => setWorkspaceRefreshKey((current) => current + 1)}
        chatResetKey={eveChatKey}
      />
    ),
    'eve-memory': (
      <EvePage
        activeSubpage="memory"
        callCenter={callCenter}
        onNavigate={navigateWorkspace}
        onWorkspaceChanged={() => setWorkspaceRefreshKey((current) => current + 1)}
        chatResetKey={eveChatKey}
      />
    ),
    'eve-call': (
      <EvePage
        activeSubpage="call"
        callCenter={callCenter}
        onNavigate={navigateWorkspace}
        onWorkspaceChanged={() => setWorkspaceRefreshKey((current) => current + 1)}
        chatResetKey={eveChatKey}
      />
    ),
    'eve-schedules': (
      <EvePage
        activeSubpage="schedules"
        callCenter={callCenter}
        onNavigate={navigateWorkspace}
        onWorkspaceChanged={() => setWorkspaceRefreshKey((current) => current + 1)}
        chatResetKey={eveChatKey}
      />
    ),
    stats: (
      <StatsPage
        codingStats={codingStats}
        contestSites={contestSites}
        projects={projects}
        hackathons={hackathons}
        onNavigate={navigateWorkspace}
      />
    ),
    todo: <TodoPage tasks={tasks} setTasks={setTasks} createIntent={creationIntent} />,
    'competitive-coding': <CompetitiveCodingPage contestSites={contestSites} />,
    hackathons: (
      <HackathonsPage
        hackathons={hackathons}
        setHackathons={setHackathons}
        canLoadMore={pagination.hackathons.has_more}
        loadingMore={loadingMore}
        onLoadMore={() => loadMore('hackathons')}
        onOpenHackathon={(hackathonId) => navigate('hackathon-detail', { hackathonId })}
      />
    ),
    'hackathon-detail': selectedHackathon ? (
      <HackathonDetailPage
        hackathon={selectedHackathon}
        onBack={() => navigateWorkspace('hackathons')}
        onSave={(updated) =>
          setHackathons((current) =>
            current.map((item) => (item.id === updated.id ? updated : item)),
          )
        }
        onDelete={(deletedId) =>
          setHackathons((current) =>
            current.filter((item) => item.id !== deletedId),
          )
        }
      />
    ) : (
      <HackathonsPage
        hackathons={hackathons}
        setHackathons={setHackathons}
        canLoadMore={pagination.hackathons.has_more}
        loadingMore={loadingMore}
        onLoadMore={() => loadMore('hackathons')}
        onOpenHackathon={(hackathonId) => navigate('hackathon-detail', { hackathonId })}
      />
    ),
    projects: (
      <ProjectsPage
        projects={projects}
        setProjects={setProjects}
        onOpenProject={openProject}
        canLoadMore={pagination.projects.has_more}
        loadingMore={loadingMore}
        onLoadMore={() => loadMore('projects')}
      />
    ),
    jobs: (
      <JobsPage
        jobs={jobs}
        setJobs={setJobs}
        documents={documents}
        createIntent={creationIntent}
        canLoadMore={pagination.jobs.has_more}
        loadingMore={loadingMore}
        onLoadMore={() => loadMore('jobs')}
      />
    ),
    documents: (
      <DocumentsPage documents={documents} setDocuments={setDocuments} createIntent={creationIntent} onOpenDocument={(documentId) => navigate('document-opener', { documentId })} />
    ),
    workspace: <WorkspacePage />,
    studio: (
      <StudioProjectsPage
        onOpenProject={(project) => navigateWorkspace('studio-detail', project.id)}
        onNavigate={navigateWorkspace}
      />
    ),
    'studio-detail': selectedProjectId ? (
      <StudioBuilderPage
        projectId={selectedProjectId}
        onBack={() => navigateWorkspace('studio')}
      />
    ) : (
      <StudioProjectsPage
        onOpenProject={(project) => navigateWorkspace('studio-detail', project.id)}
        onNavigate={navigateWorkspace}
      />
    ),
    'studio-apps': (
      <StudioAppsPage
        onOpenProject={(project) => navigateWorkspace('studio-detail', project.id)}
        onNavigate={navigateWorkspace}
      />
    ),
    'studio-templates': (
      <StudioTemplatesPage
        onOpenProject={(project) => navigateWorkspace('studio-detail', project.id)}
      />
    ),
    'document-opener': (
      <DocumentOpenerPage
        document={selectedDocument}
        onBack={() => navigateWorkspace('documents')}
      />
    ),
    'project-detail': selectedProject ? (
      <ProjectDetailPage
        project={selectedProject}
        onBack={() => navigateWorkspace('projects')}
        onSave={(updatedProject) =>
          setProjects((current) =>
            current.map((project) =>
              project.id === updatedProject.id ? updatedProject : project,
            ),
          )
        }
      />
    ) : (
      <ProjectsPage
        projects={projects}
        setProjects={setProjects}
        onOpenProject={openProject}
      />
    ),
    calendar: (
      <CalendarPage
        eventsByDate={calendarEventIndex}
        googleCalendarEvents={googleCalendarEvents}
        importedIcsCalendars={importedIcsCalendars}
        setImportedIcsCalendars={setImportedIcsCalendars}
        importedIcsEvents={importedIcsEvents}
        setImportedIcsEvents={setImportedIcsEvents}
        onNavigate={navigateWorkspace}
      />
    ),
    mails: <MailsPage onNavigate={navigateWorkspace} />,
    whatsapp: <WhatsAppPage />,
    chats: <ChatsPage onNavigate={navigateWorkspace} />,
    calls: <CallsPage callCenter={callCenter} user={userProfile} />,
    contacts: <ContactsPage callCenter={callCenter} onNavigate={navigateWorkspace} />,
    usage: <UsagePage />,
    profile: (
      <ProfilePage
        user={userProfile}
        onProfileUpdated={(newName) =>
          setSessionUser((current) => ({
            ...(current || activeUser),
            displayName: newName,
          }))
        }
        onSignOut={handleSignOut}
      />
    ),
      themes: <ThemesPage />,
      setting: (
        <SettingPage
          user={userProfile}
          onNavigate={navigateWorkspace}
          onGoogleCalendarsChange={setGoogleCalendarEvents}
          onHackathonsChange={setHackathons}
          onContestSitesChange={setContestSites}
          importedIcsCalendars={importedIcsCalendars}
          setImportedIcsCalendars={setImportedIcsCalendars}
          importedIcsEvents={importedIcsEvents}
          setImportedIcsEvents={setImportedIcsEvents}
          onSignOut={handleSignOut}
        />
      ),
  }

  if (route === '/') {
    if (!authReady) return <WaveLoader />
    if (resetToken) {
      return publicRoute(<AuthPage mode="reset" resetToken={resetToken} onNavigate={navigateRoute} onAuthenticate={beginOnboarding} />)
    }
    return publicRoute(<LandingPage user={activeUser} onNavigate={navigateRoute} />)
  }
  if (route === '/privacy') return publicRoute(<PrivacyPolicyPage onNavigate={navigateRoute} />)
  if (route === '/terms') return publicRoute(<TermsOfServicePage onNavigate={navigateRoute} />)
  if (route === '/login') {
    if (!authReady) return <WaveLoader />
    if (resetToken) {
      return publicRoute(<AuthPage mode="reset" resetToken={resetToken} onNavigate={navigateRoute} onAuthenticate={beginOnboarding} />)
    }
    if (activeUser) {
      return <WaveLoader />
    }
    return publicRoute(<AuthPage mode="login" onNavigate={navigateRoute} onAuthenticate={beginOnboarding} />)
  }
  if (route === '/signup') {
    if (!authReady) return <WaveLoader />
    if (resetToken) {
      return publicRoute(<AuthPage mode="reset" resetToken={resetToken} onNavigate={navigateRoute} onAuthenticate={beginOnboarding} />)
    }
    if (activeUser) {
      return <WaveLoader />
    }
    return publicRoute(<AuthPage mode="signup" onNavigate={navigateRoute} onAuthenticate={beginOnboarding} />)
  }
  if (route === '/forgot-password') {
    if (!authReady) return <WaveLoader />
    if (activeUser) {
      return <WaveLoader />
    }
    return publicRoute(<ForgotPasswordPage onNavigate={navigateRoute} />)
  }
  if (route === '/onboarding') {
    if (!authReady) return <WaveLoader />
    if (!activeUser) {
      return publicRoute(<AuthPage mode="login" onNavigate={navigateRoute} onAuthenticate={beginOnboarding} />)
    }
    return publicRoute(<OnboardingPage user={activeUser} onComplete={completeOnboarding} />)
  }
  if (!authReady) {
    return <WaveLoader />
  }
  if (!activeUser) {
    return publicRoute(<AuthPage mode="login" onNavigate={navigateRoute} onAuthenticate={beginOnboarding} />)
  }

  return (
    <>
      <AppLayout
        activePage={
          activePage === 'project-detail'
            ? 'projects'
            : activePage === 'hackathon-detail'
              ? 'hackathons'
              : activePage === 'document-opener'
                ? 'documents'
                : activePage === 'studio-detail'
                  ? 'studio'
                  : activePage.startsWith('custom-')
                    ? activePage
                    : activePage
        }
        onNavigate={navigateWorkspace}
        onCreate={requestCreation}
        callCenter={callCenter}
        notifications={notifications}
        setNotifications={updateNotifications}
        notificationsOpen={notificationsOpen}
        setNotificationsOpen={setNotificationsOpen}
        user={userProfile}
        notificationsCanLoadMore={pagination.notifications.has_more}
        notificationsLoading={loadingMore}
        onLoadMoreNotifications={() => loadMore('notifications')}
        onWorkspaceChanged={() => setWorkspaceRefreshKey((current) => current + 1)}
        onEveNewChat={() => setEveChatKey((current) => current + 1)}
        onSignOut={handleSignOut}
        workspaceData={{
          projects,
          jobs,
          documents,
          hackathons,
          tasks,
          contestSites,
        }}
      >
        <Suspense fallback={<WaveLoader />}>
          {activePage.startsWith('custom-')
            ? (() => {
                const slug = activePage.slice(7)
                return <CustomPage slug={slug} />
              })()
            : (pages[activePage] ?? pages.dashboard)}
        </Suspense>
      </AppLayout>
      <IncomingCallOverlay callCenter={callCenter} myUid={userProfile?.uid} />
      <EveUiBanner />
    </>
  )
}

export default App
