/** Project grid card — single responsibility: render one project in grid layout. */
import { CalendarClock, ExternalLink, FolderKanban, GitBranch, Minus, Plus, Trash2, Users } from 'lucide-react'
import { ProjectPhaseDots } from '../../components/ProjectLifecycleCard'
import { getProjectPhase } from '../../utils/projectLifecycle'
import { getStatusClass } from './constants'

export function ProjectGridCard({ project, onOpenProject, onDelete, onQuickProgress }) {
  const renderAvatarStack = (membersCount) => {
    const count = Math.min(membersCount || 1, 3)
    const avatars = []
    const prefixes = ['JD', 'AB', 'SK', 'ML']
    for (let i = 0; i < count; i++) {
      avatars.push(
        <span key={i} className="project-avatar-bubble">
          {prefixes[i % prefixes.length]}
        </span>,
      )
    }
    if (membersCount > 3) {
      avatars.push(
        <span key="more" className="project-avatar-bubble more">
          +{membersCount - 3}
        </span>,
      )
    }
    return (
      <div className="project-avatar-stack" title={`${membersCount} team members`}>
        {avatars}
      </div>
    )
  }

  return (
    <article className="project-grid-card" data-record-id={project.id}>
      <div className="project-grid-card-top">
        <div className="project-grid-card-header">
          <div className="project-grid-logo">
            <FolderKanban size={18} />
          </div>
          <span className={`project-status ${getStatusClass(project.status)}`}>{project.status}</span>
        </div>

        <div className="project-grid-title">
          <strong>{project.name}</strong>
          {project.description && <p>{project.description}</p>}
        </div>

        <div className="project-grid-progress-block">
          <div className="project-grid-progress-header">
            <span>Progress ({project.progress}%)</span>
            <div className="project-progress-actions">
              <button type="button" className="project-quick-progress-btn" onClick={(e) => onQuickProgress(e, project, -10)} disabled={project.progress <= 0} title="Decrease progress by 10%">
                <Minus size={10} />
              </button>
              <button type="button" className="project-quick-progress-btn" onClick={(e) => onQuickProgress(e, project, 10)} disabled={project.progress >= 100} title="Increase progress by 10%">
                <Plus size={10} />
              </button>
            </div>
          </div>
          <div className="project-progress" role="progressbar" aria-label={`${project.name} progress`} aria-valuenow={project.progress} aria-valuemin="0" aria-valuemax="100">
            <span style={{ width: `${project.progress}%` }} />
          </div>
        </div>

        <div className="project-detail-grid" style={{ marginTop: 0 }}>
          <div className="project-detail-item">
            <Users size={15} />
            <div>
              <span>Team</span>
              {renderAvatarStack(project.members)}
            </div>
          </div>
          <div className="project-detail-item">
            <CalendarClock size={15} />
            <div>
              <span>Updated</span>
              <strong>{new Date(project.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong>
            </div>
          </div>
        </div>

        <div className="project-grid-phase">
          <ProjectPhaseDots phase={project.lifecyclePhase} />
          <strong>{getProjectPhase(project.lifecyclePhase).label}</strong>
        </div>

        {project.technologies && project.technologies.length > 0 && (
          <div className="project-tags">
            {project.technologies.map((tech) => (
              <span key={tech}>{tech}</span>
            ))}
          </div>
        )}
      </div>

      <div className="project-grid-card-footer">
        <div className="project-grid-links">
          {project.githubUrl && (
            <a className="project-grid-link-icon" href={project.githubUrl} target="_blank" rel="noreferrer" title="GitHub Repository">
              <GitBranch size={14} />
            </a>
          )}
          {project.liveUrl && (
            <a className="project-grid-link-icon" href={project.liveUrl} target="_blank" rel="noreferrer" title="Live Website">
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        <div className="project-card-actions">
          <button className="secondary-button" type="button" onClick={(e) => onDelete(e, project.id)} aria-label="Delete project">
            <Trash2 size={14} />
          </button>
          <button className="primary-button" onClick={() => onOpenProject(project)}>
            Open
          </button>
        </div>
      </div>
    </article>
  )
}
