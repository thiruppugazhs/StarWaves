import { useEffect, useRef, useState } from 'react'
import { TabNav } from '../components/ui'
import { AccountSection } from './settings/AccountSection'
import { AiModelsSection } from './settings/AiModelsSection'
import { AppsSection } from './settings/AppsSection'
import { AutoMemorySection } from './settings/AutoMemorySection'
import { CodingSection } from './settings/CodingSection'
import { AppearanceSection } from './settings/AppearanceSection'
import { DeviceSection } from './settings/DeviceSection'
import { EveVoiceSection } from './settings/EveVoiceSection'
import { HackathonSourcesSection } from './settings/HackathonSourcesSection'
import { ProfileSection } from './settings/ProfileSection'
import { ThemeSection } from './settings/ThemeSection'
import { WhatsAppSection } from './settings/WhatsAppSection'

const SETTINGS_SECTIONS = [
  { id: 'settings-profile', href: '#settings-profile', label: 'Profile' },
  { id: 'settings-themes', href: '#settings-themes', label: 'Themes & Appearance' },
  { id: 'settings-appearance', href: '#settings-appearance', label: 'Eve UI Overrides' },
  { id: 'settings-apps', href: '#settings-apps', label: 'Integrations' },
  { id: 'settings-whatsapp', href: '#settings-whatsapp', label: 'WhatsApp' },
  { id: 'settings-ai-models', href: '#settings-ai-models', label: 'AI Models' },
  { id: 'settings-eve-memory', href: '#settings-eve-memory', label: 'Eve memory' },
  { id: 'settings-coding', href: '#settings-coding', label: 'Coding profiles' },
  { id: 'settings-hackathons', href: '#settings-hackathons', label: 'Hackathons' },
  { id: 'settings-eve-voice', href: '#settings-eve-voice', label: 'Eve voice' },
  { id: 'settings-devices', href: '#settings-devices', label: 'Devices & sessions' },
  { id: 'settings-account', href: '#settings-account', label: 'Account & security' },
]

export function SettingPage({
  user,
  onNavigate,
  onGoogleCalendarsChange,
  onHackathonsChange,
  onContestSitesChange,
  importedIcsCalendars = [],
  setImportedIcsCalendars,
  setImportedIcsEvents,
  onSignOut,
}) {
  const [activeSection, setActiveSection] = useState('settings-profile')
  const isClickScrollingRef = useRef(false)
  const clickTimeoutRef = useRef(null)

  useEffect(() => {
    let rafId = null
    const scrollContainer = document.querySelector('.content') || window

    const handleScroll = () => {
      if (isClickScrollingRef.current) return

      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const scrollTop = scrollContainer === window ? window.scrollY : scrollContainer.scrollTop
        const scrollPos = scrollTop + 100
        let current = SETTINGS_SECTIONS[0].id

        for (const section of SETTINGS_SECTIONS) {
          const el = document.getElementById(section.id)
          if (el && el.offsetTop <= scrollPos) {
            current = section.id
          }
        }
        setActiveSection((prev) => (prev !== current ? current : prev))
      })
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      scrollContainer.removeEventListener('scroll', handleScroll)
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const handleHash = () => {
      const hash = (window.location.hash || '').replace('#', '')
      if (hash && SETTINGS_SECTIONS.some((s) => s.id === hash)) {
        setTimeout(() => {
          handleNavClick(hash)
        }, 60)
      }
    }

    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  const handleNavClick = (sectionId) => {
    isClickScrollingRef.current = true
    setActiveSection(sectionId)

    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
    clickTimeoutRef.current = setTimeout(() => {
      isClickScrollingRef.current = false
    }, 700)

    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.replaceState(null, '', `#${sectionId}`)
    }
  }

  return (
    <section className="setting-page">
      <div className="page-heading">
        <div>
          <p>Account</p>
          <h1>Settings</h1>
        </div>
      </div>

      <TabNav
        tabs={SETTINGS_SECTIONS}
        activeTab={activeSection}
        onChange={handleNavClick}
        className="sticky-nav"
        ariaLabel="Settings sections"
      />

      <ProfileSection user={user} />
      <ThemeSection onNavigate={onNavigate} />
      <AppearanceSection />
      <AppsSection
        user={user}
        onGoogleCalendarsChange={onGoogleCalendarsChange}
        importedIcsCalendars={importedIcsCalendars}
        setImportedIcsCalendars={setImportedIcsCalendars}
        setImportedIcsEvents={setImportedIcsEvents}
      />
      <WhatsAppSection />
      <AiModelsSection />
      <AutoMemorySection />
      <CodingSection user={user} onContestSitesChange={onContestSitesChange} />
      <HackathonSourcesSection user={user} onHackathonsChange={onHackathonsChange} />
      <EveVoiceSection />
      <DeviceSection />
      <AccountSection user={user} onSignOut={onSignOut} />
    </section>
  )
}
