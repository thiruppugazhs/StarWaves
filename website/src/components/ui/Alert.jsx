import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

const VARIANT_ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
}

export function Alert({
  variant = 'info',
  title,
  children,
  icon: CustomIcon,
  onDismiss,
  className = '',
  role,
}) {
  const Icon = CustomIcon || VARIANT_ICONS[variant] || Info
  const defaultRole = variant === 'error' ? 'alert' : 'status'

  return (
    <div
      className={`alert alert-${variant} ${className}`}
      role={role || defaultRole}
    >
      {Icon && (
        <span className="alert-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
      )}
      <div className="alert-content">
        {title && <strong className="alert-title">{title}</strong>}
        {children && <div className="alert-body">{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="alert-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
