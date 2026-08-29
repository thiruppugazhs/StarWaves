export type CalendarEventType =
  | 'task'
  | 'contest'
  | 'hackathon'
  | 'project'
  | 'job'
  | 'google-calendar'
  | 'ics-calendar'

export type TaskRecord = {
  id: number
  title: string
  completed: boolean
  dueDate: string
}

export type ContestRecord = {
  id: string
  name: string
  startsAt: string
  duration: string
}

export type ContestSiteRecord = {
  id: string
  name: string
  shortName: string
  contests: ContestRecord[]
}

export type HackathonRecord = {
  id: string
  title: string
  organizer: string
  startsAt: string
  endsAt: string
  mode: string
  teamSize: string
}

export type ProjectRecord = {
  id: string
  name: string
  updatedAt: string
  status: string
  progress: number
}

export type JobRecord = {
  id: string
  company: string
  role: string
  status: string
  appliedDate: string
  interviewDate: string
  deadline: string
}

export type IndexedJobRecord = JobRecord & {
  calendarKind: 'Applied' | 'Interview' | 'Deadline'
}

export type IndexedContestRecord = ContestRecord & {
  siteName: string
  siteShortName: string
}

export type GoogleCalendarRecord = {
  id: string
  googleEventId?: string
  accountEmail?: string
  calendarId: string
  calendarName: string
  calendarColor: string
  title: string
  description: string
  location: string
  htmlLink?: string
  start: string
  end: string
  allDay: boolean
}

export type CalendarEvent = {
  id: string
  type: CalendarEventType
  label: string
  className: string
  source:
    | TaskRecord
    | IndexedContestRecord
    | HackathonRecord
    | ProjectRecord
    | IndexedJobRecord
    | GoogleCalendarRecord
}

type CalendarData = {
  tasks: TaskRecord[]
  contestSites: ContestSiteRecord[]
  hackathons: HackathonRecord[]
  projects: ProjectRecord[]
  jobs: JobRecord[]
  googleCalendarEvents: GoogleCalendarRecord[]
  icsCalendarEvents?: GoogleCalendarRecord[]
  hiddenCalendarIds?: Set<string>
}

export function calendarDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function googleEventDate(value: string, allDay: boolean) {
  if (!value) return new Date()
  if (!allDay) return new Date(value)
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1, 12)
}

export function buildCalendarEventIndex({
  tasks,
  contestSites,
  hackathons,
  projects,
  jobs,
  googleCalendarEvents,
  icsCalendarEvents = [],
  hiddenCalendarIds = new Set(),
}: CalendarData) {
  const index = new Map<string, CalendarEvent[]>()

  const add = (dateKey: string, event: CalendarEvent) => {
    if (!dateKey) return
    const events = index.get(dateKey)
    if (events) events.push(event)
    else index.set(dateKey, [event])
  }

  if (!hiddenCalendarIds.has('tasks')) {
    for (const task of tasks) {
      add(task.dueDate, {
        id: `task-${task.id}`,
        type: 'task',
        label: task.title,
        className: task.completed ? 'completed' : '',
        source: task,
      })
    }
  }

  if (!hiddenCalendarIds.has('contests')) {
    for (const site of contestSites) {
      for (const contest of site.contests) {
        const source: IndexedContestRecord = {
          ...contest,
          siteName: site.name,
          siteShortName: site.shortName,
        }
        add(calendarDateKey(new Date(contest.startsAt)), {
          id: `contest-${contest.id}`,
          type: 'contest',
          label: `${site.shortName} · ${contest.name}`,
          className: 'contest',
          source,
        })
      }
    }
  }

  if (!hiddenCalendarIds.has('hackathons')) {
    for (const hackathon of hackathons) {
      const start = new Date(hackathon.startsAt)
      const endKey = calendarDateKey(new Date(hackathon.endsAt))
      const cursor = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        12,
      )

      while (calendarDateKey(cursor) <= endKey) {
        add(calendarDateKey(cursor), {
          id: `hackathon-${hackathon.id}-${calendarDateKey(cursor)}`,
          type: 'hackathon',
          label: `Hackathon · ${hackathon.title}`,
          className: 'hackathon',
          source: hackathon,
        })
        cursor.setDate(cursor.getDate() + 1)
      }
    }
  }

  if (!hiddenCalendarIds.has('projects')) {
    for (const project of projects) {
      add(calendarDateKey(new Date(project.updatedAt)), {
        id: `project-${project.id}`,
        type: 'project',
        label: `Project · ${project.name}`,
        className: 'project',
        source: project,
      })
    }
  }

  if (!hiddenCalendarIds.has('jobs')) {
    for (const job of jobs) {
      const dates: Array<[IndexedJobRecord['calendarKind'], string]> = [
        ['Applied', job.appliedDate],
        ['Interview', job.interviewDate],
        ['Deadline', job.deadline],
      ]

      for (const [calendarKind, dateKey] of dates) {
        if (!dateKey) continue
        const source: IndexedJobRecord = { ...job, calendarKind }
        add(dateKey, {
          id: `job-${job.id}-${calendarKind.toLowerCase()}`,
          type: 'job',
          label: `${calendarKind} · ${job.company}`,
          className: 'job',
          source,
        })
      }
    }
  }

  for (const event of googleCalendarEvents) {
    if (hiddenCalendarIds.has(event.calendarId)) continue
    const start = googleEventDate(event.start, event.allDay)
    const end = googleEventDate(event.end, event.allDay)
    const cursor = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      12,
    )
    const lastDay = event.allDay
      ? new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1, 12)
      : new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12)

    while (cursor <= lastDay) {
      const dateKey = calendarDateKey(cursor)
      add(dateKey, {
        id: `google-calendar-${event.id}-${dateKey}`,
        type: 'google-calendar',
        label: event.title,
        className: 'google-calendar',
        source: event,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  for (const event of icsCalendarEvents) {
    if (hiddenCalendarIds.has(event.calendarId)) continue
    const start = googleEventDate(event.start, event.allDay)
    const end = googleEventDate(event.end, event.allDay)
    const cursor = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      12,
    )
    const lastDay = event.allDay
      ? new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1, 12)
      : new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12)

    while (cursor <= lastDay) {
      const dateKey = calendarDateKey(cursor)
      add(dateKey, {
        id: `ics-calendar-${event.id}-${dateKey}`,
        type: 'ics-calendar',
        label: event.title,
        className: 'ics-calendar',
        source: event,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return index
}
