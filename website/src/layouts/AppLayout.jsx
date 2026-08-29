import { useEffect, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { Sidebar } from '../components/Sidebar'
import { NetworkStatus } from '../components/NetworkStatus'
import '../App.css'

const MOBILE_NAV_BREAKPOINT = 900

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
    () => localStorage.getItem('starwaves.sidebar-expanded') !== 'false',
  )
  const contentRef = useRef(null)
  const isSidebarExpanded = sidebarExpanded

  useEffect(() => {
    contentRef.current?.focus({ preventScroll: true })
  }, [activePage])

  useEffect(() => {
    localStorage.setItem('starwaves.sidebar-expanded', String(sidebarExpanded))
  }, [sidebarExpanded])

  const toggleNavigation = () => {
    if (window.innerWidth <= MOBILE_NAV_BREAKPOINT) {
      setSidebarOpen(true)
      return
    }
    setSidebarExpanded((expanded) => !expanded)
  }

  return (
    <div className={`app-shell ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <NetworkStatus />
      <Header
        onMenuOpen={toggleNavigation}
        navigationExpanded={isSidebarExpanded}
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
      <div className="app-body">
        <Sidebar
          activePage={activePage}
          isExpanded={isSidebarExpanded}
          isOpen={sidebarOpen}
          onNavigate={onNavigate}
          onClose={() => setSidebarOpen(false)}
        />
        <main
          ref={contentRef}
          id="main-content"
          className={`app-main content ${activePage === 'calendar' ? 'calendar-content' : ''} ${activePage === 'whatsapp' ? 'whatsapp-fullscreen-content' : ''}`}
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
