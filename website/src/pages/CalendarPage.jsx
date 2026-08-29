import { useEffect, useMemo, useState } from 'react'
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  FolderKanban,
  ExternalLink,
  MapPin,
  Rocket,
  X,
} from 'lucide-react'
import { calendarDateKey } from '../utils/calendarEvents'
import { CalendarPicker, Pagination } from '../components/ui'
import { usePersistentState } from '../hooks/usePersistentState'
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildCalendarDays(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const gridStart = new Date(year, month, 1 - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)
    return {
      date: day,
      isCurrentMonth: day.getMonth() === month,
    }
  })
}

function isSameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

export function CalendarPage({ eventsByDate, onNavigate }) {
  const today = useMemo(() => new Date(), [])
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [selectedDate, setSelectedDate] = useState(null)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [calendarView, setCalendarView] = usePersistentState('starwaves.calendar.view', 'days')
  const [pickerDate, setPickerDate] = useState(null)
  const [focusedEventId, setFocusedEventId] = useState(null)
  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth])
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => ({
        value: month,
        label: new Date(2024, month, 1).toLocaleDateString(undefined, {
          month: 'long',
        }),
      })),
    [],
  )
  const selectedEvents = selectedDate
    ? eventsByDate.get(calendarDateKey(selectedDate)) ?? []
    : []

  useEffect(() => {
    const rawFocus = localStorage.getItem('starwaves.calendar-focus')
    if (!rawFocus) return

    try {
      const focus = JSON.parse(rawFocus)
      const focusDate = new Date(`${focus.dateKey}T00:00:00`)
      if (Number.isNaN(focusDate.getTime())) return
      setVisibleMonth(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1))
      setSelectedDate(focusDate)
      setFocusedEventId(focus.targetId)
      localStorage.removeItem('starwaves.calendar-focus')
    } catch {
      localStorage.removeItem('starwaves.calendar-focus')
    }
  }, [])

  useEffect(() => {
    if (!focusedEventId) return
    const target = document.querySelector(`[data-record-id="${CSS.escape(focusedEventId)}"]`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('notification-target-highlight')
    const timer = window.setTimeout(() => target.classList.remove('notification-target-highlight'), 1600)
    return () => window.clearTimeout(timer)
  }, [focusedEventId, selectedDate])
  const selectedTasks = selectedEvents
    .filter((event) => event.type === 'task')
    .map((event) => event.source)
  const selectedContests = selectedEvents
    .filter((event) => event.type === 'contest')
    .map((event) => event.source)
  const selectedHackathons = selectedEvents
    .filter((event) => event.type === 'hackathon')
    .map((event) => event.source)
  const selectedProjects = selectedEvents
    .filter((event) => event.type === 'project')
    .map((event) => event.source)
  const selectedJobs = selectedEvents
    .filter((event) => event.type === 'job')
    .map((event) => event.source)
  const selectedGoogleEvents = selectedEvents
    .filter((event) => event.type === 'google-calendar')
    .map((event) => event.source)
  const navigateFromKey = (event, page) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onNavigate(page)
    }
  }
  const yearBlockStart = Math.floor(visibleMonth.getFullYear() / 12) * 12
  const calendarTitle =
    calendarView === 'days'
      ? visibleMonth.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
      : calendarView === 'months'
        ? String(visibleMonth.getFullYear())
        : `${yearBlockStart} – ${yearBlockStart + 11}`

  const changeMonth = (offset) => {
    setVisibleMonth((current) => {
      if (calendarView === 'months') {
        return new Date(current.getFullYear() + offset, current.getMonth(), 1)
      }
      if (calendarView === 'years') {
        return new Date(current.getFullYear() + offset * 12, current.getMonth(), 1)
      }
      return new Date(current.getFullYear(), current.getMonth() + offset, 1)
    })
  }

  const selectView = (view) => {
    setCalendarView(view)
    setViewMenuOpen(false)
  }

  return (
    <section className="calendar-page">
      <div className="calendar-toolbar">
        <div>
          <p className="calendar-eyebrow">Calendar</p>
          <h1>{calendarTitle}</h1>
        </div>

        <div className="calendar-actions">
          <CalendarPicker
            value={pickerDate}
            onChange={(date) => {
              setPickerDate(date)
              if (date) {
                setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1))
                setCalendarView('days')
              }
            }}
          />
          <div className="calendar-view-switcher">
            <button
              className="calendar-view-button"
              onClick={() => setViewMenuOpen((open) => !open)}
              aria-expanded={viewMenuOpen}
            >
              {calendarView[0].toUpperCase() + calendarView.slice(1)}
              <ChevronDown
                className={viewMenuOpen ? 'chevron-open' : ''}
                size={14}
              />
            </button>
            {viewMenuOpen && (
              <div className="calendar-view-menu">
                {[
                  ['days', 'Days', 'Full monthly calendar'],
                  ['months', 'Months', 'All months in the year'],
                  ['years', 'Years', 'Quick year navigation'],
                ].map(([value, label, description]) => (
                  <button
                    className={calendarView === value ? 'active' : ''}
                    key={value}
                    onClick={() => selectView(value)}
                  >
                    <span>{label}</span>
                    <small>{description}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Pagination
            className="calendar-pagination"
            ariaLabel="Calendar navigation"
            onPrev={() => changeMonth(-1)}
            onNext={() => changeMonth(1)}
          />
          <span className="calendar-readonly-note">Events are managed by their source calendars</span>
        </div>
      </div>

      {calendarView === 'days' && (
        <>
        <div className="calendar-grid">
        {weekDays.map((day) => (
          <div className="calendar-weekday" key={day}>
            {day}
          </div>
        ))}

        {days.map(({ date, isCurrentMonth }) => {
          const isToday = isSameDay(date, today)
          const dayItems = eventsByDate.get(calendarDateKey(date)) ?? []

          return (
            <button
              className={`calendar-day ${isCurrentMonth ? '' : 'outside-month'} ${
                isToday ? 'today' : ''
              }`}
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              aria-label={date.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            >
              <span>{date.getDate()}</span>
              <div className="calendar-events">
                {dayItems.slice(0, 2).map((item) => (
                  <div
                    className={`calendar-event ${item.className}`}
                    key={item.id}
                    title={item.label}
                  >
                    {item.label}
                  </div>
                ))}
                {dayItems.length > 2 && (
                  <small>+{dayItems.length - 2} more</small>
                )}
              </div>
            </button>
          )
        })}
        </div>
        <div className="calendar-mobile-agenda" aria-label="Monthly agenda">
          {days
            .filter(({ date, isCurrentMonth }) =>
              isCurrentMonth && (eventsByDate.get(calendarDateKey(date))?.length ?? 0) > 0,
            )
            .map(({ date }) => {
              const dayItems = eventsByDate.get(calendarDateKey(date)) ?? []
              return (
                <button
                  type="button"
                  className="calendar-agenda-day"
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                >
                  <span>
                    <strong>{date.getDate()}</strong>
                    <small>{date.toLocaleDateString(undefined, { month: 'short', weekday: 'short' })}</small>
                  </span>
                  <span>
                    {dayItems.slice(0, 3).map((item) => (
                      <small key={item.id}>{item.label}</small>
                    ))}
                    {dayItems.length > 3 && <small>+{dayItems.length - 3} more</small>}
                  </span>
                </button>
              )
            })}
          {!(days || []).some(({ date, isCurrentMonth }) =>
            isCurrentMonth && (eventsByDate.get(calendarDateKey(date))?.length ?? 0) > 0,
          ) && (
            <div className="calendar-agenda-empty">
              <CalendarDays size={22} />
              <strong>No activity this month</strong>
              <span>Tasks, events, contests, and deadlines will appear here.</span>
            </div>
          )}
        </div>
        </>
      )}

      {calendarView === 'months' && (
        <div className="calendar-months-grid">
          {months.map((month) => {
            const year = visibleMonth.getFullYear()
            const firstWeekday = new Date(year, month.value, 1).getDay()
            const numberOfDays = new Date(year, month.value + 1, 0).getDate()

            return (
              <button
                className={`calendar-month-card ${
                  today.getFullYear() === year &&
                  today.getMonth() === month.value
                    ? 'current'
                    : ''
                }`}
                key={month.value}
                onClick={() => {
                  setVisibleMonth(new Date(year, month.value, 1))
                  setCalendarView('days')
                }}
              >
                <strong>{month.label}</strong>
                <div className="mini-calendar-weekdays">
                  {weekDays.map((day) => (
                    <span key={day}>{day[0]}</span>
                  ))}
                </div>
                <div className="mini-calendar-days">
                  {Array.from({ length: firstWeekday }, (_, index) => (
                    <span key={`blank-${index}`} />
                  ))}
                  {Array.from({ length: numberOfDays }, (_, index) => {
                    const day = index + 1
                    const isToday =
                      today.getFullYear() === year &&
                      today.getMonth() === month.value &&
                      today.getDate() === day
                    return (
                      <span className={isToday ? 'today' : ''} key={day}>
                        {day}
                      </span>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {calendarView === 'years' && (
        <div className="calendar-years-grid">
          {Array.from({ length: 12 }, (_, index) => yearBlockStart + index).map(
            (year) => (
              <button
                className={today.getFullYear() === year ? 'current' : ''}
                key={year}
                onClick={() => {
                  setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1))
                  setCalendarView('months')
                }}
              >
                <span>{year}</span>
                {today.getFullYear() === year && <small>Current year</small>}
              </button>
            ),
          )}
        </div>
      )}

      {selectedDate && (
        <div
          className="calendar-detail-backdrop"
          onMouseDown={() => setSelectedDate(null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setSelectedDate(null)
          }}
          role="presentation"
        >
          <aside
            className="calendar-detail-panel"
            aria-label="Day details"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="calendar-detail-header">
              <div className="calendar-detail-date">
                <div className="calendar-detail-date-icon">
                  <span>
                    {selectedDate.toLocaleDateString(undefined, {
                      month: 'short',
                    })}
                  </span>
                  <strong>{selectedDate.getDate()}</strong>
                </div>
                <div>
                  <p>Day overview</p>
                  <h2>
                    {selectedDate.toLocaleDateString(undefined, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </h2>
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setSelectedDate(null)}
                aria-label="Close day details"
                autoFocus
              >
                <X size={19} />
              </button>
            </div>

            <div className="calendar-detail-body">
              <div className="calendar-detail-section-title">
                <span>Tasks</span>
                <small>{selectedTasks.length}</small>
              </div>

              {selectedTasks.length ? (
                <div className="calendar-detail-tasks">
                  {selectedTasks.map((task) => (
                    <div
                      className={`calendar-detail-task ${
                        task.completed ? 'completed' : ''
                      }`}
                      key={task.id}
                      data-record-id={task.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => onNavigate('todo')}
                      onKeyDown={(event) => navigateFromKey(event, 'todo')}
                    >
                      {task.completed ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <Circle size={18} />
                      )}
                      <div>
                        <strong>{task.title}</strong>
                        <span>{task.completed ? 'Completed' : 'To do'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={`calendar-detail-empty ${
                    selectedContests.length ||
                    selectedHackathons.length ||
                    selectedProjects.length ||
                    selectedJobs.length ||
                    selectedGoogleEvents.length
                      ? 'compact'
                      : ''
                  }`}
                >
                  <CalendarDays size={22} />
                  <h3>No tasks for this day</h3>
                  <p>Dated todo items will appear here.</p>
                </div>
              )}

              <div className="calendar-detail-section-title contest-section-title">
                <span>Contests</span>
                <small>{selectedContests.length}</small>
              </div>

              {selectedContests.length ? (
                <div className="calendar-detail-contests">
                  {selectedContests.map((contest) => {
                    const startDate = new Date(contest.startsAt)

                    return (
                      <div
                        className="calendar-detail-contest"
                        key={contest.id}
                        data-record-id={contest.id}
                        role="link"
                        tabIndex={0}
                        onClick={() => onNavigate('competitive-coding')}
                        onKeyDown={(event) =>
                          navigateFromKey(event, 'competitive-coding')
                        }
                      >
                        <div className="calendar-detail-contest-logo">
                          {contest.siteShortName}
                        </div>
                        <div>
                          <strong>{contest.name}</strong>
                          <div className="calendar-detail-meta">
                            <Clock3 size={12} />
                            <span>
                              {startDate.toLocaleTimeString(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="dot-sep">·</span>
                            <span>{contest.duration}</span>
                            <span className="dot-sep">·</span>
                            <span>{contest.siteName}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="calendar-detail-no-contests">
                  No contests scheduled.
                </div>
              )}

              <div className="calendar-detail-section-title contest-section-title">
                <span>Hackathons</span>
                <small>{selectedHackathons.length}</small>
              </div>

              {selectedHackathons.length ? (
                <div className="calendar-detail-records">
                  {selectedHackathons.map((hackathon) => (
                    <div
                      className="calendar-detail-record"
                      key={hackathon.id}
                      data-record-id={hackathon.id}
                      role="link"
                      tabIndex={0}
                        onClick={() => {
                          onNavigate('hackathon-detail', hackathon.id)
                        }}
                        onKeyDown={(event) =>
                          (() => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            onNavigate('hackathon-detail', hackathon.id)
                          })()
                        }
                    >
                      <div className="calendar-detail-record-icon">
                        <Rocket size={16} />
                      </div>
                      <div>
                        <strong>{hackathon.title}</strong>
                        <div className="calendar-detail-meta">
                          <span>{hackathon.mode}</span>
                          <span className="dot-sep">·</span>
                          <span>{hackathon.teamSize}</span>
                          <span className="dot-sep">·</span>
                          <span>{hackathon.organizer}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="calendar-detail-no-contests">
                  No hackathons active.
                </div>
              )}

              <div className="calendar-detail-section-title contest-section-title">
                <span>Project updates</span>
                <small>{selectedProjects.length}</small>
              </div>

              {selectedProjects.length ? (
                <div className="calendar-detail-records">
                  {selectedProjects.map((project) => (
                    <div
                      className="calendar-detail-record"
                      key={project.id}
                      data-record-id={project.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => onNavigate('projects')}
                      onKeyDown={(event) => navigateFromKey(event, 'projects')}
                    >
                      <div className="calendar-detail-record-icon">
                        <FolderKanban size={16} />
                      </div>
                      <div>
                        <strong>{project.name}</strong>
                        <div className="calendar-detail-meta">
                          <span>{project.status}</span>
                          <span className="dot-sep">·</span>
                          <span>{project.progress}% complete</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="calendar-detail-no-contests">
                  No project updates.
                </div>
              )}

              <div className="calendar-detail-section-title contest-section-title">
                <span>Jobs</span>
                <small>{selectedJobs.length}</small>
              </div>

              {selectedJobs.length ? (
                <div className="calendar-detail-records">
                  {selectedJobs.map((job) => (
                    <div
                      className="calendar-detail-record"
                      key={`${job.id}-${job.calendarKind}`}
                      data-record-id={job.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => onNavigate('jobs')}
                      onKeyDown={(event) => navigateFromKey(event, 'jobs')}
                    >
                      <div className="calendar-detail-record-icon">
                        <BriefcaseBusiness size={16} />
                      </div>
                      <div>
                        <strong>
                          {job.role} · {job.company}
                        </strong>
                        <div className="calendar-detail-meta">
                          <span>{job.calendarKind}</span>
                          <span className="dot-sep">·</span>
                          <span>{job.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="calendar-detail-no-contests">
                  No job activity.
                </div>
              )}

              <div className="calendar-detail-section-title contest-section-title">
                <span>Google Calendar</span>
                <small>{selectedGoogleEvents.length}</small>
              </div>

              {selectedGoogleEvents.length ? (
                <div className="calendar-detail-records">
                  {selectedGoogleEvents.map((event) => {
                    const timeLabel = event.allDay
                      ? 'All day'
                      : new Date(event.start).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })

                    const showCalendarName =
                      event.calendarName && event.calendarName !== event.accountEmail

                    return (
                      <div className="calendar-detail-record" key={event.id} data-record-id={event.id}>
                        <div className="calendar-detail-record-icon google-calendar-icon">
                          <CalendarDays size={16} />
                        </div>
                        <div>
                          <strong>{event.title}</strong>
                          <div className="calendar-detail-meta">
                            <span>{timeLabel}</span>
                            {showCalendarName && (
                              <>
                                <span className="dot-sep">·</span>
                                <span>{event.calendarName}</span>
                              </>
                            )}
                            {event.accountEmail && (
                              <>
                                <span className="dot-sep">·</span>
                                <span>{event.accountEmail}</span>
                              </>
                            )}
                          </div>
                          {event.location && (
                            <div className="calendar-detail-meta" style={{ marginTop: '2px' }}>
                              <MapPin size={11} />
                              <span>{event.location}</span>
                            </div>
                          )}
                        </div>
                        {event.htmlLink && (
                          <a
                            className="google-calendar-event-link"
                            href={event.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${event.title} in Google Calendar`}
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="calendar-detail-no-contests">
                  No Google Calendar events.
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}
