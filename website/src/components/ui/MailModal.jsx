import { useEffect, useRef } from 'react'

export function MailModal({ labelledBy, onClose, className = '', children }) {
  const cardRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const appRoot = document.getElementById('root')
    const previousOverflow = document.body.style.overflow
    appRoot?.setAttribute('inert', '')
    document.body.style.overflow = 'hidden'

    window.requestAnimationFrame(() => cardRef.current?.focus())

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      appRoot?.removeAttribute('inert')
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div className="mail-modal" onMouseDown={onClose}>
      <div
        ref={cardRef}
        className={`mail-card ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}