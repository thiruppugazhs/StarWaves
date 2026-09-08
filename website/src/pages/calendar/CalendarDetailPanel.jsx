import '../../styles/pages/calendar-detail.css'
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  FolderKanban,
  MapPin,
  Rocket,
  X,
} from 'lucide-react'
import { calendarDateKey } from '../../utils/calendarEvents'
import { navigateFromKey } from './calendarUtils'

export function CalendarDetailPanel({ selectedDate, eventsByDate, onClose, onNavigate }) {
  const selectedEvents = selectedDate
    ? eventsByDate.get(calendarDateKey(selectedDate)) ?? []
    : []
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

  return (
    <div
      className="calendar-detail-backdrop"
      onMouseDown={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
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
            onClick={onClose}
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
                  onKeyDown={(event) => navigateFromKey(event, 'todo', onNavigate)}
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
            <div className="calendar-detail-no-tasks">
              <strong>No todo created.</strong>
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
                    onClick={() => onNavigate('compete')}
                    onKeyDown={(event) =>
                      navigateFromKey(event, 'compete', onNavigate)
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
                  onKeyDown={(event) => navigateFromKey(event, 'projects', onNavigate)}
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
                  onKeyDown={(event) => navigateFromKey(event, 'jobs', onNavigate)}
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
                        <div className="calendar-detail-meta calendar-detail-meta--spaced">
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
  )
}
