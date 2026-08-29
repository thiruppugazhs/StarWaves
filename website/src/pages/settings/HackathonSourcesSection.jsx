import { useEffect, useState } from 'react'
import { ExternalLink, Globe2 } from 'lucide-react'
import {
  loadHackathons,
  loadHackathonSources,
  setHackathonSourceEnabled,
} from '../../lib/workspaceApi'
import { SectionHeading, SettingsCard } from '../../components/ui'

export function HackathonSourcesSection({ user, onHackathonsChange }) {
  const [hackathonSources, setHackathonSources] = useState([])
  const [hackathonSourceBusy, setHackathonSourceBusy] = useState('')
  const [hackathonSourceMessage, setHackathonSourceMessage] = useState('')

  useEffect(() => {
    let active = true
    loadHackathonSources()
      .then(({ sources }) => {
        if (active) setHackathonSources(sources)
      })
      .catch((error) => {
        if (active) setHackathonSourceMessage(error.message)
      })
    return () => {
      active = false
    }
  }, [user?.uid])

  const toggleHackathonSource = async (source) => {
    setHackathonSourceBusy(source.id)
    setHackathonSourceMessage('')
    try {
      const enabled = !source.enabled
      await setHackathonSourceEnabled(source.id, enabled)
      setHackathonSources((current) =>
        current.map((item) =>
          item.id === source.id ? { ...item, enabled } : item,
        ),
      )
      const hackathons = await loadHackathons()
      onHackathonsChange(hackathons.items)
      setHackathonSourceMessage(
        `${source.name} ${enabled ? 'connected' : 'turned off'}.`,
      )
    } catch (error) {
      setHackathonSourceMessage(error.message)
    } finally {
      setHackathonSourceBusy('')
    }
  }

  return (
    <div className="setting-section" id="settings-hackathons">
      <SectionHeading
        title="Hackathons"
        description="Turn on event sources to combine their active hackathons."
      />

      <SettingsCard
        className="hackathon-source-settings"
        icon={<Globe2 size={18} />}
        title="Hackathon sources"
        description="Connected sources automatically update your Hackathons page."
      >

        <div className="hackathon-source-list">
          {hackathonSources.map((source) => (
            <div className="hackathon-source-row" key={source.id}>
              <span className={`hackathon-source-logo ${source.id}`}>
                {source.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{source.name}</strong>
                <small>{source.description}</small>
                <a href={source.url} target="_blank" rel="noreferrer">
                  Visit site <ExternalLink size={11} />
                </a>
              </div>
              <button
                className={source.enabled ? 'enabled' : ''}
                onClick={() => toggleHackathonSource(source)}
                disabled={hackathonSourceBusy === source.id}
                aria-pressed={source.enabled}
              >
                <i />
                {hackathonSourceBusy === source.id
                  ? 'Updating…'
                  : source.enabled
                    ? 'Disconnect'
                    : 'Connect'}
              </button>
            </div>
          ))}
        </div>
        {hackathonSourceMessage && (
          <p className="hackathon-source-message" role="status">
            {hackathonSourceMessage}
          </p>
        )}
      </SettingsCard>
    </div>
  )
}
