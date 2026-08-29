import { Check, FileCode, ShieldQuestion, X } from 'lucide-react'
import { setPlanStatus } from '../../lib/studioApi'

export function PlanApprovalCard({ projectId, plan, onResolved }) {
  const resolve = async (status) => {
    try {
      const updated = await setPlanStatus(projectId, status)
      onResolved?.(updated)
    } catch (resolveError) {
      console.error('Could not update plan status:', resolveError)
    }
  }

  return (
    <section className="studio-plan-card" aria-label="Build plan awaiting approval">
      <header className="studio-plan-header">
        <ShieldQuestion size={18} />
        <div>
          <h3>{plan.title}</h3>
          {plan.stack && <span className="studio-stack-tag">{plan.stack}</span>}
          <span className="studio-stack-tag">{plan.db_preference || 'sqlite'}</span>
          {plan.needs_auth && <span className="studio-stack-tag">auth</span>}
        </div>
      </header>

      {plan.summary && <p className="studio-plan-summary">{plan.summary}</p>}

      {plan.files?.length > 0 && (
        <ul className="studio-plan-files">
          {plan.files.map((file) => (
            <li key={file.path}>
              <FileCode size={13} />
              <code>{file.path}</code>
              {file.purpose && <span>{file.purpose}</span>}
            </li>
          ))}
        </ul>
      )}

      <footer className="studio-plan-actions">
        <p>Eve will only start building after you approve this plan.</p>
        <div className="studio-plan-buttons">
          <button type="button" className="secondary-button" onClick={() => resolve('rejected')}>
            <X size={14} />
            Reject
          </button>
          <button type="button" className="primary-button" onClick={() => resolve('approved')}>
            <Check size={14} />
            Approve &amp; Build
          </button>
        </div>
      </footer>
    </section>
  )
}
