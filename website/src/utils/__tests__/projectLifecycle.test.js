import { describe, expect, it } from 'vitest'
import {
  getProjectPhase,
  getProjectPhaseIndex,
  getStatusForPhase,
  normalizeProjectPhase,
  PROJECT_LIFECYCLE_PHASES,
} from '../projectLifecycle'

describe('Project lifecycle phases', () => {
  it('orders the six lifecycle phases', () => {
    expect(PROJECT_LIFECYCLE_PHASES.map((phase) => phase.id)).toEqual([
      'idea',
      'design',
      'build',
      'test',
      'ship',
      'maintain',
    ])
  })

  it('normalizes unknown phases to the default', () => {
    expect(normalizeProjectPhase('build')).toBe('build')
    expect(normalizeProjectPhase(undefined)).toBe('idea')
    expect(normalizeProjectPhase('bogus')).toBe('idea')
  })

  it('resolves a phase to its metadata', () => {
    expect(getProjectPhase('ship').label).toBe('Ship')
    expect(getProjectPhase(null).id).toBe('idea')
  })

  it('computes phase indexes', () => {
    expect(getProjectPhaseIndex('idea')).toBe(0)
    expect(getProjectPhaseIndex('maintain')).toBe(5)
  })

  it('maps phases to project statuses', () => {
    expect(getStatusForPhase('idea')).toBe('Planning')
    expect(getStatusForPhase('build')).toBe('Active')
    expect(getStatusForPhase('ship')).toBe('Completed')
  })
})