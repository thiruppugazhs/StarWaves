export function ModalActions({ children, className = '' }) {
  return <div className={`modal-actions ${className}`.trim()}>{children}</div>
}
