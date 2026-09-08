import '../styles/pages/compete.css'
import { useEffect, useState } from 'react'
import { ChartNoAxesCombined, Trophy } from 'lucide-react'
import { TabNav } from '../components/ui'
import { CompetitiveCodingPage } from './CompetitiveCodingPage'
import { StatsPage } from './StatsPage'

const COMPETE_TABS = [
  { id: 'contests', label: 'Contests', icon: Trophy },
  { id: 'stats', label: 'Stats', icon: ChartNoAxesCombined },
]

const TAB_PAGE_ID = {
  contests: 'competitive-coding',
  stats: 'stats',
}

export function CompetePage({
  initialTab = 'contests',
  contestSites,
  codingStats,
  projects,
  hackathons,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const switchTab = (tabId) => {
    setActiveTab(tabId)
    onNavigate?.(TAB_PAGE_ID[tabId])
  }

  return (
    <div className="compete-page">
      <TabNav tabs={COMPETE_TABS} activeTab={activeTab} onChange={switchTab} ariaLabel="Compete sections" />
      {activeTab === 'stats' ? (
        <StatsPage
          codingStats={codingStats}
          contestSites={contestSites}
          projects={projects}
          hackathons={hackathons}
          onNavigate={onNavigate}
        />
      ) : (
        <CompetitiveCodingPage contestSites={contestSites} />
      )}
    </div>
  )
}
