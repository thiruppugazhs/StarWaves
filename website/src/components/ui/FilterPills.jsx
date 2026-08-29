export function FilterPills({
  items = [],
  activeId,
  onChange,
  ariaLabel = 'Filters',
  className = '',
}) {
  return (
    <div className={`filter-pills ${className}`} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const id = typeof item === 'string' ? item : item.id
        const label = typeof item === 'string' ? item : item.label
        const count = typeof item === 'object' ? item.count : undefined
        const Icon = typeof item === 'object' ? item.icon : null
        const isActive = activeId === id

        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`filter-pill-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChange?.(id)}
          >
            {Icon && <Icon size={13} className="filter-pill-icon" aria-hidden="true" />}
            <span className="filter-pill-label">{label}</span>
            {count !== undefined && <span className="filter-pill-count">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
