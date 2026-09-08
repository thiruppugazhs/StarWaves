export function JobPipelineSummary({ jobs, jobStatuses, statusFilter, setStatusFilter }) {
  return (
    <div className="jobs-summary" aria-label="Job pipeline summary">
      {jobStatuses.slice(0, 4).map((status) => (
        <button
          key={status}
          className={`jobs-summary-item ${statusFilter === status ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === status ? 'All' : status)}
        >
          <strong>{jobs.filter((job) => job.status === status).length}</strong>
          <span>{status}</span>
        </button>
      ))}
      <div className="jobs-summary-item jobs-summary-total">
        <strong>{jobs.length}</strong>
        <span>Total tracked</span>
      </div>
    </div>
  )
}
