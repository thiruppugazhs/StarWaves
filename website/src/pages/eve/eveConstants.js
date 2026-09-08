import { Brain, CalendarClock, History, MessageSquare, PhoneCall } from 'lucide-react'

export const EVE_TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'sessions', label: 'Sessions', icon: History },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'call', label: 'Voice Call', icon: PhoneCall },
  { id: 'schedules', label: 'Schedules', icon: CalendarClock },
]

export const TAB_PAGE_ID = {
  chat: 'eve',
  sessions: 'eve-sessions',
  memory: 'eve-memory',
  call: 'eve-call',
  schedules: 'eve-schedules',
}

export const STARTER_MESSAGES = [
  {
    role: 'assistant',
    content:
      'Hello! I’m Eve, your StarWaves AI workspace assistant. I can read, create, update, soft-delete, and restore records across your workspace, help you with code, and browse the open web for up-to-date information and research.',
  },
]

export const EVE_PRESET_PROMPTS = [
  { command: 'web', label: 'Search the web', prompt: 'Search the open web for the latest updates and information on: ', description: 'Browse and search external websites' },
  { command: 'call', label: 'Call me now', prompt: 'Call me right now on voice to review my workspace status.', description: 'Trigger an immediate incoming voice call from Eve' },
  { command: 'today', label: 'Plan my day', prompt: 'Plan my day by reviewing tasks, upcoming deadlines, and calendar events.', description: 'Review tasks, deadlines, and calendar events' },
  { command: 'tasks', label: 'Manage tasks & overdue', prompt: 'Find all overdue tasks and suggest next priority actions.', description: 'Audit overdue tasks and list priority items' },
  { command: 'projects', label: 'Work with projects', prompt: 'Review project progress, stale projects, and next steps.', description: 'Review project progress and stale projects' },
  { command: 'jobs', label: 'Track applications', prompt: 'Summarize recent job application statuses and upcoming interview dates.', description: 'Find job application status and interview dates' },
  { command: 'documents', label: 'Search documents', prompt: 'Search workspace documents and summarize key notes.', description: 'Search documents and notes' },
  { command: 'calendar', label: 'Check calendar & contests', prompt: 'Look up upcoming calendar events, competitive coding contests, and deadlines.', description: 'Look up events, contests, and deadlines' },
  { command: 'insights', label: 'Workspace overview', prompt: 'Summarize overall workspace dashboard metrics and suggest next actions.', description: 'Generate overall workspace insights' },
]

export const EVE_TOOLS_LIST = [
  { command: 'web', name: 'web', label: 'Web Browsing & Search Tool', description: 'Search the open web, browse external websites, and read URLs' },
  { command: 'todos', name: 'todos', label: 'Tasks & Todos Tool', description: 'Read, create, update, or soft-delete task items' },
  { command: 'projects', name: 'projects', label: 'Projects Tool', description: 'Access project repositories, milestones, and status' },
  { command: 'jobs', name: 'jobs', label: 'Job Tracker Tool', description: 'Access job applications, interview dates, and contacts' },
  { command: 'hackathons', name: 'hackathons', label: 'Hackathons Tool', description: 'Access hackathons, schedules, and prize details' },
  { command: 'documents', name: 'documents', label: 'Documents Tool', description: 'Access notes, project plans, and drive specs' },
  { command: 'notifications', name: 'notifications', label: 'Notifications Tool', description: 'Access workspace notifications and reminders' },
  { command: 'search', name: 'search', label: 'Workspace Search Tool', description: 'Search across all local workspace resources' },
  { command: 'insight', name: 'insight', label: 'Workspace Insights Tool', description: 'Compute deadlines, overdue tasks, or dashboard summary' },
]
