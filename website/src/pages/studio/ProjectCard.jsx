import { Blocks, FileCode, GitBranch, Play } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { buildStatusLabel, planStatusLabel } from './studioConstants'

export function ProjectCard({ project, onOpen, onDelete }) {
  return (
    <article className="studio-project-card">
      <div className="studio-project-card-icon" aria-hidden="true">
        <Blocks size={22} />
      </div>
      <div className="studio-project-card-body">
        <h3 className="studio-project-card-title">{project.name}</h3>
        {project.description && (
          <p className="studio-project-card-desc">{project.description}</p>
        )}
        <div className="studio-project-card-meta">
          <Badge variant={project.build_status === 'ready' ? 'success' : 'default'}>
            {buildStatusLabel(project.build_status)}
          </Badge>
          {project.plan_status === 'proposed' && (
            <span className="studio-plan-flag">{planStatusLabel(project.plan_status)}</span>
          )}
          {project.stack && <span className="studio-stack-tag">{project.stack}</span>}
          <span className="studio-file-count">
            <FileCode size={12} /> {project.file_count} files
          </span>
          {project.git_initialized && (
            <span className="studio-git-tag" title="Git initialized">
              <GitBranch size={12} /> git
            </span>
          )}
        </div>
      </div>
      <div className="studio-project-card-actions">
        <button
          type="button"
          className="primary-button studio-open-btn"
          onClick={() => onOpen(project)}
        >
          <Play size={14} />
          Open Builder
        </button>
        <button
          type="button"
          className="icon-button studio-delete-btn"
          onClick={() => onDelete(project)}
          aria-label={`Delete ${project.name}`}
          title={`Delete ${project.name}`}
        >
          Delete
        </button>
      </div>
    </article>
  )
}
