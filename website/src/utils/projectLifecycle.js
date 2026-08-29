export const PROJECT_LIFECYCLE_PHASES = [
  {
    id: 'idea',
    label: 'Idea',
    description: 'The concept, goals, and scope are being defined.',
  },
  {
    id: 'design',
    label: 'Design',
    description: 'Architecture, UX, and the technical plan are laid out.',
  },
  {
    id: 'build',
    label: 'Build',
    description: 'Core features are implemented and integrated.',
  },
  {
    id: 'test',
    label: 'Test',
    description: 'QA, edge cases, and fixes are being validated.',
  },
  {
    id: 'ship',
    label: 'Ship',
    description: 'The project is released and available to users.',
  },
  {
    id: 'maintain',
    label: 'Maintain',
    description: 'The project is supported, monitored, and improved.',
  },
]

export const DEFAULT_LIFECYCLE_PHASE = 'idea'

const PHASE_TO_STATUS = {
  idea: 'Planning',
  design: 'Planning',
  build: 'Active',
  test: 'Active',
  ship: 'Completed',
  maintain: 'Completed',
}

export function normalizeProjectPhase(phase) {
  return PROJECT_LIFECYCLE_PHASES.some((item) => item.id === phase)
    ? phase
    : DEFAULT_LIFECYCLE_PHASE
}

export function getProjectPhase(phase) {
  return (
    PROJECT_LIFECYCLE_PHASES.find((item) => item.id === normalizeProjectPhase(phase)) ??
    PROJECT_LIFECYCLE_PHASES[0]
  )
}

export function getProjectPhaseIndex(phase) {
  return PROJECT_LIFECYCLE_PHASES.findIndex(
    (item) => item.id === normalizeProjectPhase(phase),
  )
}

export function getStatusForPhase(phase) {
  return PHASE_TO_STATUS[normalizeProjectPhase(phase)]
}
