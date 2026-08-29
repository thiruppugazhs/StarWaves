/** Project metrics — single responsibility: overview metric cards. */
import { MetricGrid } from '../../components/ui'

export function ProjectMetrics({ projects, statusCounts, statusFilter, setStatusFilter }) {
  return (
    <MetricGrid className="workspace-insight-grid project-insight-grid" ariaLabel="Project overview">
      <div
        className={`workspace-insight-card clickable ${statusFilter === 'All' ? 'active-stat-filter' : ''}`}
        onClick={() => setStatusFilter('All')}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => event.key === 'Enter' && setStatusFilter('All')}
      >
        <span>Projects</span>
        <strong>{projects.length}</strong>
        <small>across your workspace</small>
      </div>
      <div
        className={`workspace-insight-card clickable ${statusFilter === 'Active' ? 'active-stat-filter' : ''}`}
        onClick={() => setStatusFilter('Active')}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => event.key === 'Enter' && setStatusFilter('Active')}
      >
        <span>In motion</span>
        <strong>{statusCounts.Active}</strong>
        <small>active builds</small>
      </div>
      <div className="workspace-insight-card">
        <span>Average progress</span>
        <strong>
          {projects.length
            ? `${Math.round(projects.reduce((total, item) => total + Number(item.progress || 0), 0) / projects.length)}%`
            : '—'}
        </strong>
        <small>across all projects</small>
      </div>
    </MetricGrid>
  )
}
