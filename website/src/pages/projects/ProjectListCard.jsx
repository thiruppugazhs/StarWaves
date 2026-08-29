/** Project list card — single responsibility: render one project in list layout. */
import { CalendarClock, ChevronDown, FolderKanban, Minus, Plus, Trash2, Users } from 'lucide-react'
import { ProjectPhaseDots } from '../../components/ProjectLifecycleCard'
import { getProjectPhase } from '../../utils/projectLifecycle'
import { getStatusClass } from './constants'

export function ProjectListCard({ project, isOpen, onToggle, onOpenProject, onDelete, onQuickProgress }) {
  const updatedAt = new Date(project.updatedAt)
  return (
    <article className={`contest-site-card project-list-card ${isOpen ? 'open' : ''}`} data-record-id={project.id}>
      <button className="contest-site-header" onClick={() => onToggle(project.id)} aria-expanded={isOpen}>
        <span className="contest-site-logo">
          <FolderKanban size={18} />
        </span>
        <span className="contest-site-copy">
          <strong>{project.name}</strong>
          <small>{project.description}</small>
        </span>
        <span className={`project-status ${getStatusClass(project.status)}`}>{project.status}</span>
        <ChevronDown size={18} />
      </button>

      {isOpen && (
        <div className="contest-site-content project-detail-content">
          <div className="project-progress-heading">
            <span>Progress</span>
            <div className="project-progress-actions">
              <button type="button" className="project-quick-progress-btn" onClick={(e) => onQuickProgress(e, project, -10)} disabled={project.progress <= 0} title="-10%">
                <Minus size={10} />
              </button>
              <strong>{project.progress}%</strong>
              <button type="button" className="project-quick-progress-btn" onClick={(e) => onQuickProgress(e, project, 10)} disabled={project.progress >= 100} title="+10%">
                <Plus size={10} />
              </button>
            </div>
          </div>
          <div className="project-progress" role="progressbar" aria-label={`${project.name} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={project.progress}>
            <span style={{ width: `${project.progress}%` }} />
          </div>

          <div className="project-list-phase">
            <span>Lifecycle</span>
            <ProjectPhaseDots phase={project.lifecyclePhase} />
            <strong>{getProjectPhase(project.lifecyclePhase).label}</strong>
          </div>

          <div className="project-detail-grid">
            <div className="project-detail-item">
              <Users size={17} />
              <div>
                <span>Team</span>
                <strong>
                  {project.members} {project.members === 1 ? 'member' : 'members'}
                </strong>
              </div>
            </div>
            <div className="project-detail-item">
              <CalendarClock size={17} />
              <div>
                <span>Last updated</span>
                <strong>{updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
              </div>
            </div>
          </div>

          <div className="project-list-footer">
            <div className="project-tags">
              {project.technologies.map((technology) => (
                <span key={technology}>{technology}</span>
              ))}
            </div>
            <div className="project-card-actions">
              <button className="secondary-button" type="button" onClick={(e) => onDelete(e, project.id)}>
                <Trash2 size={15} /> Delete
              </button>
              <button className="primary-button" onClick={() => onOpenProject(project)}>
                Open project
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
