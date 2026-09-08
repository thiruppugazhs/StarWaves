import {
  LayoutDashboard,
  CheckCircle2,
  CalendarDays,
  Code2,
  Rocket,
  FolderKanban,
  Bot,
  Sparkles,
  PhoneCall,
  Brain,
  Layers,
  Orbit,
  ShieldCheck,
  Zap,
  FileText,
  MessageCircle,
  MonitorPlay,
} from 'lucide-react'

export const navLinks = [
  { label: 'Story', href: '#manifesto' },
  { label: 'Showcase', href: '#showcase' },
  { label: 'Eve AI', href: '#eve' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'FAQ', href: '#faq' },
]

export const heroProof = [
  'Board → Calendar → List',
  'ICS + Google sync',
  'Monaco inside',
  'Eve is workspace-aware',
]

export const marqueeModules = [
  'Tasks',
  'Calendar',
  'Code Workspace',
  'Eve AI',
  'Projects',
  'Jobs',
  'Hackathons',
  'Documents',
  'Mail',
  'WhatsApp',
  'Calls',
  'Contests',
]

export const manifesto = [
  {
    numeral: '01',
    kicker: 'Signal — Code',
    title: 'One calm surface\nfor everything',
    body: 'Tasks, calendars, contests, hackathons, jobs, projects, docs, mail and chat — stitched into a single deep-crimson canvas so the thread never snaps.',
    icon: Layers,
    accent: 'work',
  },
  {
    numeral: '02',
    kicker: 'Build — Create',
    title: 'Velocity without\nthe noise',
    body: 'A real Monaco workspace, a modular dashboard and a live contest radar. Deep-work tooling that stays out of the frame until you need it.',
    icon: Orbit,
    accent: 'studio',
  },
  {
    numeral: '03',
    kicker: 'Become — Evolve',
    title: 'An assistant that\nlives in your work',
    body: 'Eve reads your files, remembers every decision, browses the web, triages WhatsApp and calls you when it matters — not a tab, a cast member.',
    icon: Brain,
    accent: 'eve',
  },
]

export const showcaseScenes = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    headline: 'Your command center',
    copy: 'Drag, resize, curate. Layouts for builder, competitor and job-seeker modes — every widget live, every arrangement remembered.',
    bullets: ['Widget layouts per mode', 'Arrangement memory per user', 'Command palette everywhere'],
    color: 'var(--module-work)',
  },
  {
    id: 'workspace',
    label: 'Code Workspace',
    icon: MonitorPlay,
    headline: 'A real editor, inside',
    copy: 'Monaco with file tree, search and breadcrumbs — plus Eve file tools that read and write alongside you. No mock IDE.',
    bullets: ['Monaco Editor + minimap', 'File tree + search', 'Eve reads & writes files'],
    color: 'var(--module-workspace)',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: CalendarDays,
    headline: 'One timeline to rule them',
    copy: 'Tasks, Google Calendar, contest dates, interviews and hackathons merged into a single ICS-aware timeline with reminders.',
    bullets: ['Google sync + ICS import', 'Reminder engine', 'Contest auto-feed'],
    color: 'var(--module-calendar)',
  },
  {
    id: 'eve',
    label: 'Eve AI',
    icon: Bot,
    headline: 'Chat. Voice. Memory.',
    copy: 'Streaming replies across six providers, persistent sessions and semantic memory — schedules and calls included.',
    bullets: ['Sessions + vector recall', 'Voice calls with captions', 'Schedules that run alone'],
    color: 'var(--module-eve)',
  },
]

export const eveTerminalLines = [
  'list_workspace_files({ workspace: "starwaves" })',
  'search_workspace_files({ query: "auth callback" })',
  'browse_web({ query: "serverless cron schedules" })',
  'create_eve_schedule({ cron: "0 9 * * 1", action: "call" })',
]

export const eveDemoMessages = [
  { from: 'you', text: 'Review my week and nudge me Monday 9am if the pipeline slips.' },
  { from: 'eve', text: 'Schedule armed — cron Mon 9am, action: call. I\'ll bring the pipeline summary.' },
  { from: 'you', text: 'Draft follow-ups for the teams I met this week.' },
  { from: 'eve', text: 'Three drafts ready in Documents — review, then I\'ll send on your word.' },
]

export const eveCapabilities = [
  {
    icon: Sparkles,
    title: 'Conversational memory',
    desc: 'One tool loop across six providers. Sessions persist, memories embed with pgvector and resurface exactly when relevant.',
    points: ['Workspace-aware search', 'Web browsing built-in', 'Auto-remember key facts'],
    tone: 'eve',
  },
  {
    icon: PhoneCall,
    title: 'Voice that calls you',
    desc: 'Bidirectional WebRTC with live captions and an echo guard. Browser speech instantly, server Whisper + TTS when you want quality.',
    points: ['Hold-to-talk + transcripts', 'Eve can trigger calls', 'Waveform + captions'],
    tone: 'voice',
  },
  {
    icon: CalendarDays,
    title: 'Schedules that run alone',
    desc: 'One-time and cron prompts or voice calls — executed every 15 minutes by serverless cron, even while you sleep.',
    points: ['Cron + one-time', 'Prompt or call', 'Schedule via chat'],
    tone: 'schedule',
  },
]

export const features = [
  { icon: CheckCircle2, title: 'Tasks', desc: 'Priorities, filters and focus modes that stay out of your way.', tone: 'todo', size: 'large' },
  { icon: CalendarDays, title: 'Unified Calendar', desc: 'Merged Google, ICS and contest timelines with reminders.', tone: 'calendar', size: 'standard' },
  { icon: Code2, title: 'Competitive Hub', desc: 'Ratings and upcoming rounds across Codeforces, LeetCode, CodeChef.', tone: 'growth', size: 'standard' },
  { icon: FolderKanban, title: 'Projects', desc: 'Lifecycle phases idea → maintain with stacks and links.', tone: 'projects', size: 'standard' },
  { icon: Rocket, title: 'Jobs & Hackathons', desc: 'Pipelines for applications, interviews and submissions.', tone: 'growth', size: 'large' },
  { icon: LayoutDashboard, title: 'Dashboard', desc: 'Reorderable grid with live widgets for your current mode.', tone: 'work', size: 'standard' },
  { icon: FileText, title: 'Documents', desc: 'Project-linked docs with Monaco preview and Drive import.', tone: 'documents', size: 'standard' },
  { icon: MessageCircle, title: 'Mail & Chat', desc: 'Gmail tabs, WhatsApp bridge and persistent chats.', tone: 'mail', size: 'standard' },
]

export const workflow = [
  {
    step: '01',
    title: 'Land & connect',
    text: 'Create an account, link Google, import ICS, add coding handles. Sources pour into one timeline in under a minute.',
    icon: ShieldCheck,
    tone: 'work',
  },
  {
    step: '02',
    title: 'Shape your stage',
    text: 'Arrange the dashboard, pick a theme, open a workspace folder. Eve learns your context as you work.',
    icon: Layers,
    tone: 'studio',
  },
  {
    step: '03',
    title: 'Move at will',
    text: 'Eve remembers, reminds and calls. You stay in flow — no tab cemetery, no scattered state.',
    icon: Zap,
    tone: 'eve',
  },
]

export const faqs = [
  {
    q: 'What is StarWaves exactly?',
    a: 'A personal operating system for builders: tasks, projects, jobs, hackathons, coding signal, calendar, documents, mail, WhatsApp and the Eve AI assistant — one canvas, three lights: Code, Create, Evolve.',
  },
  {
    q: 'Which integrations are first-class?',
    a: 'Google Calendar (live sync + ICS), Gmail, Drive, GitHub, Codeforces / LeetCode / CodeChef contest feeds, and WhatsApp via the Go bridge. Connect or revoke each one in Settings.',
  },
  {
    q: 'What can Eve do beyond chat?',
    a: 'Search and edit workspace files, browse the web, summarize WhatsApp threads, create schedules and initiate voice calls — all through one six-provider tool loop with persistent memory.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Data is isolated per user and scoped by auth with least-privilege integrations. Nothing is sold or used for training. Disconnect any service anytime.',
  },
  {
    q: 'How does voice work?',
    a: 'Browser speech works instantly with zero setup. Optionally add server Groq Whisper STT and Google Cloud TTS for quality, with live captions and echo guard on every call.',
  },
  {
    q: 'What about Google data usage?',
    a: 'Calendar (readonly) for events, Gmail (readonly/modify/send) only after you connect, Drive (files you open), and openid/email/profile for sign-in. Revoke anytime in Settings.',
  },
]
