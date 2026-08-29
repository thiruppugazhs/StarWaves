import { RotateCcw } from 'lucide-react'

export function FilterBar({
  search,
  filters,
  actions,
  onReset,
  isFiltered = false,
  resetLabel = 'Reset',
  className = '',
  children,
}) {
  return (
    <div className={`filter-bar ${className}`}>
      {search && <div className="filter-bar-search">{search}</div>}
      {filters && (
        <div className="filter-bar-group">
          {filters}
          {isFiltered && onReset && (
            <button
              type="button"
              className="filter-bar-reset"
              onClick={onReset}
              aria-label="Reset all filters"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>{resetLabel}</span>
            </button>
          )}
        </div>
      )}
      {children}
      {actions && <div className="filter-bar-actions">{actions}</div>}
    </div>
  )
}
