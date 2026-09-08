import { lazy, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  FolderKanban,
  LogOut,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Search,
  Settings,
  Trophy,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { clearAuthSession } from '../lib/authApi'
import { deleteNotification, markAllNotificationsRead } from '../lib/workspaceApi'
import { CALENDAR_REMINDER_PREFIX } from '../utils/calendarReminders'
import { getNotificationPermission, requestNotificationPermission } from '../utils/browserNotifications'
import { navigationItems } from '../config/navigation'
// Interaction-only modals — fetched on first open so the search index,
// Eve modal, and Markdown renderer stay out of the initial shell.
const EveAssistantModal = lazy(() => import('./EveAssistantModal').then((m) => ({ default: m.EveAssistantModal })))
const AdvancedSearchModal = lazy(() => import('./search/AdvancedSearchModal').then((m) => ({ default: m.AdvancedSearchModal })))

import { applyThemeVariables, THEME_PRESETS } from '../themes/presets'

export function Header({
  activePage,
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const handleSignOut = () => {
    setProfileMenuOpen(false)
    if (onSignOut) {
      onSignOut()
    } else {
      clearAuthSession()
    }
  }
  const [eveOpen, setEveOpen] = useState(false)
  const [editorContext, setEditorContext] = useState(null)
  const [permissionStatus, setPermissionStatus] = useState(() => getNotificationPermission())

  const handleToggleNotifications = () => {
    if (!notificationsOpen && getNotificationPermission() === 'default') {
      requestNotificationPermission()
        .then((res) => setPermissionStatus(res))
        .catch(() => setPermissionStatus(getNotificationPermission()))
    } else {
      setPermissionStatus(getNotificationPermission())
    }
    setNotificationsOpen((current) => !current)
  }

  const handleRequestPermission = async () => {
    try {
      const res = await requestNotificationPermission()
      setPermissionStatus(res)
    } catch {
      setPermissionStatus(getNotificationPermission())
    }
  }

  const unreadCount = (notifications || []).filter(
    (notification) => notification.unread,
  ).length

  const notificationIcons = {
    calendar: CalendarDays,
    contest: Trophy,
    project: FolderKanban,
    job: BriefcaseBusiness,
    call: Phone,
    call_incoming: PhoneIncoming,
    call_missed: PhoneMissed,
    call_declined: PhoneOff,
  }

  const notificationDestinations = {
    calendar: 'calendar',
    contest: 'compete',
    project: 'projects',
    job: 'jobs',
    hackathon: 'hackathons',
    task: 'todo',
    call: 'calls',
    call_incoming: 'calls',
    call_missed: 'calls',
    call_declined: 'calls',
  }

  const handleToggleTheme = () => {
    const isCurrentlyDark = document.documentElement.classList.contains('dark-theme')
    const nextMode = isCurrentlyDark ? 'light' : 'dark'
    const nextPreset = nextMode
    const presetData = THEME_PRESETS[nextPreset]
    if (!presetData) return

    let currentConfig = {}
    try {
      const saved = localStorage.getItem('starwaves.custom_theme')
      if (saved) currentConfig = JSON.parse(saved) || {}
    } catch {}

    const nextState = {
      ...currentConfig,
      preset: nextPreset,
      mode: nextMode,
      colors: presetData.colors,
    }

    applyThemeVariables(nextState)
    try {
      localStorage.setItem('starwaves.custom_theme', JSON.stringify(nextState))
    } catch {}
    window.dispatchEvent(new CustomEvent('starwaves:theme-change', { detail: nextState }))
  }

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
      if (event.key === 'Escape') setNotificationsOpen(false)
    }

    // Mobile tab bar search entry point (decoupled via event).
    const handleOpenSearchEvent = () => setSearchOpen(true)

    document.addEventListener('keydown', handleShortcut)
    window.addEventListener('starwaves:open-search', handleOpenSearchEvent)
    const handleOpenEve = () => setEveOpen(true)
    const handleEditorContext = (event) => setEditorContext(event.detail || null)
    window.addEventListener('starwaves:open-eve', handleOpenEve)
    window.addEventListener('starwaves:avatar-editor-context', handleEditorContext)
    return () => {
      document.removeEventListener('keydown', handleShortcut)
      window.removeEventListener('starwaves:open-search', handleOpenSearchEvent)
      window.removeEventListener('starwaves:open-eve', handleOpenEve)
      window.removeEventListener('starwaves:avatar-editor-context', handleEditorContext)
    }
  }, [setNotificationsOpen])

  const navigateFromMenu = (page) => {
    onNavigate(page)
    setProfileMenuOpen(false)
  }

  const openNotification = (notification) => {
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, unread: false } : item,
      ),
    )
    setNotificationsOpen(false)

    const destination =
      notification.destination ?? notificationDestinations[notification.type]
    if (destination) {
      if (destination === 'calendar' && notification.targetId && notification.dateKey) {
        localStorage.setItem(
          'starwaves.calendar-focus',
          JSON.stringify({ targetId: notification.targetId, dateKey: notification.dateKey }),
        )
      }
      onNavigate(destination)
      if (notification.targetId) {
        window.setTimeout(() => {
          const target = document.querySelector(
            `[data-record-id="${CSS.escape(notification.targetId)}"]`,
          )
          if (!target) return
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
          target.classList.add('notification-target-highlight')
          window.setTimeout(() => target.classList.remove('notification-target-highlight'), 1600)
        }, 120)
      }
    }
  }

  const handleMarkAllRead = () => {
    markAllNotificationsRead().catch((err) => console.error(err))
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        unread: false,
      })),
    )
  }

  const handleDeleteNotification = (event, notificationId) => {
    event.stopPropagation()
    if (!notificationId.startsWith(CALENDAR_REMINDER_PREFIX)) {
      deleteNotification(notificationId).catch((err) => console.error(err))
    }
    setNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId),
    )
  }

  const currentNav = navigationItems.find((item) => item.id === activePage) || {
    label: activePage ? activePage.charAt(0).toUpperCase() + activePage.slice(1) : 'Dashboard',
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-page-title" aria-current="page">{currentNav.label}</span>
        </div>

        <div className="header-actions">
        <div className="search-container">
          <button
            type="button"
            className="search header-search-trigger"
            onClick={() => setSearchOpen(true)}
            aria-label="Search any section, page, or record (⌘K)"
          >
            <Search size={16} />
            <span className="search-placeholder">Search any section…</span>
            <kbd>⌘ K</kbd>
          </button>
        </div>
        <button
          className="eve-button"
          type="button"
          onClick={() => setEveOpen(true)}
          aria-label="Open Eve AI assistant"
        >
          <Bot size={17} />
          <span>Eve</span>
        </button>
        <button
          className="icon-button notification-button"
          type="button"
          aria-label={`${unreadCount} unread notifications`}
          aria-expanded={notificationsOpen}
          onClick={handleToggleNotifications}
        >
          <Bell size={19} />
          {unreadCount > 0 && <span>{unreadCount}</span>}
        </button>
        <div className="profile-menu">
          <button
            className="profile-button"
            aria-label="Open profile menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((open) => !open)}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.fullName}
                className="avatar avatar-sm"
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fb = e.currentTarget.nextElementSibling
                  if (fb) fb.style.display = 'grid'
                }}
              />
            ) : null}
            <span className={`avatar ${user.photoURL ? 'avatar-fallback' : ''}`}>
              {user.initials}
            </span>
            <span className="profile-name">{user.firstName}</span>
            <ChevronDown
              className={profileMenuOpen ? 'chevron-open' : ''}
              size={15}
            />
          </button>

          {profileMenuOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-heading">
                <strong>{user.fullName}</strong>
                <span>{user.email}</span>
              </div>
              <div className="profile-dropdown-links">
                <button onClick={() => navigateFromMenu('profile')}>
                  <UserRound size={16} />
                  Profile
                </button>
                <button onClick={() => navigateFromMenu('setting')}>
                  <Settings size={16} />
                  Settings
                </button>
                <div className="profile-dropdown-divider" />
                <button onClick={handleSignOut} className="sign-out-button">
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </header>

      {notificationsOpen && createPortal(
        <div
          className="notification-backdrop"
          onMouseDown={() => setNotificationsOpen(false)}
          role="presentation"
        >
          <aside
            className="notification-panel"
            aria-label="Notifications"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="notification-panel-header">
              <div>
                <p>Inbox</p>
                <h2>Notifications</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setNotificationsOpen(false)}
                aria-label="Close notifications"
              >
                <X size={19} />
              </button>
            </div>

            {permissionStatus === 'default' && (
              <div className="notification-permission-banner">
                <div className="permission-banner-text">
                  <Bell size={15} />
                  <span>Enable desktop alerts for reminders, calls &amp; deadlines.</span>
                </div>
                <button
                  type="button"
                  className="permission-banner-button"
                  onClick={handleRequestPermission}
                >
                  Enable
                </button>
              </div>
            )}

            <div className="notification-toolbar">
              <span>
                {unreadCount} unread
              </span>
              {notifications.length > 0 && (
                <button type="button" onClick={handleMarkAllRead}>
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
            </div>

            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="notification-empty">
                  <Bell size={24} aria-hidden="true" />
                  <p>No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const NotificationIcon =
                    notificationIcons[notification.type] ?? Bell

                  return (
                    <div className={`notification-item ${notification.unread ? 'unread' : ''}`} key={notification.id}>
                      <button type="button" className="notification-main" onClick={() => openNotification(notification)}>
                        <span className="notification-icon"><NotificationIcon size={17} /></span>
                        <span className="notification-copy">
                          <span className="notification-title-row">
                            <strong>{notification.title}</strong>
                            {notification.unread && <span className="notification-unread-dot" aria-label="Unread" />}
                          </span>
                          <span>{notification.message}</span>
                          <small>{notification.time}</small>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNotification(e, notification.id)}
                        title="Dismiss notification"
                        className="notification-dismiss"
                        aria-label={`Dismiss ${notification.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            {notificationsCanLoadMore && (
              <div className="notification-panel-footer">
                <button className="secondary-button" type="button" onClick={onLoadMoreNotifications} disabled={notificationsLoading}>
                  {notificationsLoading ? 'Loading…' : 'Load more notifications'}
                </button>
              </div>
            )}
          </aside>
        </div>,
        document.body,
      )}
      {eveOpen && (
        <Suspense fallback={null}>
          <EveAssistantModal
            isOpen={eveOpen}
            onClose={() => setEveOpen(false)}
            onNavigate={onNavigate}
            onWorkspaceChanged={onWorkspaceChanged}
            editorContext={editorContext}
          />
        </Suspense>
      )}
      {searchOpen && (
        <Suspense fallback={null}>
          <AdvancedSearchModal
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            onNavigate={onNavigate}
            onCreate={onCreate}
            callCenter={callCenter}
            toggleTheme={handleToggleTheme}
            setDarkTheme={handleToggleTheme}
            setEveOpen={setEveOpen}
            setNotificationsOpen={setNotificationsOpen}
            onEveNewChat={onEveNewChat}
            onSignOut={handleSignOut}
            workspaceData={workspaceData}
          />
        </Suspense>
      )}
    </>
  )
}
