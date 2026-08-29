import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function CustomDropdown({ value, options, onChange, ariaLabel, id, className = '', disabled = false }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const generatedId = useId()
  const controlId = id || generatedId
  const selected = options.find((option) => String(option.value) === String(value)) || options[0]

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const selectOption = (option) => {
    onChange(option.value)
    setOpen(false)
  }

  const handleKeyDown = (event) => {
    if (disabled) return
    const index = Math.max(0, options.findIndex((option) => String(option.value) === String(value)))
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const nextIndex = (index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length
      selectOption(options[nextIndex])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen((current) => !current)
    }
  }

  return (
    <div className={`custom-dropdown ${className}`} ref={rootRef}>
      <button id={controlId} type="button" className="custom-dropdown-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={handleKeyDown}>
        <span>{selected?.label}</span><ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && <div className="custom-dropdown-menu" role="listbox" aria-label={ariaLabel}>
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={String(option.value) === String(value)} className={`custom-dropdown-option ${String(option.value) === String(value) ? 'selected' : ''}`} onClick={() => selectOption(option)}>{option.label}</button>)}
      </div>}
    </div>
  )
}
