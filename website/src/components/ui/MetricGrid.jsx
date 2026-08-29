export function MetricGrid({
  children,
  ariaLabel = 'Key metrics overview',
  className = '',
}) {
  return (
    <div className={`metric-grid ${className}`} aria-label={ariaLabel}>
      {children}
    </div>
  )
}
