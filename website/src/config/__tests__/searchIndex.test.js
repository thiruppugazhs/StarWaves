import { describe, expect, it } from 'vitest'
import {
  buildSearchIndex,
  filterSearchItems,
  SEARCH_CATEGORIES,
  STATIC_SEARCH_ITEMS,
} from '../searchIndex'

describe('searchIndex', () => {
  it('defines valid search categories including All, Pages, Settings, Eve AI, Records, Actions', () => {
    const ids = SEARCH_CATEGORIES.map((c) => c.id)
    expect(ids).toContain('all')
    expect(ids).toContain('pages')
    expect(ids).toContain('settings')
    expect(ids).toContain('eve')
    expect(ids).toContain('records')
    expect(ids).toContain('actions')
  })

  it('includes core pages and deep settings sections in STATIC_SEARCH_ITEMS', () => {
    const ids = STATIC_SEARCH_ITEMS.map((item) => item.id)
    expect(ids).toContain('page-dashboard')
    expect(ids).toContain('page-profile')
    expect(ids).toContain('page-setting')
    expect(ids).toContain('setting-ai-models')
    expect(ids).toContain('setting-eve-voice')
    expect(ids).toContain('setting-coding')
    expect(ids).toContain('setting-apps')
    expect(ids).toContain('action-toggle-theme')
  })

  it('buildSearchIndex dynamically adds projects, jobs, documents, hackathons, and tasks', () => {
    const workspaceData = {
      projects: [{ id: 'p1', title: 'StarWaves App', lifecycle_phase: 'build' }],
      jobs: [{ id: 'j1', title: 'Frontend Engineer', company: 'Google', status: 'Interviewing' }],
      documents: [{ id: 'd1', title: 'System Architecture', content: 'Database specs and schemas' }],
      hackathons: [{ id: 'h1', title: 'AI Genesis', source: 'Devpost' }],
      tasks: [{ id: 't1', text: 'Implement advanced search', completed: false, priority: 'High' }],
    }

    const index = buildSearchIndex(workspaceData)
    const titles = index.map((item) => item.title)

    expect(titles).toContain('StarWaves App')
    expect(titles).toContain('Frontend Engineer — Google')
    expect(titles).toContain('System Architecture')
    expect(titles).toContain('AI Genesis')
    expect(titles).toContain('Implement advanced search')
  })

  it('filterSearchItems matches exact words and keywords accurately', () => {
    const index = STATIC_SEARCH_ITEMS

    const profileResults = filterSearchItems(index, 'profile')
    expect(profileResults.length).toBeGreaterThan(0)
    expect(profileResults.some((r) => r.title === 'Profile')).toBe(true)
    expect(profileResults.some((r) => r.title === 'Profile Settings')).toBe(true)
    expect(profileResults.some((r) => r.title === 'Coding Profiles')).toBe(true)

    const aiResults = filterSearchItems(index, 'openai')
    expect(aiResults.some((r) => r.id === 'setting-ai-models')).toBe(true)

    const themeResults = filterSearchItems(index, 'dark mode')
    expect(themeResults.some((r) => r.id === 'action-toggle-theme' || r.id === 'setting-themes' || r.id === 'page-themes')).toBe(true)
  })

  it('filterSearchItems filters by selected category', () => {
    const index = STATIC_SEARCH_ITEMS

    const settingsOnly = filterSearchItems(index, '', 'settings')
    expect(settingsOnly.length).toBeGreaterThan(0)
    expect(settingsOnly.every((i) => i.category === 'settings')).toBe(true)

    const actionsOnly = filterSearchItems(index, '', 'actions')
    expect(actionsOnly.length).toBeGreaterThan(0)
    expect(actionsOnly.every((i) => i.category === 'actions')).toBe(true)
  })
})
