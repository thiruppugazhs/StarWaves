// Canonical persistence keys — single source of truth for every
// localStorage/sessionStorage key in the app (ADR 0045).
//
// Rules:
// - Values are verbatim (never rename a key — stored user data depends on it).
// - Event names (CustomEvent/BroadcastChannel) are NOT here — they are not
//   persisted state. Only storage keys and storage-key prefixes live here.
// - Dynamic keys go through the helper functions below so formatting is shared.
// - Server state wins over these cached mirrors (DB is authoritative).

export const AUTH_TOKEN_KEY = 'starwaves_auth_token'
export const AUTH_USER_KEY = 'starwaves_auth_user'
export const DEVICE_ID_KEY = 'starwaves.device_id'
export const DEVICE_NAME_KEY = 'starwaves.device_name'

export const THEME_MODE_KEY = 'starwaves.theme'
export const CUSTOM_THEME_KEY = 'starwaves.custom_theme'

export const DASHBOARD_KEY = 'starwaves.dashboard.preferences'
export const SIDEBAR_EXPANDED_KEY = 'starwaves.sidebar-expanded'

export const AVATAR_PREFS_KEY = 'starwaves:eve-avatar:v1'
export const UI_CACHE_KEY = 'starwaves.ui.cache'
export const OVERLAY_POSITION_KEY = 'starwaves.overlay-position'
export const COMPANION_EXPANDED_KEY = 'starwaves.avatar-companion-expanded'

export const RECENT_SEARCHES_KEY = 'starwaves.recent_searches'

export const IMPORTED_CALENDARS_KEY = 'starwaves-imported-calendars'
export const IMPORTED_EVENTS_KEY = 'starwaves-imported-events'
export const FIRED_REMINDERS_KEY = 'starwaves.fired_reminders'
export const ENABLED_PLATFORMS_KEY = 'starwaves-enabled-contest-platforms'

export const UPDATE_DISMISS_PREFIX = 'starwaves:update:dismissed:'
export const OTA_BUNDLE_KEY = 'starwaves:ota:bundleId'

export const GMAIL_SESSION_KEY = 'starwaves-gmail-authorization-v2'
export const GMAIL_ACCOUNTS_KEY = 'starwaves-gmail-accounts-v2'
export const GMAIL_CONNECTED_KEY = 'starwaves-gmail-connected'

export const CALENDAR_VIEW_KEY = 'starwaves.calendar.view'
export const CALENDAR_FOCUS_KEY = 'starwaves.calendar-focus'

export const ACTIVE_WORKSPACE_KEY = 'starwaves.workspace.active_id'
export const BROWSER_URL_BASE = 'starwaves.workspace.browser-url'

export function workspaceBrowserKey(workspaceId) {
  return `${BROWSER_URL_BASE}:${workspaceId || 'default'}`
}

export const STUDIO_BRIEF_PREFIX = 'starwaves.studio.brief.'
export const STUDIO_CHAT_PREFIX = 'starwaves.studio.chat_session.'

export const HACKATHON_LAYOUT_KEY = 'starwaves-hackathon-layout'
export const HACKATHON_FOCUS_KEY = 'starwaves.hackathon-focus'
export const HACKATHONS_MODE_KEY = 'starwaves.hackathons.mode'
export const HACKATHONS_SOURCE_KEY = 'starwaves.hackathons.source'
export const HACKATHONS_SORT_KEY = 'starwaves.hackathons.sort'

export const CONTESTS_PLATFORM_KEY = 'starwaves.contests.platform'
export const CONTESTS_TIMEFRAME_KEY = 'starwaves.contests.timeframe'
export const CONTESTS_SORT_KEY = 'starwaves.contests.sort'

export const LOCAL_NOTIFICATIONS_KEY = 'starwaves.local_notifications'
export const EVE_VOICE_PREFS_KEY = 'starwaves.eve_voice_prefs'
export const OAUTH_EVENT_KEY = 'starwaves_oauth_event'

export const JOBS_STATUS_KEY = 'starwaves.jobs.status'
export const JOBS_WORK_TYPE_KEY = 'starwaves.jobs.work-type'
export const JOBS_SORT_KEY = 'starwaves.jobs.sort'
export const MAIL_FOLDER_KEY = 'starwaves.mail.folder'
export const MAIL_INBOX_TAB_KEY = 'starwaves.mail.inbox-tab'
export const PROJECTS_VIEW_KEY = 'starwaves.projects.view_mode'
export const PROJECTS_STATUS_KEY = 'starwaves.projects.status'
export const PROJECTS_SORT_KEY = 'starwaves.projects.sort'
export const TODO_FILTER_KEY = 'starwaves.todo.filter'

export function themeExportFilename(preset) {
  return `starwaves-ui-ux-${preset || 'custom'}.json`
}
