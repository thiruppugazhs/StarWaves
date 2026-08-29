import { useEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  GripHorizontal,
  LayoutGrid,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import 'react-grid-layout/css/styles.css'
import {
  DASHBOARD_BREAKPOINTS,
  DASHBOARD_COLS,
  DASHBOARD_SCHEMA_VERSION,
  DASHBOARD_STORAGE_KEY,
  cloneDefaultLayouts,
  compactDashboardLayouts,
  dashboardWidgets,
  loadDashboardPreferences,
} from '../dashboard/dashboardConfig'
import { calendarDateKey } from '../utils/calendarEvents'

const formatDate = (value, options = {}) =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...options,
  })

const calendarEventDestinations = {
  task: 'todo',
  contest: 'competitive-coding',
  hackathon: 'hackathons',
  project: 'projects',
  job: 'jobs',
  'google-calendar': 'calendar',
  'ics-calendar': 'calendar',
}

function RecordList({ items, empty = 'Nothing to show.', onNavigate, onOpenNotifications }) {
  if (!items.length) return <p className="dashboard-widget-empty">{empty}</p>
  return (
    <div className="dashboard-record-list">
      {items.map((entry) => {
        const title = <strong>{entry.title}</strong>
        const openDestination = () => {
          if (entry.notification) {
            onOpenNotifications?.()
            return
          }
          if (entry.destination) onNavigate?.(entry.destination, entry.destinationId)
        }

        return (
          <div className="dashboard-record" key={entry.id}>
            <div>
              {entry.url ? (
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="dashboard-record-title-link"
              >
                {title}
              </a>
              ) : entry.destination || entry.notification ? (
                <button
                  className="dashboard-record-title-link"
                  type="button"
                  onClick={openDestination}
                >
                  {title}
                </button>
              ) : (
                title
              )}
              {entry.meta && <span>{entry.meta}</span>}
            </div>
            {entry.badge && <em>{entry.badge}</em>}
          </div>
        )
      })}
    </div>
  )
}

function WidgetCard({ definition, editing, children, total, onOpen }) {
  const Icon = definition.icon
  return (
    <article className={`dashboard-widget ${editing ? 'is-editing' : ''}`}>
      <header className="dashboard-widget-header dashboard-widget-drag-handle">
        <span className="dashboard-widget-icon"><Icon size={17} /></span>
        <div>
          <p>{definition.title}</p>
          {total != null && <strong>{total}</strong>}
        </div>
        {editing && <GripHorizontal className="dashboard-drag-indicator" size={20} />}
      </header>
      <div className="dashboard-widget-body">{children}</div>
      <button className="dashboard-widget-action" type="button" onClick={onOpen}>
        View details <ArrowUpRight size={15} />
      </button>
    </article>
  )
}

export function DashboardPage({
  tasks,
  projects,
  jobs,
  documents,
  contestSites,
  hackathons,
  notifications,
  calendarEventIndex,
  onNavigate,
  onCreate,
  onOpenNotifications,
}) {
  const initial = useMemo(() => {
    const preferences = loadDashboardPreferences()
    return {
      ...preferences,
      layouts: compactDashboardLayouts(
        preferences.layouts,
        preferences.hiddenWidgetIds,
      ),
    }
  }, [])
  const [layouts, setLayouts] = useState(initial.layouts)
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState(initial.hiddenWidgetIds)
  const [density, setDensity] = useState(initial.density)
  const [editing, setEditing] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const createRef = useRef(null)
  const { width, containerRef, mounted } = useContainerWidth()

  const todayKey = calendarDateKey(new Date())
  const todayEvents = calendarEventIndex.get(todayKey) ?? []
  const upcomingEvents = useMemo(
    () =>
      [...calendarEventIndex.entries()]
        .filter(([date]) => date >= todayKey)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([date, events]) =>
          events.map((event) => ({
            id: `${date}-${event.id}`,
            title: event.label,
            meta: formatDate(`${date}T12:00:00`),
            badge: event.type,
          })),
        ),
    [calendarEventIndex, todayKey],
  )
  const contests = useMemo(
    () =>
      contestSites
        .flatMap((site) =>
          site.contests.map((contest) => ({ ...contest, site: site.name })),
        )
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
    [contestSites],
  )
  const visibleWidgets = dashboardWidgets.filter(
    ({ id }) => !hiddenWidgetIds.includes(id),
  )

  useEffect(() => {
    localStorage.setItem(
      DASHBOARD_STORAGE_KEY,
      JSON.stringify({
        version: DASHBOARD_SCHEMA_VERSION,
        layouts,
        hiddenWidgetIds,
        density,
      }),
    )
  }, [layouts, hiddenWidgetIds, density])

  useEffect(() => {
    const closeMenu = (event) => {
      if (!createRef.current?.contains(event.target)) setCreateOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('dashboard-layout-editing', editing)
    return () => document.body.classList.remove('dashboard-layout-editing')
  }, [editing])

  const toggleWidget = (id) => {
    const nextHiddenWidgetIds = hiddenWidgetIds.includes(id)
      ? hiddenWidgetIds.filter((widgetId) => widgetId !== id)
      : [...hiddenWidgetIds, id]

    setHiddenWidgetIds(nextHiddenWidgetIds)
    setLayouts((current) =>
      compactDashboardLayouts(current, nextHiddenWidgetIds),
    )
  }

  const resetDashboard = () => {
    setLayouts(cloneDefaultLayouts())
    setHiddenWidgetIds([])
    setDensity('balanced')
  }

  const createAction = (type) => {
    setCreateOpen(false)
    if (type === 'calendar') onNavigate('calendar')
    else onCreate(type)
  }

  const saveGridLayouts = (nextLayouts) => {
    setLayouts((currentLayouts) =>
      Object.fromEntries(
        Object.entries({ ...currentLayouts, ...nextLayouts }).map(
          ([breakpoint, nextLayout]) => {
            const nextIds = new Set(nextLayout.map(({ i }) => i))
            const missingEntries = (currentLayouts[breakpoint] ?? []).filter(
              ({ i }) => !nextIds.has(i),
            )
            return [breakpoint, [...nextLayout, ...missingEntries]]
          },
        ),
      ),
    )
  }

  const widgetContent = {
    today: {
      total: todayEvents.length,
      body: <RecordList items={todayEvents.slice(0, 3).map((event) => ({
        id: event.id,
        title: event.label,
        badge: event.type,
        destination: calendarEventDestinations[event.type] ?? 'calendar',
      }))} empty="Your day is clear." onNavigate={onNavigate} />,
    },
    todo: {
      total: tasks.filter((task) => !task.completed).length,
      body: <RecordList items={tasks.filter((task) => !task.completed).slice(0, 3).map((task) => ({
        id: task.id,
        title: task.title,
        meta: task.dueDate ? formatDate(`${task.dueDate}T12:00:00`) : 'No due date',
        destination: 'todo',
      }))} empty="All tasks complete." onNavigate={onNavigate} />,
    },
    calendar: {
      total: upcomingEvents.length,
      body: <RecordList items={upcomingEvents.slice(0, 3).map((event) => ({
        ...event,
        destination: calendarEventDestinations[event.badge] ?? 'calendar',
      }))} empty="No upcoming events." onNavigate={onNavigate} />,
    },
    'competitive-coding': {
      total: contests.length,
      body: <RecordList items={contests.slice(0, 3).map((contest) => ({
        id: contest.id,
        title: contest.name,
        meta: contest.site,
        badge: formatDate(contest.startsAt),
        destination: 'competitive-coding',
      }))} onNavigate={onNavigate} />,
    },
    hackathons: {
      total: hackathons.length,
      body: <RecordList items={hackathons.slice(0, 3).map((hackathon) => ({
        id: hackathon.id,
        title: hackathon.title,
        meta: hackathon.organizer,
        badge: formatDate(hackathon.startsAt),
        destination: 'hackathon-detail',
        destinationId: hackathon.id,
      }))} onNavigate={onNavigate} />,
    },
    projects: {
      total: projects.length,
      body: projects.length ? (
        <div className="dashboard-project-list">
          {projects.slice(0, 3).map((project) => (
            <div key={project.id} className="dashboard-project-item">
              <div className="dashboard-project-info">
                <button
                  className="dashboard-project-name"
                  type="button"
                  onClick={() => onNavigate('project-detail', project.id)}
                >
                  <strong>{project.name}</strong>
                </button>
                <span className="dashboard-project-percent">{project.progress}%</span>
              </div>
              <div className="dashboard-project-bar-track">
                <div
                  className="dashboard-project-bar-fill"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-widget-empty">No active projects.</p>
      ),
    },
    jobs: {
      total: jobs.length,
      body: <RecordList items={jobs.slice(0, 3).map((job) => ({
        id: job.id,
        title: job.role,
        meta: job.company,
        badge: job.status,
        destination: 'jobs',
      }))} onNavigate={onNavigate} />,
    },
    documents: {
      total: documents.length,
      body: <RecordList items={[...documents].sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt)).slice(0, 3).map((document) => ({
        id: document.id,
        title: document.name,
        meta: `${document.type} · ${document.size}`,
        badge: formatDate(document.modifiedAt),
        destination: 'documents',
      }))} onNavigate={onNavigate} />,
    },
    notifications: {
      total: notifications.filter((notification) => notification.unread).length,
      body: <RecordList items={notifications.slice(0, 3).map((notification) => ({
        id: notification.id,
        title: notification.title,
        meta: notification.time,
        badge: notification.unread ? 'new' : '',
        notification: true,
      }))} empty="You're all caught up." onOpenNotifications={onOpenNotifications} />,
    },
  }

  return (
    <div className={`dashboard-page dashboard-density-${density}`}>
      <div className="page-heading dashboard-heading">
        <div><p>Overview</p><h1>Dashboard</h1></div>
        <div className="dashboard-heading-actions">
          {editing && <span className="dashboard-edit-status"><LayoutGrid size={15} /> Editing layout</span>}
          <button className="secondary-button" type="button" onClick={() => setCustomizeOpen(true)}>
            <SlidersHorizontal size={16} /> Customize
          </button>
          <div className="dashboard-create" ref={createRef}>
            <button className="primary-button" type="button" onClick={() => setCreateOpen((open) => !open)}>
              <Plus size={17} /> Create new <ChevronDown size={15} />
            </button>
            {createOpen && (
              <div className="dashboard-create-menu">
                <button onClick={() => createAction('todo')}>Add Todo</button>
                <button onClick={() => createAction('job')}>Add Job</button>
                <button onClick={() => createAction('document')}>Upload Document</button>
                <button onClick={() => createAction('calendar')}>Open Calendar</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-grid-shell" ref={containerRef}>
        {mounted && (
          <ResponsiveGridLayout
            width={width}
            layouts={layouts}
            breakpoints={DASHBOARD_BREAKPOINTS}
            cols={DASHBOARD_COLS}
            rowHeight={34}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            gridConfig={{ allowOverlap: false, preventCollision: true }}
            dragConfig={{ enabled: editing, handle: '.dashboard-widget-drag-handle', cancel: 'button,a', threshold: 4 }}
            resizeConfig={{ enabled: editing, handles: ['se', 's', 'e'] }}
            onLayoutChange={(_, nextLayouts) => saveGridLayouts(nextLayouts)}
          >
            {visibleWidgets.map((definition) => (
              <div key={definition.id}>
                <WidgetCard
                  definition={definition}
                  editing={editing}
                  total={widgetContent[definition.id].total}
                  onOpen={() =>
                    definition.id === 'notifications'
                      ? onOpenNotifications()
                      : onNavigate(definition.destination)
                  }
                >
                  {widgetContent[definition.id].body}
                </WidgetCard>
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {customizeOpen && (
        <div className="dashboard-panel-backdrop" onMouseDown={() => setCustomizeOpen(false)} role="presentation">
          <aside className="dashboard-customize-panel" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><p>Dashboard</p><h2>Customize</h2></div><button className="icon-button" onClick={() => setCustomizeOpen(false)} aria-label="Close customize panel"><X size={19} /></button></header>
            <section>
              <h3>Layout editing</h3>
              <button className={`dashboard-edit-toggle ${editing ? 'active' : ''}`} onClick={() => setEditing((value) => !value)}>
                <span className="edit-status">
                  <span className="status-dot" />
                  {editing ? 'Editing enabled' : 'Editing disabled'}
                </span>
                <span className="edit-action">{editing ? 'Done' : 'Edit layout'}</span>
              </button>
              <p className="dashboard-help">Drag cards by their headers and resize from the highlighted edges.</p>
            </section>
            <section>
              <h3>Widget visibility</h3>
              <div className="dashboard-widget-toggles">
                {dashboardWidgets.map(({ id, title, icon: Icon }) => {
                  const visible = !hiddenWidgetIds.includes(id)
                  return <button key={id} onClick={() => toggleWidget(id)} className={visible ? 'visible' : ''}><Icon size={16} /><span>{title}</span><i>{visible && <Check size={14} />}</i></button>
                })}
              </div>
            </section>
            <section>
              <h3>Density</h3>
              <div className="dashboard-density-options">
                {['compact', 'balanced', 'spacious'].map((option) => <button key={option} className={density === option ? 'active' : ''} onClick={() => setDensity(option)}>{option}</button>)}
              </div>
            </section>
            <button className="dashboard-reset" onClick={resetDashboard}><RotateCcw size={16} /> Reset default layout</button>
          </aside>
        </div>
      )}
    </div>
  )
}
