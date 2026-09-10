import { useEffect, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { Sidebar } from '../components/Sidebar'
import { MobileTabBar } from '../components/MobileTabBar'
import { NetworkStatus } from '../components/NetworkStatus'
import '../App.css'
import { SIDEBAR_EXPANDED_KEY } from '../lib/storageKeys'

export function AppLayout({
  activePage,
  children,
  onNavigate,
  onCreate,
  callCenter,
  notifications,
  setNotifications,
  notificationsOpen,
  setNotificationsOpen,
  user,
  notificationsCanLoadMore,
  notificationsLoading,
  onLoadMoreNotifications,
  onWorkspaceChanged,
  onEveNewChat,
  onSignOut,
  workspaceData,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(
    () => localStorage.getItem(SIDEBAR_EXPANDED_KEY) !== 'false',
  )
  const contentRef = useRef(null)
  const isSidebarExpanded = sidebarExpanded

  useEffect(() => {
    contentRef.current?.focus({ preventScroll: true })
  }, [activePage])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(sidebarExpanded))
  }, [sidebarExpanded])

  return (
    <div className={`app-shell ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <NetworkStatus />
      <Sidebar
        activePage={activePage}
        isExpanded={isSidebarExpanded}
        isOpen={sidebarOpen}
        onNavigate={onNavigate}
        onClose={() => setSidebarOpen(false)}
        onToggleExpand={() => setSidebarExpanded((expanded) => !expanded)}
        onWorkspaceChanged={onWorkspaceChanged}
      />
      <div className="app-main-wrapper">
        <Header
          activePage={activePage}
          onNavigate={onNavigate}
          onCreate={onCreate}
          callCenter={callCenter}
          notifications={notifications}
          setNotifications={setNotifications}
          notificationsOpen={notificationsOpen}
          setNotificationsOpen={setNotificationsOpen}
          user={user}
          notificationsCanLoadMore={notificationsCanLoadMore}
          notificationsLoading={notificationsLoading}
          onLoadMoreNotifications={onLoadMoreNotifications}
          onWorkspaceChanged={onWorkspaceChanged}
          onEveNewChat={onEveNewChat}
          onSignOut={onSignOut}
          workspaceData={workspaceData}
        />
        <main
          ref={contentRef}
          id="main-content"
          className={`app-main content ${activePage === 'calendar' ? 'calendar-content' : ''} ${activePage === 'whatsapp' ? 'whatsapp-fullscreen-content' : ''} ${activePage === 'workspace' ? 'workspace-fullscreen-content' : ''} ${activePage === 'avatar' ? 'avatar-fullscreen-content' : ''}`}
          tabIndex={-1}
        >
          {children}
        </main>
        <MobileTabBar activePage={activePage} onNavigate={onNavigate} />
      </div>
    </div>
  )
}
