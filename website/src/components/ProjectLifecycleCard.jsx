import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  getProjectPhase,
  getProjectPhaseIndex,
  PROJECT_LIFECYCLE_PHASES,
} from '../utils/projectLifecycle'

export function ProjectPhaseDots({ phase }) {
  const currentIndex = getProjectPhaseIndex(phase)
  const currentPhase = getProjectPhase(phase)
  return (
    <span
      className="project-phase-dots"
      aria-label={`Lifecycle phase: ${currentPhase.label}`}
    >
      {PROJECT_LIFECYCLE_PHASES.map((item, index) => (
        <i
          key={item.id}
          className={
            index < currentIndex
              ? 'done'
              : index === currentIndex
                ? 'current'
                : ''
          }
        />
      ))}
    </span>
  )
}

export function ProjectLifecycleCard({ phase, onPhaseChange, saving = false }) {
  const currentPhase = getProjectPhase(phase)
  const currentIndex = getProjectPhaseIndex(phase)
  const isFirst = currentIndex === 0
  const isLast = currentIndex === PROJECT_LIFECYCLE_PHASES.length - 1

  const advance = () => {
    const next = PROJECT_LIFECYCLE_PHASES[currentIndex + 1]
    if (next) onPhaseChange(next.id)
  }

  const rewind = () => {
    const previous = PROJECT_LIFECYCLE_PHASES[currentIndex - 1]
    if (previous) onPhaseChange(previous.id)
  }

  return (
    <article className="project-lifecycle-card">
      <div className="project-lifecycle-heading">
        <div>
          <p>Lifecycle</p>
          <h2>{currentPhase.label}</h2>
        </div>
        <div className="project-lifecycle-nav">
          <button
            type="button"
            onClick={rewind}
            disabled={isFirst || saving}
            title="Move to the previous phase"
            aria-label="Move to the previous phase"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={advance}
            disabled={isLast || saving}
            title="Move to the next phase"
            aria-label="Move to the next phase"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <ol className="project-lifecycle-track" aria-label="Project lifecycle phases">
        {PROJECT_LIFECYCLE_PHASES.map((item, index) => {
          const state =
            index < currentIndex
              ? 'done'
              : index === currentIndex
                ? 'current'
                : 'upcoming'
          return (
            <li key={item.id} className={`project-lifecycle-node ${state}`}>
              <button
                type="button"
                onClick={() => onPhaseChange(item.id)}
                disabled={saving}
                title={`${item.label} — ${item.description}`}
                aria-label={`Set lifecycle phase to ${item.label}`}
                aria-current={index === currentIndex ? 'step' : undefined}
              >
                <span className="project-lifecycle-node-index">{index + 1}</span>
              </button>
              <span className="project-lifecycle-node-label">{item.label}</span>
            </li>
          )
        })}
      </ol>

      <p className="project-lifecycle-description">{currentPhase.description}</p>
    </article>
  )
}
