import { LoaderCircle } from 'lucide-react'

export function LoadingState({
  message,
  label,
  icon: Icon = LoaderCircle,
  size = 20,
  className = '',
}) {
  const text = (label || message || 'Loading…').replace(/\s*[.…]{1,3}\s*$/, '')
  return (
    <div className={`loading-state ${className}`} role="status">
      <span className="loading-state-icon">
        <Icon size={size} className="loading-state-spinner" aria-hidden="true" />
      </span>
      {text && (
        <span className="loading-state-text">
          {text}
          <span className="loading-state-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </span>
      )}
    </div>
  )
}
