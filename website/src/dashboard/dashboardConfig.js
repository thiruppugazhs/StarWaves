import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare2,
  FileText,
  FolderKanban,
  Gauge,
  Rocket,
  Trophy,
} from 'lucide-react'

export const DASHBOARD_STORAGE_KEY = 'starwaves.dashboard.preferences'
export const DASHBOARD_SCHEMA_VERSION = 2
export const DASHBOARD_BREAKPOINTS = { lg: 1200, md: 900, sm: 620, xs: 0 }
export const DASHBOARD_COLS = { lg: 12, md: 10, sm: 6, xs: 2 }

export const dashboardWidgets = [
  { id: 'today', title: 'Today overview', icon: Gauge, destination: 'calendar' },
  { id: 'todo', title: 'Todo list', icon: CheckSquare2, destination: 'todo' },
  { id: 'calendar', title: 'Upcoming events', icon: CalendarDays, destination: 'calendar' },
  { id: 'competitive-coding', title: 'Competitive coding', icon: Trophy, destination: 'competitive-coding' },
  { id: 'hackathons', title: 'Hackathons', icon: Rocket, destination: 'hackathons' },
  { id: 'projects', title: 'Project progress', icon: FolderKanban, destination: 'projects' },
  { id: 'jobs', title: 'Job applications', icon: BriefcaseBusiness, destination: 'jobs' },
  { id: 'documents', title: 'Recent documents', icon: FileText, destination: 'documents' },
  { id: 'notifications', title: 'Notifications', icon: Bell, destination: null },
]

const item = (i, x, y, w, h, minW = 2, minH = 3) => ({
  i, x, y, w, h, minW, minH,
})

export const defaultDashboardLayouts = {
  lg: [
    item('today', 0, 0, 4, 5), item('todo', 4, 0, 4, 5), item('notifications', 8, 0, 4, 5),
    item('calendar', 0, 5, 6, 5), item('projects', 6, 5, 6, 5),
    item('jobs', 0, 10, 4, 5), item('competitive-coding', 4, 10, 4, 5), item('hackathons', 8, 10, 4, 5),
    item('documents', 0, 15, 12, 4),
  ],
  md: [
    item('today', 0, 0, 5, 5), item('todo', 5, 0, 5, 5),
    item('notifications', 0, 5, 4, 5), item('calendar', 4, 5, 6, 5),
    item('projects', 0, 10, 5, 5), item('jobs', 5, 10, 5, 5),
    item('competitive-coding', 0, 15, 5, 5), item('hackathons', 5, 15, 5, 5),
    item('documents', 0, 20, 10, 4),
  ],
  sm: dashboardWidgets.map((widget, index) =>
    item(widget.id, (index % 2) * 3, Math.floor(index / 2) * 5, 3, 5),
  ),
  xs: dashboardWidgets.map((widget, index) =>
    item(widget.id, 0, index * 5, 2, 5, 2, 3),
  ),
}

export function cloneDefaultLayouts() {
  return Object.fromEntries(
    Object.entries(defaultDashboardLayouts).map(([key, layout]) => [
      key,
      layout.map((entry) => ({ ...entry })),
    ]),
  )
}

export function normalizeDashboardLayouts(layouts) {
  return Object.fromEntries(
    Object.entries(defaultDashboardLayouts).map(([breakpoint, defaults]) => {
      const cols = DASHBOARD_COLS[breakpoint]
      const savedById = new Map(
        (Array.isArray(layouts?.[breakpoint]) ? layouts[breakpoint] : []).map(
          (entry) => [entry.i, entry],
        ),
      )

      return [
        breakpoint,
        defaults.map((fallback) => {
          const saved = savedById.get(fallback.i) ?? {}
          const minW = saved.minW ?? fallback.minW
          const minH = saved.minH ?? fallback.minH
          const savedWidth = saved.w >= minW ? saved.w : fallback.w
          const savedHeight = saved.h >= minH ? saved.h : fallback.h
          const w = Math.min(cols, Math.max(minW, savedWidth))
          const h = Math.max(minH, savedHeight)

          return {
            ...fallback,
            ...saved,
            minW,
            minH,
            w,
            h,
            x: Math.max(0, Math.min(saved.x ?? fallback.x, cols - w)),
            y: Math.max(0, saved.y ?? fallback.y),
          }
        }),
      ]
    }),
  )
}

/**
 * Packs visible widgets row-first and expands the final card in each row to
 * consume any columns left over. Hidden entries remain in the saved layouts so
 * restoring a widget can place it back into the compacted grid.
 */
export function compactDashboardLayouts(layouts, hiddenWidgetIds) {
  const hidden = new Set(hiddenWidgetIds)

  return Object.fromEntries(
    Object.entries(layouts).map(([breakpoint, layout]) => {
      const cols = DASHBOARD_COLS[breakpoint]
      if (!cols || !Array.isArray(layout)) return [breakpoint, layout]

      const visible = layout
        .filter(({ i }) => !hidden.has(i))
        .sort((a, b) => a.y - b.y || a.x - b.x)
      const positions = new Map()
      const rows = []
      let row = []
      let usedColumns = 0

      const finishRow = () => {
        if (!row.length) return
        rows.push({ items: row, usedColumns })
        row = []
        usedColumns = 0
      }

      visible.forEach((item) => {
        const width = Math.min(item.w, cols)
        const candidate = { ...item, w: width }

        if (row.length && usedColumns + width > cols) finishRow()
        row.push(candidate)
        usedColumns += width
      })
      finishRow()

      let y = 0
      rows.forEach(({ items, usedColumns: rowWidth }) => {
        let x = 0
        const remainingColumns = cols - rowWidth

        items.forEach((item, index) => {
          const isLast = index === items.length - 1
          const width = item.w + (isLast ? remainingColumns : 0)
          positions.set(item.i, { ...item, x, y, w: width })
          x += width
        })

        y += Math.max(...items.map(({ h }) => h))
      })

      return [
        breakpoint,
        layout.map((item) => positions.get(item.i) ?? { ...item }),
      ]
    }),
  )
}

export function loadDashboardPreferences() {
  const fallback = {
    version: DASHBOARD_SCHEMA_VERSION,
    layouts: cloneDefaultLayouts(),
    hiddenWidgetIds: [],
    density: 'balanced',
  }

  try {
    const stored = JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY))
    const validIds = new Set(dashboardWidgets.map(({ id }) => id))
    const validLayouts =
      stored?.version === DASHBOARD_SCHEMA_VERSION &&
      stored.layouts &&
      Object.values(stored.layouts).every((layout) =>
        Array.isArray(layout) &&
        layout.every(({ i, x, y, w, h }) =>
          validIds.has(i) && [x, y, w, h].every(Number.isFinite),
        ),
      )
    if (!validLayouts) return fallback

    return {
      version: DASHBOARD_SCHEMA_VERSION,
      layouts: normalizeDashboardLayouts(stored.layouts),
      hiddenWidgetIds: Array.isArray(stored.hiddenWidgetIds)
        ? stored.hiddenWidgetIds.filter((id) => validIds.has(id))
        : [],
      density: ['compact', 'balanced', 'spacious'].includes(stored.density)
        ? stored.density
        : 'balanced',
    }
  } catch {
    return fallback
  }
}
