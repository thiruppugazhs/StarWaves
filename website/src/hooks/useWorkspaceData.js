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

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export function useWorkspaceData(currentUser, activePage, refreshKey = 0) {
  const currentUserId = currentUser?.uid ?? null
  const debouncedRefreshKey = useDebouncedValue(refreshKey, 250)
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
    if (currentUserId) {
      autoPromptNotificationPermission()
    }
  }, [currentUserId])

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

  // Consolidated workspace fetch — single debounced effect for all refreshKey-gated resources
  // Staggered to avoid e2-micro burst (15 GETs + 15 OPTIONS =30 → Nginx burst 60, but JS concurrency limiter =6)
  // Delays spread the 8 parallel requests (was 3 effects firing 8 at once) across 600ms
  useEffect(() => {
    let active = true
    if (!currentUserId) {
      setDocuments([])
      setGoogleCalendarEvents([])
      setJobs([])
      setHackathons([])
      setNotifications([])
      setContestSites([])
      setTasks([])
      return () => { active = false }
    }

    const staggered = (fn, delayMs) =>
      new Promise((resolve, reject) => {
        window.setTimeout(() => {
          Promise.resolve()
            .then(fn)
            .then(resolve)
            .catch(reject)
        }, delayMs)
      })

    // Tier 1: immediate (docs + calendar, cheap and cached)
    loadGoogleCalendarData()
      .then(({ events }) => { if (active) setGoogleCalendarEvents(events) })
      .catch((error) => { console.error('Could not load Google Calendar:', error); if (active) setGoogleCalendarEvents([]) })
    loadDocuments()
      .then((savedDocuments) => { if (active) setDocuments(savedDocuments) })
      .catch((error) => { console.error('Could not load documents:', error); if (active) setDocuments([]) })

    // Tier 2: todos staggered 120ms (so not all at t=0)
    staggered(loadTodos, 120)
      .then((savedTasks) => { if (active) setTasks(savedTasks) })
      .catch((error) => { console.error('Could not load todos:', error); if (active) setTasks([]) })

    // Core workspace batch (5) — staggered 0/150/300/450ms, respects request.js GET cache (30s TTL) + concurrency limiter (6)
    Promise.allSettled([
      loadJobs(), // t=0
      staggered(loadHackathons, 150),
      staggered(loadNotifications, 300),
      staggered(loadContests, 300),
      staggered(loadProjects, 450),
    ]).then(([jobsResult, hackathonsResult, notificationsResult, contestsResult, projectsResult]) => {
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
      setHackathons(hackathonsPage.items)
      setNotifications(notificationsPage.items)
      const enabledPlatforms = (() => {
        try { return JSON.parse(localStorage.getItem('starwaves-enabled-contest-platforms') ?? '["codeforces","codechef","leetcode"]') } catch { return ['codeforces', 'codechef', 'leetcode'] }
      })()
      const rawContestItems = contestsResult.status === 'fulfilled' ? contestsResult.value.items : []
      const rawContestSites = rawContestItems.reduce((sites, contest) => {
        const id = contest.platformId || 'contests'
        const site = sites.find((item) => item.id === id)
        if (site) site.contests.push(contest)
        else sites.push({ id, name: id, shortName: id.slice(0, 2).toUpperCase(), description: 'Upcoming contests.', contests: [contest] })
        return sites
      }, [])
      setContestSites(rawContestSites.filter((site) => enabledPlatforms.includes(site.id)))
      setProjects((current) => [...projectsPage.items, ...current.filter((project) => project.source === 'github')])
    })

    return () => { active = false }
  }, [currentUserId, debouncedRefreshKey])

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

  // Competitive Coding Stats Fetch — only on stats page, gated by uid (stable)
  useEffect(() => {
    let active = true
    if (!currentUserId || activePage !== 'stats') {
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
  }, [currentUserId, activePage])

  // GitHub Data Fetch — gated by uid, staggered 600ms to avoid burst with core batch
  useEffect(() => {
    let active = true
    let timeoutId
    if (!currentUserId) {
      setProjects([])
      setCodingStats((current) => ({ ...current, github: {} }))
      return () => {
        active = false
      }
    }
    const run = () =>
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
    timeoutId = window.setTimeout(run, 600)
    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [currentUserId])

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
