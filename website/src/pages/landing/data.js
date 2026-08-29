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
  { label: 'AI Assistant', href: '#assistant' },
  { label: 'Workflow', href: '#workflow' },
]

export const manifesto = [
  {
    kicker: 'Act I — Consolidate',
    title: 'One calm surface\nfor everything',
    body: 'Tasks, calendars, contests, hackathons, jobs, projects, docs, mail and chat — stitched into a single sharp black canvas so you never lose the thread.',
    icon: Layers,
    accent: 'mono',
  },
  {
    kicker: 'Act II — Accelerate',
    title: 'Velocity without\nthe noise',
    body: 'Monaco workspace, modular dashboard, live contest radar and pipeline tracking. Built for deep work, not dashboards that shout.',
    icon: Orbit,
    accent: 'mono',
  },
  {
    kicker: 'Act III — Remember',
    title: 'An assistant you\nmake your own',
    body: 'Create and personalize your companion. It reads your files, remembers key decisions, browses the web, and executes tools across your workspace.',
    icon: Brain,
    accent: 'mono',
  },
]

export const showcaseScenes = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    headline: 'Every pulse, one glance',
    copy: 'Modular grid with reorderable widgets. Tasks, coding stats, job applications, calendar events and system status live together without visual conflict.',
    bullets: ['Reorderable grid layout', 'Persistent across sessions', 'Zero-latency cached reads'],
    color: '#FFFFFF',
  },
  {
    id: 'workspace',
    label: 'Workspace IDE',
    icon: MonitorPlay,
    headline: 'Real code, in-browser',
    copy: 'Monaco, file tree, search, breadcrumbs and autonomous assistant file tools. No mock IDE — the actual one.',
    bullets: ['Monaco Editor + minimap', 'File sync to projects', 'Assistant writes & reads files'],
    color: '#FFFFFF',
  },
  {
    id: 'calendar',
    label: 'Timeline',
    icon: CalendarDays,
    headline: 'One timeline to rule them',
    copy: 'Tasks, Google Calendar, contest dates, interviews and hackathons merged into an ICS-aware unified calendar.',
    bullets: ['Google sync + ICS import', 'Reminder engine', 'Contest auto-feed'],
    color: '#FFFFFF',
  },
  {
    id: 'assistant',
    label: 'AI Assistant',
    icon: Bot,
    headline: 'Make Your Own Assistant',
    copy: 'Name your assistant, choose its persona, and pick your brain: free built-in Google Gemini or bring your own API key (ChatGPT, Claude, Groq).',
    bullets: ['Customizable assistant identity', 'Built-in Gemini or BYOK', 'Autonomous tool execution'],
    color: '#FFFFFF',
  },
]

export const assistantCapabilities = [
  {
    icon: Sparkles,
    title: 'Conversational Memory',
    desc: 'Powered by StarWaves built-in Gemini or your own keys (OpenAI, Claude, Groq). Sessions persist, facts are remembered and surfaced when relevant.',
    points: ['Tool-aware workspace search', 'Web browsing built-in', 'Auto-remember key facts'],
  },
  {
    icon: PhoneCall,
    title: 'Voice Calling & Reminders',
    desc: 'Bidirectional WebRTC calls. Live captions, transcripts, and voice synthesis. Your assistant can call you or join focused voice check-ins.',
    points: ['Hold-to-talk + transcripts', 'Voice calls with captions', 'Waveform + voice UI'],
  },
  {
    icon: CalendarDays,
    title: 'Autonomous Schedules',
    desc: 'One-time and cron prompts or voice calls — executed automatically even when you are away.',
    points: ['Cron + one-time schedules', 'Prompt or voice alert', 'Schedule via natural language'],
  },
]

export const features = [
  { icon: CheckCircle2, title: 'Tasks', desc: 'Priorities, filters and focus modes that stay out of your way.', tint: '#FFFFFF' },
  { icon: CalendarDays, title: 'Unified Calendar', desc: 'Merged Google, ICS and contest timelines with reminders.', tint: '#FFFFFF' },
  { icon: Code2, title: 'Competitive Hub', desc: 'Codeforces, LeetCode, CodeChef ratings and upcoming rounds.', tint: '#FFFFFF' },
  { icon: FolderKanban, title: 'Projects', desc: 'Lifecycle phases idea → maintain with tech stacks and links.', tint: '#FFFFFF' },
  { icon: Rocket, title: 'Jobs & Hackathons', desc: 'Pipelines for applications, interviews, submissions and docs.', tint: '#FFFFFF' },
  { icon: LayoutDashboard, title: 'Dashboard', desc: 'Reorderable grid with live widgets for your current mode.', tint: '#FFFFFF' },
  { icon: FileText, title: 'Documents', desc: 'Project-linked docs with Monaco preview and Drive import.', tint: '#FFFFFF' },
  { icon: MessageCircle, title: 'Mail & Chat', desc: 'Gmail tabs, WhatsApp bridge and persistent chats.', tint: '#FFFFFF' },
]

export const workflow = [
  {
    step: '01',
    title: 'Land & connect',
    text: 'Create account, link Google, import ICS, add coding handles. Your sources pour into one timeline in under a minute.',
    icon: ShieldCheck,
  },
  {
    step: '02',
    title: 'Shape your stage',
    text: 'Arrange the modular dashboard, pick a theme, spin up a workspace folder. Your AI assistant adapts to your workflow.',
    icon: Layers,
  },
  {
    step: '03',
    title: 'Move at will',
    text: 'Your assistant remembers context, reminds you of deadlines, and executes tools. You stay in flow — no scattered state.',
    icon: Zap,
  },
]

export const faqs = [
  {
    q: 'What is StarWaves exactly?',
    a: 'A personal productivity workspace for developers and builders. It merges tasks, projects, jobs, hackathons, coding stats, calendar, documents, mail, WhatsApp and a customizable AI assistant into one cohesive dark canvas.',
  },
  {
    q: 'Which integrations are first-class?',
    a: 'Google Calendar (live sync + ICS), Gmail (tabs + compose), Drive, Google Chat, GitHub, Codeforces / LeetCode / CodeChef contests, and WhatsApp via the bridge.',
  },
  {
    q: 'How does the AI assistant work?',
    a: 'You can make and name your own assistant. Choose between StarWaves free built-in Google Gemini or bring your own API key (ChatGPT, Claude, Groq, OpenRouter). It reads files, browses the web, executes tools, and manages schedules.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Workspace data is isolated per user, scoped by auth, and least-privilege per integration. Disconnect any service in Settings. No data is sold or used for training.',
  },
  {
    q: 'How does voice work?',
    a: 'Browser Web Speech for instant use, plus optional server voice models and Google Cloud TTS. Captions stream live during calls with an echo guard.',
  },
  {
    q: 'Can I change my AI assistant name and API keys later?',
    a: 'Yes. In your Settings -> AI Models section, you can rename your assistant, switch between built-in Gemini and your custom API keys, or select different models anytime.',
  },
]
