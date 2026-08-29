import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({
  onPrev,
  onNext,
  hasPrev = true,
  hasNext = true,
  disabled = false,
  currentPage,
  totalPages,
  ariaLabel = 'Pagination navigation',
  className = '',
  children,
}) {
  return (
    <nav className={`pagination ${className}`} aria-label={ariaLabel}>
      <button
        type="button"
        className="pagination-btn pagination-prev"
        onClick={onPrev}
        disabled={disabled || !hasPrev}
        aria-label="Previous page"
      >
        <ChevronLeft size={17} aria-hidden="true" />
      </button>
      {children ? (
        children
      ) : currentPage !== undefined ? (
        <span className="pagination-indicator">
          {totalPages !== undefined ? `${currentPage} / ${totalPages}` : currentPage}
        </span>
      ) : null}
      <button
        type="button"
        className="pagination-btn pagination-next"
        onClick={onNext}
        disabled={disabled || !hasNext}
        aria-label="Next page"
      >
        <ChevronRight size={17} aria-hidden="true" />
      </button>
    </nav>
  )
}
