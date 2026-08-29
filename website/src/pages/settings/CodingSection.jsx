import { useEffect, useState } from 'react'
import { Code2, ExternalLink, Save } from 'lucide-react'
import {
  loadCompetitiveCodingProfile,
  saveCompetitiveCodingProfile,
} from '../../lib/competitiveCodingProfileApi'
import { loadContests } from '../../lib/workspaceApi'
import { SectionHeading, SettingsCard } from '../../components/ui'

const CONTEST_PLATFORMS = [
  {
    id: 'codeforces',
    name: 'Codeforces',
    shortName: 'CF',
    description: 'Upcoming contests, rounds, and division challenges.',
    url: 'https://codeforces.com',
  },
  {
    id: 'codechef',
    name: 'CodeChef',
    shortName: 'CC',
    description: 'Starters, Long Challenges, and Cook-Offs.',
    url: 'https://www.codechef.com',
  },
  {
    id: 'leetcode',
    name: 'LeetCode',
    shortName: 'LC',
    description: 'Weekly & Biweekly contests with Global Leaderboards.',
    url: 'https://leetcode.com/contest',
  },
]

export function CodingSection({ user, onContestSitesChange }) {
  const [codingProfile, setCodingProfile] = useState({
    codeforces: '',
    codechef: '',
    leetcode: '',
  })
  const [codingSaving, setCodingSaving] = useState(false)
  const [codingMessage, setCodingMessage] = useState('')
  const [enabledContestPlatforms, setEnabledContestPlatforms] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('starwaves-enabled-contest-platforms') ??
          '["codeforces","codechef","leetcode"]',
      )
    } catch {
      return ['codeforces', 'codechef', 'leetcode']
    }
  })
  const [contestPlatformMessage, setContestPlatformMessage] = useState('')

  useEffect(() => {
    let active = true
    loadCompetitiveCodingProfile()
      .then((profile) => {
        if (active) {
          setCodingProfile({
            codeforces: profile.codeforces ?? '',
            codechef: profile.codechef ?? '',
            leetcode: profile.leetcode ?? '',
          })
        }
      })
      .catch((error) => {
        if (active) setCodingMessage(error.message)
      })
    return () => {
      active = false
    }
  }, [user?.uid])

  const updateCodingField = (field, value) => {
    setCodingProfile((current) => ({ ...current, [field]: value }))
    setCodingMessage('')
  }

  const submitCodingProfile = async (event) => {
    event.preventDefault()
    setCodingSaving(true)
    setCodingMessage('')
    try {
      const saved = await saveCompetitiveCodingProfile(codingProfile)
      setCodingProfile({
        codeforces: saved.codeforces ?? '',
        codechef: saved.codechef ?? '',
        leetcode: saved.leetcode ?? '',
      })
      setCodingMessage('Competitive coding profiles saved.')
    } catch (error) {
      setCodingMessage(error.message)
    } finally {
      setCodingSaving(false)
    }
  }

  const toggleContestPlatform = async (platformId) => {
    const nextEnabled = enabledContestPlatforms.includes(platformId)
      ? enabledContestPlatforms.filter((id) => id !== platformId)
      : [...enabledContestPlatforms, platformId]

    setEnabledContestPlatforms(nextEnabled)
    try {
      localStorage.setItem(
        'starwaves-enabled-contest-platforms',
        JSON.stringify(nextEnabled),
      )
    } catch {
      // ignore
    }

    const platformName =
      CONTEST_PLATFORMS.find((p) => p.id === platformId)?.name || platformId
    const isNowEnabled = nextEnabled.includes(platformId)
    setContestPlatformMessage(
      `${platformName} contest details ${isNowEnabled ? 'turned on' : 'turned off'}.`,
    )

    if (onContestSitesChange) {
      try {
        const rawContests = await loadContests()
        const sites = rawContests.items.reduce((groups, contest) => {
          const site = groups.find((item) => item.id === contest.platformId)
          if (site) site.contests.push(contest)
          else groups.push({ id: contest.platformId, name: contest.platformId, shortName: contest.platformId.slice(0, 2).toUpperCase(), description: 'Upcoming contests.', contests: [contest] })
          return groups
        }, [])
        onContestSitesChange(sites.filter((site) => nextEnabled.includes(site.id)))
      } catch (err) {
        console.error('Could not refresh contest platforms:', err)
      }
    }
  }

  return (
    <div className="setting-section" id="settings-coding">
      <SectionHeading
        title="Competitive coding"
        description="Add a username or full profile URL for each coding platform."
      />

      <div className="setting-content-stack">
        <SettingsCard
          as="form"
          className="coding-settings-card"
          onSubmit={submitCodingProfile}
          icon={<Code2 size={18} />}
          title="Coding profiles"
          description="These IDs will be used for your stats and contest activity."
        >

          <div className="coding-profile-fields">
            <label>
              <span><strong>Codeforces</strong><small>Handle or profile URL</small></span>
              <input
                value={codingProfile.codeforces}
                onChange={(event) =>
                  updateCodingField('codeforces', event.target.value)
                }
                placeholder="tourist or codeforces.com/profile/tourist"
              />
            </label>
            <label>
              <span><strong>CodeChef</strong><small>Username or profile URL</small></span>
              <input
                value={codingProfile.codechef}
                onChange={(event) =>
                  updateCodingField('codechef', event.target.value)
                }
                placeholder="username or codechef.com/users/username"
              />
            </label>
            <label>
              <span><strong>LeetCode</strong><small>Username or profile URL</small></span>
              <input
                value={codingProfile.leetcode}
                onChange={(event) =>
                  updateCodingField('leetcode', event.target.value)
                }
                placeholder="username or leetcode.com/u/username"
              />
            </label>
          </div>

          <div className="coding-settings-footer">
            {codingMessage && (
              <p role="status">{codingMessage}</p>
            )}
            <button type="submit" disabled={codingSaving}>
              <Save size={15} />
              {codingSaving ? 'Saving…' : 'Save profiles'}
            </button>
          </div>
        </SettingsCard>

        <SettingsCard
          className="hackathon-source-settings"
          icon={<Code2 size={18} />}
          title="Contest platforms & details"
          description="Turn on or off upcoming contest details from specific platform sources."
        >

          <div className="hackathon-source-list">
            {CONTEST_PLATFORMS.map((platform) => {
              const isEnabled = enabledContestPlatforms.includes(platform.id)
              return (
                <div className="hackathon-source-row" key={platform.id}>
                  <span className={`hackathon-source-logo ${platform.id}`}>
                    {platform.shortName}
                  </span>
                  <div>
                    <strong>{platform.name}</strong>
                    <small>{platform.description}</small>
                    <a href={platform.url} target="_blank" rel="noreferrer">
                      Visit site <ExternalLink size={11} />
                    </a>
                  </div>
                  <button
                    className={isEnabled ? 'enabled' : ''}
                    onClick={() => toggleContestPlatform(platform.id)}
                    aria-pressed={isEnabled}
                  >
                    <i />
                    {isEnabled ? 'Turn off' : 'Turn on'}
                  </button>
                </div>
              )
            })}
          </div>
          {contestPlatformMessage && (
            <p className="hackathon-source-message" role="status">
              {contestPlatformMessage}
            </p>
          )}
        </SettingsCard>
      </div>
    </div>
  )
}
