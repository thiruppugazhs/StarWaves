/* eslint-disable react/only-export-components -- lazy page wrappers, not components */
import { lazy } from 'react'

// Lazy app pages — moved out of App.jsx (Wave F closeout) so the root stays
// under the module limit. Code-split chunks are unchanged: one chunk per page.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })))
const DocumentOpenerPage = lazy(() => import('./pages/DocumentOpenerPage').then((m) => ({ default: m.DocumentOpenerPage })))
const HackathonsPage = lazy(() => import('./pages/HackathonsPage').then((m) => ({ default: m.HackathonsPage })))
const HackathonDetailPage = lazy(() => import('./pages/HackathonDetailPage').then((m) => ({ default: m.HackathonDetailPage })))
const JobsPage = lazy(() => import('./pages/JobsPage').then((m) => ({ default: m.JobsPage })))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })))
const SettingPage = lazy(() => import('./pages/SettingPage').then((m) => ({ default: m.SettingPage })))
const ThemesPage = lazy(() => import('./pages/ThemesPage').then((m) => ({ default: m.ThemesPage })))
const CompetePage = lazy(() => import('./pages/CompetePage').then((m) => ({ default: m.CompetePage })))
const TodoPage = lazy(() => import('./pages/TodoPage').then((m) => ({ default: m.TodoPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const EvePage = lazy(() => import('./pages/EvePage').then((m) => ({ default: m.EvePage })))
const AvatarPage = lazy(() => import('./pages/AvatarPage').then((m) => ({ default: m.AvatarPage })))
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

export function buildAppPages({
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
}) {
  return {
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
    avatar: <AvatarPage onNavigate={navigateWorkspace} />,
    compete: (
      <CompetePage
        initialTab="contests"
        contestSites={contestSites}
        codingStats={codingStats}
        projects={projects}
        hackathons={hackathons}
        onNavigate={navigateWorkspace}
      />
    ),
    // Legacy ids resolve to the merged Compete page with the matching tab.
    stats: (
      <CompetePage
        initialTab="stats"
        contestSites={contestSites}
        codingStats={codingStats}
        projects={projects}
        hackathons={hackathons}
        onNavigate={navigateWorkspace}
      />
    ),
    todo: <TodoPage tasks={tasks} setTasks={setTasks} createIntent={creationIntent} />,
    'competitive-coding': (
      <CompetePage
        initialTab="contests"
        contestSites={contestSites}
        codingStats={codingStats}
        projects={projects}
        hackathons={hackathons}
        onNavigate={navigateWorkspace}
      />
    ),
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
        onNavigate={navigateWorkspace}
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
}
