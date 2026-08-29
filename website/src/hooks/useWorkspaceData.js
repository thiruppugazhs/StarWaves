import { useEffect, useMemo, useState } from 'react'
import { loadDocuments } from '../lib/documentsApi'
import { loadPlatformCodingStats } from '../lib/codingStatsApi'
import { loadGithubData } from '../lib/githubApi'
import { loadTodos } from '../lib/todosApi'
import { loadGoogleCalendarData } from '../lib/googleCalendar'
import { usePersistentState } from './usePersistentState'
import { autoPromptNotificationPermission, notify } from '../utils/browserNotifications'
import {
  loadContests,
  loadHackathons,
  loadJobs,
  loadNotifications,
  loadProjects,
} from '../lib/workspaceApi'
import { buildCalendarEventIndex } from '../utils/calendarEvents'
import {
  buildCalendarReminders,
  CALENDAR_REMINDER_PREFIX,
} from '../utils/calendarReminders'

export function useWorkspaceData(currentUser, activePage, refreshKey = 0) {
  const [projects, setProjects] = useState([])
  const [jobs, setJobs] = useState([])
  const [documents, setDocuments] = useState([])
  const [codingStats, setCodingStats] = useState(() => ({
    codeforces: {},
    codechef: {},
    leetcode: {},
    github: {},
  }))
  const [tasks, setTasks] = useState([])
  const [notifications, setNotifications] = useState([])
  const [contestSites, setContestSites] = useState([])
  const [hackathons, setHackathons] = useState([])
  const [pagination, setPagination] = useState({ jobs: {}, projects: {}, hackathons: {}, notifications: {}, contests: {} })
  const [loadingMore, setLoadingMore] = useState(false)
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([])
  const [importedIcsCalendars, setImportedIcsCalendars] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('starwaves-imported-calendars') ?? '[]')
    } catch {
      return []
    }
  })
  const [importedIcsEvents, setImportedIcsEvents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('starwaves-imported-events') ?? '[]')
    } catch {
      return []
    }
  })
  const [firedReminderIds, setFiredReminderIds] = usePersistentState(
    'starwaves.fired_reminders',
    [],
  )

  useEffect(() => {
    try {
      localStorage.setItem('starwaves-imported-calendars', JSON.stringify(importedIcsCalendars))
    } catch {
      // ignore
    }
  }, [importedIcsCalendars])

  useEffect(() => {
    if (currentUser) {
      autoPromptNotificationPermission()
    }
  }, [currentUser])

  useEffect(() => {
    try {
      localStorage.setItem('starwaves-imported-events', JSON.stringify(importedIcsEvents))
    } catch {
      // ignore
    }
  }, [importedIcsEvents])

  const calendarEventIndex = useMemo(
    () =>
      buildCalendarEventIndex({
        tasks,
        contestSites,
        hackathons,
        projects,
        jobs,
        googleCalendarEvents,
        icsCalendarEvents: importedIcsEvents,
      }),
    [tasks, contestSites, hackathons, projects, jobs, googleCalendarEvents, importedIcsEvents],
  )

  // Calendar Reminder Sync
  useEffect(() => {
    let timer

    const syncReminders = () => {
      if (document.hidden) return
      const generated = buildCalendarReminders(calendarEventIndex)
      const activeReminderIds = new Set(generated.map((reminder) => reminder.id))
      const newHourlyReminders = generated.filter(
        (reminder) =>
          reminder.id.endsWith('-1-hour') && !firedReminderIds.includes(reminder.id),
      )
      if (newHourlyReminders.length > 0) {
        newHourlyReminders.forEach((reminder) =>
          notify(reminder.title, `${reminder.message} (${reminder.time})`, reminder.id),
        )
        setFiredReminderIds((current) => [
          ...new Set([
            ...current.filter((id) => activeReminderIds.has(id)),
            ...newHourlyReminders.map((reminder) => reminder.id),
          ]),
        ])
      }
      setNotifications((current) => {
        const existingById = new Map(
          current.map((notification) => [notification.id, notification]),
        )
        const saved = current.filter(
          ({ id }) => !id.startsWith(CALENDAR_REMINDER_PREFIX),
        )
        const reminders = generated.map((notification) => ({
          ...notification,
          unread: existingById.get(notification.id)?.unread ?? true,
        }))
        return [...reminders, ...saved]
      })
    }

    syncReminders()
    const startTimer = () => {
      if (!document.hidden && !timer) timer = window.setInterval(syncReminders, 60 * 1000)
    }
    const stopTimer = () => {
      if (timer) {
        window.clearInterval(timer)
        timer = undefined
      }
    }
    const handleVisibilityChange = () => {
      if (document.hidden) stopTimer()
      else {
        syncReminders()
        startTimer()
      }
    }

    startTimer()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      stopTimer()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [calendarEventIndex, firedReminderIds, setFiredReminderIds])

  // Google Calendar & Documents Fetch
  useEffect(() => {
    let active = true
    if (!currentUser) {
      setDocuments([])
      setGoogleCalendarEvents([])
      return () => {
        active = false
      }
    }
    loadGoogleCalendarData()
      .then(({ events }) => {
        if (active) setGoogleCalendarEvents(events)
      })
      .catch((error) => {
        console.error('Could not load Google Calendar:', error)
        if (active) setGoogleCalendarEvents([])
      })
    loadDocuments()
      .then((savedDocuments) => {
        if (active) setDocuments(savedDocuments)
      })
      .catch((error) => {
        console.error('Could not load documents:', error)
        if (active) setDocuments([])
      })
    return () => {
      active = false
    }
  }, [currentUser, refreshKey])

  // Core Workspace Data Fetch
  useEffect(() => {
    let active = true
    if (!currentUser) {
      setJobs([])
      setHackathons([])
      setNotifications([])
      setContestSites([])
      return () => {
        active = false
      }
    }
    Promise.allSettled([
      loadJobs(),
      loadHackathons(),
      loadNotifications(),
      loadContests(),
      loadProjects(),
    ]).then(
      ([
        jobsResult,
        hackathonsResult,
        notificationsResult,
        contestsResult,
        projectsResult,
      ]) => {
        if (!active) return
        const jobsPage = jobsResult.status === 'fulfilled' ? jobsResult.value : { items: [] }
        const projectsPage = projectsResult.status === 'fulfilled' ? projectsResult.value : { items: [] }
        const hackathonsPage = hackathonsResult.status === 'fulfilled' ? hackathonsResult.value : { items: [] }
        const notificationsPage = notificationsResult.status === 'fulfilled' ? notificationsResult.value : { items: [] }
        setJobs(jobsPage.items)
        setPagination({
          jobs: jobsPage,
          projects: projectsPage,
          hackathons: hackathonsPage,
          notifications: notificationsPage,
          contests: contestsResult.status === 'fulfilled' ? contestsResult.value : {},
        })
        setHackathons(
          hackathonsPage.items,
        )
        setNotifications(
          notificationsPage.items,
        )
        const enabledPlatforms = (() => {
          try {
            return JSON.parse(
              localStorage.getItem('starwaves-enabled-contest-platforms') ??
                '["codeforces","codechef","leetcode"]',
            )
          } catch {
            return ['codeforces', 'codechef', 'leetcode']
          }
        })()
        const rawContestItems = contestsResult.status === 'fulfilled' ? contestsResult.value.items : []
        const rawContestSites = rawContestItems.reduce((sites, contest) => {
          const id = contest.platformId || 'contests'
          const site = sites.find((item) => item.id === id)
          if (site) site.contests.push(contest)
          else sites.push({ id, name: id, shortName: id.slice(0, 2).toUpperCase(), description: 'Upcoming contests.', contests: [contest] })
          return sites
        }, [])
        setContestSites(
          rawContestSites.filter((site) => enabledPlatforms.includes(site.id)),
        )
        setProjects((current) => [
          ...projectsPage.items,
          ...current.filter((project) => project.source === 'github'),
        ])
      },
    )
    return () => {
      active = false
    }
  }, [currentUser, refreshKey])

  const loadMore = async (type) => {
    const page = pagination[type]
    if (!page?.has_more || loadingMore) return
    setLoadingMore(true)
    try {
      const loaders = { jobs: loadJobs, projects: loadProjects, hackathons: loadHackathons, notifications: loadNotifications, contests: loadContests }
      const next = await loaders[type](page.next_cursor)
      setPagination((current) => ({ ...current, [type]: next }))
      if (type === 'jobs') setJobs((current) => [...current, ...next.items])
      if (type === 'projects') setProjects((current) => [...current.filter((item) => item.source === 'github'), ...next.items])
      if (type === 'hackathons') setHackathons((current) => [...current, ...next.items])
      if (type === 'notifications') setNotifications((current) => [...current, ...next.items])
      if (type === 'contests') setContestSites((current) => {
        const result = current.map((site) => ({ ...site, contests: [...site.contests] }))
        next.items.forEach((contest) => {
          const site = result.find((item) => item.id === contest.platformId)
          if (site) site.contests.push(contest)
          else result.push({ id: contest.platformId, name: contest.platformId, shortName: contest.platformId.slice(0, 2).toUpperCase(), description: 'Upcoming contests.', contests: [contest] })
        })
        return result
      })
    } finally { setLoadingMore(false) }
  }

  // Todos Fetch
  useEffect(() => {
    let active = true
    if (!currentUser) {
      setTasks([])
      return () => {
        active = false
      }
    }
    loadTodos()
      .then((savedTasks) => {
        if (active) setTasks(savedTasks)
      })
      .catch((error) => {
        console.error('Could not load todos:', error)
        if (active) setTasks([])
      })
    return () => {
      active = false
    }
  }, [currentUser, refreshKey])

  // Competitive Coding Stats Fetch
  useEffect(() => {
    let active = true
    if (!currentUser || activePage !== 'stats') {
      return () => {
        active = false
      }
    }
    const codingPlatforms = ['codeforces', 'codechef', 'leetcode']
    codingPlatforms.forEach((platform) => {
      loadPlatformCodingStats(platform)
        .then((stats) => {
          if (active) {
            setCodingStats((current) => ({
              ...current,
              [platform]: stats,
            }))
          }
        })
        .catch((error) => {
          console.error(`Could not load ${platform} statistics:`, error)
          if (active) {
            setCodingStats((current) => ({ ...current, [platform]: {} }))
          }
        })
    })
    return () => {
      active = false
    }
  }, [currentUser, activePage])

  // GitHub Data Fetch
  useEffect(() => {
    let active = true
    if (!currentUser) {
      setProjects([])
      setCodingStats((current) => ({ ...current, github: {} }))
      return () => {
        active = false
      }
    }
    loadGithubData()
      .then((data) => {
        if (!active) return
        setCodingStats((current) => ({
          ...current,
          github: data.github ?? {},
        }))
        const githubProjects = (data.repositories ?? []).map((repository) => ({
          id: `github-${repository.owner.login}-${repository.name}`,
          name: repository.name,
          description: repository.description || 'No repository description.',
          status: repository.isArchived ? 'Completed' : 'Active',
          progress: repository.isArchived ? 100 : 0,
          updatedAt: repository.pushedAt,
          members: 1,
          technologies: repository.primaryLanguage
            ? [repository.primaryLanguage.name]
            : [],
          githubUrl: repository.url,
          liveUrl: repository.homepageUrl || repository.url,
          private: repository.isPrivate,
          stars: repository.stargazerCount,
          forks: repository.forkCount,
          source: 'github',
        }))
        setProjects((current) => [
          ...current.filter((project) => project.source === 'manual'),
          ...githubProjects,
        ])
      })
      .catch((error) => {
        console.error('Could not load GitHub data:', error)
        if (active) {
          setProjects((current) =>
            current.filter((project) => project.source === 'manual'),
          )
          setCodingStats((current) => ({ ...current, github: {} }))
        }
      })
    return () => {
      active = false
    }
  }, [currentUser])

  return {
    projects,
    setProjects,
    jobs,
    setJobs,
    documents,
    setDocuments,
    codingStats,
    setCodingStats,
    tasks,
    setTasks,
    notifications,
    setNotifications,
    contestSites,
    setContestSites,
    hackathons,
    setHackathons,
    googleCalendarEvents,
    setGoogleCalendarEvents,
    importedIcsCalendars,
    setImportedIcsCalendars,
    importedIcsEvents,
    setImportedIcsEvents,
    calendarEventIndex,
    pagination,
    loadingMore,
    loadMore,
  }
}
