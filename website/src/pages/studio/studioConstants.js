export const STUDIO_BUILD_STATUS_LABELS = {
  draft: 'Draft',
  planned: 'Planned',
  building: 'Building',
  ready: 'Ready',
  error: 'Error',
}

export const STUDIO_PLAN_STATUS_LABELS = {
  none: 'No plan yet',
  proposed: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const BUILDER_CENTER_TABS = [
  { id: 'code', label: 'Code' },
  { id: 'preview', label: 'Preview' },
]

export const PROMPT_SUGGESTIONS = [
  { label: '📊 SaaS Dashboard', prompt: 'Build a modern SaaS metrics dashboard with KPI cards, revenue charts, and user activity table.' },
  { label: '⚡ Kanban Board', prompt: 'Create a drag-and-drop Kanban task board with custom columns, labels, and local persistence.' },
  { label: '💬 AI Chat App', prompt: 'Build a real-time chat interface with model switching, markdown code blocks, and conversation history.' },
  { label: '🎯 Habit Tracker', prompt: 'Build a daily habit tracker with streak counts, completion heatmaps, and weekly goals.' },
  { label: '🛒 E-commerce', prompt: 'Create a product storefront with search, category filters, interactive shopping cart, and checkout flow.' },
  { label: '📝 Notes Wiki', prompt: 'Build a minimalist markdown notes knowledge-base with tags, instant search, and live preview.' },
]

export function buildStatusLabel(status) {
  return STUDIO_BUILD_STATUS_LABELS[status] ?? status
}

export function planStatusLabel(status) {
  return STUDIO_PLAN_STATUS_LABELS[status] ?? status
}

const PROMPT_NAME_WORD_COUNT = 6
const PROMPT_NAME_MAX_LENGTH = 48

export function deriveProjectName(prompt) {
  const words = prompt
    .trim()
    .split(/\s+/)
    .slice(0, PROMPT_NAME_WORD_COUNT)
    .join(' ')
    .replace(/[^\w\s-]/g, '')
    .trim()
  if (!words) return 'Untitled App'
  const titled = words.replace(/\b\w/g, (char) => char.toUpperCase())
  return titled.slice(0, PROMPT_NAME_MAX_LENGTH)
}
