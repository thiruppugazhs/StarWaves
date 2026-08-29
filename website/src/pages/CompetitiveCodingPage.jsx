import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, Clock3, Filter, SlidersHorizontal, Trophy } from 'lucide-react'
import { CustomDropdown, EmptyState, FilterBar, MetricCard, MetricGrid, PageHeader, SearchBar } from '../components/ui'
import { usePersistentState } from '../hooks/usePersistentState'

export function CompetitiveCodingPage({ contestSites }) {
  const [openSites, setOpenSites] = useState(() => new Set(['codeforces']))
  const [showAll, setShowAll] = useState({})
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = usePersistentState('starwaves.contests.platform', 'all')
  const [timeframe, setTimeframe] = usePersistentState('starwaves.contests.timeframe', 'all')
  const [sortOrder, setSortOrder] = usePersistentState('starwaves.contests.sort', 'soonest')
  const allContests = useMemo(() => contestSites.flatMap((site) => site.contests.map((contest) => ({ ...contest, siteId: site.id, siteName: site.name }))), [contestSites])
  const filteredContests = useMemo(() => {
    const now = Date.now()
    const cutoff = timeframe === 'today' ? now + 86400000 : timeframe === 'week' ? now + 604800000 : timeframe === 'month' ? now + 2592000000 : Infinity
    const search = query.trim().toLowerCase()
    return allContests.filter((contest) => platform === 'all' || contest.siteId === platform).filter((contest) => !search || contest.name.toLowerCase().includes(search) || contest.siteName.toLowerCase().includes(search)).filter((contest) => new Date(contest.startsAt).getTime() <= cutoff).sort((first, second) => sortOrder === 'latest' ? new Date(second.startsAt) - new Date(first.startsAt) : new Date(first.startsAt) - new Date(second.startsAt))
  }, [allContests, platform, query, sortOrder, timeframe])
  const visibleSiteIds = new Set(filteredContests.map((contest) => contest.siteId))
  const hasFilters = query || platform !== 'all' || timeframe !== 'all' || sortOrder !== 'soonest'
  const resetFilters = () => { setQuery(''); setPlatform('all'); setTimeframe('all'); setSortOrder('soonest') }

  const toggleSite = (siteId) => {
    setOpenSites((current) => {
      const next = new Set(current)
      if (next.has(siteId)) next.delete(siteId)
      else next.add(siteId)
      return next
    })
  }

  return (
    <section className="competitive-coding-page">
      <PageHeader
        eyebrow="Practice & compete"
        title="Competitive Coding"
        description="Keep your next challenge in sight across every platform."
        actions={<div className="contest-summary">
          <Trophy size={16} />
          <span>{contestSites.length} platforms</span>
        </div>}
      />

      <MetricGrid className="workspace-insight-grid" ariaLabel="Competitive coding overview">
        <MetricCard className="compact" label="Platforms" value={contestSites.length} detail="connected sources" />
        <MetricCard className="compact" label="Upcoming" value={allContests.length} detail="contests to explore" />
        <MetricCard
          className="compact"
          label="Next move"
          value={contestSites.some((site) => (site.contests || []).length > 0) ? 'Pick one' : 'Connect'}
          detail={contestSites.some((site) => (site.contests || []).length > 0) ? 'and reserve your slot' : 'a contest source in Settings'}
        />
      </MetricGrid>

      <FilterBar
        className="contest-controls"
        search={
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search contests or platforms"
            ariaLabel="Search contests or platforms"
          />
        }
        filters={
          <>
            <Filter size={14} className="text-muted" aria-hidden="true" />
            <CustomDropdown
              value={platform}
              onChange={setPlatform}
              ariaLabel="Platform"
              options={[{ value: 'all', label: 'All platforms' }, ...contestSites.map((site) => ({ value: site.id, label: site.name }))]}
            />
            <CustomDropdown
              value={timeframe}
              onChange={setTimeframe}
              ariaLabel="Timeframe"
              options={[
                { value: 'all', label: 'Any time' },
                { value: 'today', label: 'Next 24 hours' },
                { value: 'week', label: 'Next 7 days' },
                { value: 'month', label: 'Next 30 days' },
              ]}
            />
            <SlidersHorizontal size={14} className="text-muted" aria-hidden="true" />
            <CustomDropdown
              value={sortOrder}
              onChange={setSortOrder}
              ariaLabel="Sort contests"
              options={[
                { value: 'soonest', label: 'Soonest first' },
                { value: 'latest', label: 'Latest first' },
              ]}
            />
          </>
        }
        isFiltered={Boolean(hasFilters)}
        onReset={resetFilters}
      />
      <div className="contest-results-meta"><span><strong>{filteredContests.length}</strong> {filteredContests.length === 1 ? 'contest' : 'contests'} shown</span>{hasFilters && <span>Filters are active</span>}</div>
      <div className="contest-site-list">
        {contestSites.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No Contest Sources Enabled"
            description="All contest platforms are turned off. You can turn on contest details for Codeforces, CodeChef, and LeetCode in Settings."
          />
        ) : filteredContests.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No contests match"
            description="Try a different search, platform, or time window."
            action={
              <button className="secondary-button" type="button" onClick={resetFilters}>
                Clear filters
              </button>
            }
          />
        ) : (
          contestSites.filter((site) => visibleSiteIds.has(site.id)).map((site) => {
          const isOpen = openSites.has(site.id)
          const visibleContests = showAll[site.id]
            ? filteredContests.filter((contest) => contest.siteId === site.id)
            : filteredContests.filter((contest) => contest.siteId === site.id).slice(0, 2)

          return (
            <article className={`contest-site-card ${isOpen ? 'open' : ''}`} key={site.id}>
              <button
                className="contest-site-header"
                onClick={() => toggleSite(site.id)}
                aria-expanded={isOpen}
              >
                <span className="contest-site-logo">{site.shortName}</span>
                <span className="contest-site-copy">
                  <strong>{site.name}</strong>
                  <small>{site.description}</small>
                </span>
                <span className="contest-upcoming-count">
                  {site.contests.length} upcoming
                </span>
                <ChevronDown size={18} />
              </button>

              {isOpen && (
                <div className="contest-site-content">
                  <div className="contest-list">
                    {visibleContests.map((contest) => {
                      const startDate = new Date(contest.startsAt)

                      return (
                        <div className="contest-row" key={contest.id} data-record-id={contest.id}>
                          <div className="contest-date-tile">
                            <span>
                              {startDate.toLocaleDateString(undefined, {
                                month: 'short',
                              })}
                            </span>
                            <strong>{startDate.getDate()}</strong>
                          </div>
                          <div className="contest-info">
                            <strong>{contest.name}</strong>
                            <div>
                              <span>
                                <CalendarDays size={13} />
                                {startDate.toLocaleDateString(undefined, {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span>
                                <Clock3 size={13} />
                                {startDate.toLocaleTimeString(undefined, {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span>{contest.duration}</span>
                            </div>
                          </div>
                          {contest.url ? (
                            <a
                              className="contest-status"
                              href={contest.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="contest-status">Upcoming</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {filteredContests.filter((contest) => contest.siteId === site.id).length > 2 && (
                    <button
                      className="contest-show-all"
                      onClick={() =>
                        setShowAll((current) => ({
                          ...current,
                          [site.id]: !current[site.id],
                        }))
                      }
                    >
                      {showAll[site.id]
                        ? 'Show latest two'
                        : `Show all ${filteredContests.filter((contest) => contest.siteId === site.id).length} contests`}
                    </button>
                  )}
                </div>
              )}
            </article>
          )
        })
        )}
      </div>
    </section>
  )
}
