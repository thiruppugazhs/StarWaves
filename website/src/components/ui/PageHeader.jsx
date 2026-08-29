export function PageHeader({ eyebrow, title, description, actions, className = '' }) {
  return (
    <div className={`page-heading ${className}`.trim()}>
      <div>
        {eyebrow && <p>{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <span className="page-heading-description">{description}</span>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </div>
  )
}
