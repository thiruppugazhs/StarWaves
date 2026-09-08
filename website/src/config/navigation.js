import {
  AppWindow,
  Blocks,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  Contact,
  Files,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  ListTodo,
  Mail,
  MessageCircle,
  MessageSquare,
  Palette,
  Phone,
  Rocket,
  Settings,
  Smile,
  SquareTerminal,
  Trophy,
  UserRound,
} from 'lucide-react'

// IA groups (ADR 0027): Home · Code · Create · Evolve · Connect · You.
// Order here is the sidebar section order. Ids are routing contracts —
// renames/merges need redirects (see ADR 0027 pending merges).
export const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Home', module: 'home' },
  { id: 'workspace', label: 'Workspace', icon: SquareTerminal, group: 'Code', module: 'workspace' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, group: 'Code', module: 'projects' },
  { id: 'documents', label: 'Documents', icon: Files, group: 'Code', module: 'documents' },
  { id: 'todo', label: 'Todo List', icon: ListTodo, group: 'Code', module: 'todo' },
  { id: 'studio', label: 'Builder', icon: Blocks, group: 'Create', module: 'studio' },
  { id: 'studio-apps', label: 'Apps', icon: AppWindow, group: 'Create', module: 'studio' },
  { id: 'studio-templates', label: 'Templates', icon: LayoutTemplate, group: 'Create', module: 'studio' },
  { id: 'jobs', label: 'Jobs', icon: BriefcaseBusiness, group: 'Create', module: 'growth' },
  { id: 'hackathons', label: 'Hackathons', icon: Rocket, group: 'Create', module: 'growth' },
  { id: 'eve', label: 'Eve', icon: Bot, group: 'Evolve', module: 'eve' },
  { id: 'avatar', label: 'Avatar Studio', icon: Smile, group: 'Evolve', module: 'eve' },
  { id: 'compete', label: 'Compete', icon: Trophy, group: 'Evolve', module: 'growth' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, group: 'Connect', module: 'calendar' },
  { id: 'mails', label: 'Mail', icon: Mail, group: 'Connect', module: 'mail' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, group: 'Connect', module: 'whatsapp' },
  { id: 'chats', label: 'Team Chats', icon: MessageSquare, group: 'Connect', module: 'chats' },
  { id: 'calls', label: 'Calls', icon: Phone, group: 'Connect', module: 'calls' },
  { id: 'contacts', label: 'Contacts', icon: Contact, group: 'Connect', module: 'contacts' },
  { id: 'profile', label: 'Profile', icon: UserRound, group: 'You', module: 'account' },
  { id: 'themes', label: 'Themes', icon: Palette, group: 'You', module: 'account' },
  { id: 'setting', label: 'Settings', icon: Settings, group: 'You', module: 'account' },
  { id: 'usage', label: 'Usage', icon: ChartNoAxesCombined, group: 'You', module: 'account' },
]

export const GROUP_MODULE_MAP = {
  Home: 'home',
  Code: 'work',
  Create: 'studio',
  Evolve: 'eve',
  Connect: 'comm',
  You: 'account',
}

export function getGroupModuleKey(group) {
  return GROUP_MODULE_MAP[group] || 'work'
}
