import { LoaderCircle } from 'lucide-react'

export function LoadingState({
  message = 'Loading…',
  icon: Icon = LoaderCircle,
  size = 20,
  className = '',
}) {
  return (
    <div className={`loading-state ${className}`} role="status">
      <Icon size={size} className="loading-state-spinner" aria-hidden="true" />
      {message && <span className="loading-state-text">{message}</span>}
    </div>
  )
}
