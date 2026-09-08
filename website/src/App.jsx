import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { buildAppPages } from './appPages'
import { AppLayout } from './layouts/AppLayout'
import { IncomingCallOverlay } from './components/calls/IncomingCallOverlay'
// App pages live in appPages.jsx (buildAppPages) — heavy pages stay lazy for
// code-split (fixes 567k index). Only public-shell pages are imported here.
// Public pages lazy — LandingPage pulls framer-motion; none of these are
// needed for authenticated /app/* sessions, so keep them out of `index`.
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage').then((m) => ({ default: m.TermsOfServicePage })))
const CustomPage = lazy(() => import('./pages/CustomPage').then((m) => ({ default: m.CustomPage })))
// Global companion overlay lazy — pulls EveAvatar + useThemeCustomizer; not
// needed for first paint, mounts quietly once loaded.
const EveGlobalCompanionHost = lazy(() => import('./components/eve/avatar/EveGlobalCompanionHost').then((m) => ({ default: m.EveGlobalCompanionHost })))
const AvatarOverlayManager = lazy(() => import('./components/eve/avatar/AvatarOverlayManager').then((m) => ({ default: m.AvatarOverlayManager })))
const AvatarOverlayPage = lazy(() => import('./pages/AvatarOverlayPage').then((m) => ({ default: m.AvatarOverlayPage })))
import { updateNotification } from './lib/workspaceApi'
import { confirmEmailVerification } from './lib/emailApi'
import { clearAuthSession, verifyAccountCombine } from './lib/authApi'
import { CALENDAR_REMINDER_PREFIX } from './utils/calendarReminders'
import { useAuth } from './hooks/useAuth'
import { useRouter } from './hooks/useRouter'
import { useWorkspaceData } from './hooks/useWorkspaceData'
import { useCallCenter } from './hooks/call/useCallCenter'
import { useSyncEvents } from './hooks/useSyncEvents'
import { applyThemeVariables } from './themes/themeApplicator'
import { NetworkStatus } from './components/NetworkStatus'
import { WaveLoader } from './components/WaveLoader'
import { useDialogAccessibility } from './hooks/useDialogAccessibility'
import { CustomUIProvider } from './hooks/useCustomUI'
import { EveUiBanner } from './components/ui/EveUiBanner'
import { UpdateBanner } from './components/ui/UpdateBanner'
import { useAutoUpdater } from './hooks/useAutoUpdater'
import { EveAvatarProvider } from './components/eve/avatar/EveAvatarProvider'

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
      <Suspense fallback={<WaveLoader />}>{content}</Suspense>
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
  const isNativeApp = (() => {
    try {
      if (typeof window !== 'undefined') {
        if (window.Capacitor?.isNativePlatform?.() && window.Capacitor.isNativePlatform()) return true
        if (window.__TAURI__) return true
        if (navigator.userAgent.includes('Capacitor') || navigator.userAgent.includes('Tauri')) return true
        if (window.location.protocol === 'capacitor:' || window.location.protocol === 'tauri:') return true
      }
    } catch {}
    return false
  })()
  const { update: appUpdate, dismiss: dismissAppUpdate } = useAutoUpdater()

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
          return
        }
      } catch (err) {
        console.error('Could not load custom theme:', err)
      }
    }
    const stored = localStorage.getItem('starwaves.theme')
    if (stored === 'light') {
      applyThemeVariables({ preset: 'light', mode: 'light' })
    }
  }, [])


  useEffect(() => {
    if (
      authReady &&
      activeUser &&
      !resetToken &&
      (route === '/' || route === '/login' || route === '/signup' || route === '/forgot-password' || route === '/auth')
    ) {
      window.history.replaceState({}, '', '/app/dashboard')
      setRoute('/app/dashboard')
      setActivePage('dashboard')
      setSelectedProjectId(null)
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

  const navigateWorkspace = (page, projectId = null, documentId = null, hackathonId = null) => {
    const effectiveHackathonId = hackathonId || (page === 'hackathon-detail' ? projectId : null)
    const effectiveProjectId = page === 'hackathon-detail' ? null : projectId
    navigate(page, { projectId: effectiveProjectId, documentId, hackathonId: effectiveHackathonId })
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

  const pages = buildAppPages({
    activeUser,
    calendarEventIndex,
    callCenter,
    codingStats,
    contestSites,
    creationIntent,
    documents,
    setDocuments,
    eveChatKey,
    googleCalendarEvents,
    hackathons,
    setHackathons,
    importedIcsCalendars,
    setImportedIcsCalendars,
    importedIcsEvents,
    setImportedIcsEvents,
    jobs,
    setJobs,
    loadingMore,
    loadMore,
    navigate,
    navigateWorkspace,
    notifications,
    setNotificationsOpen,
    openProject,
    pagination,
    projects,
    setProjects,
    requestCreation,
    selectedDocument,
    selectedHackathon,
    selectedProject,
    selectedProjectId,
    setContestSites,
    setGoogleCalendarEvents,
    setSessionUser,
    setWorkspaceRefreshKey,
    tasks,
    setTasks,
    userProfile,
    handleSignOut,
  })

  if (route === '/') {
    if (!authReady) return <WaveLoader />
    if (resetToken) {
      return publicRoute(<AuthPage mode="reset" resetToken={resetToken} onNavigate={navigateRoute} onAuthenticate={beginOnboarding} />)
    }
    if (isNativeApp && !activeUser) {
      return publicRoute(<AuthPage mode="login" onNavigate={navigateRoute} onAuthenticate={beginOnboarding} />)
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
  // Tauri overlay window — served to the transparent secondary window.
  // No auth guard needed: it reads state via BroadcastChannel from the main window.
  if (route === '/app/avatar-overlay') {
    return (
      <EveAvatarProvider>
        <Suspense fallback={null}>
          <AvatarOverlayPage />
        </Suspense>
      </EveAvatarProvider>
    )
  }

  if (!authReady) {
    return <WaveLoader />
  }
  if (!activeUser) {
    return publicRoute(<AuthPage mode="login" onNavigate={navigateRoute} onAuthenticate={beginOnboarding} />)
  }

  return (
    <CustomUIProvider>
      <EveAvatarProvider>
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
                  : activePage === 'eve-sessions' ||
                        activePage === 'eve-memory' ||
                        activePage === 'eve-call' ||
                        activePage === 'eve-schedules'
                      ? 'eve'
                      : activePage === 'stats' || activePage === 'competitive-coding'
                        ? 'compete'
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
          <div key={activePage} className="app-page-enter">
            {activePage.startsWith('custom-')
              ? (() => {
                  const slug = activePage.slice(7)
                  return <CustomPage slug={slug} />
                })()
              : (pages[activePage] ?? pages.dashboard)}
          </div>
        </Suspense>
        <IncomingCallOverlay callCenter={callCenter} myUid={userProfile?.uid} />
        <UpdateBanner update={appUpdate} onDismiss={dismissAppUpdate} />
        <EveUiBanner />
        <Suspense fallback={null}>
          <EveGlobalCompanionHost />
        </Suspense>
        <Suspense fallback={null}>
          <AvatarOverlayManager />
        </Suspense>
      </AppLayout>
    </EveAvatarProvider>
    </CustomUIProvider>
  )
}

export default App
