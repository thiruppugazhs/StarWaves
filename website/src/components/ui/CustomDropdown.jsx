import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

export function CustomDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  id,
  className = '',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search…',
}) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const rootRef = useRef(null)
  const searchInputRef = useRef(null)
  const generatedId = useId()
  const controlId = id || generatedId
  const selected = options.find((option) => String(option.value) === String(value)) || options[0]

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setSearchQuery('')
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (open && searchable && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [open, searchable])

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options
    const query = searchQuery.trim().toLowerCase()
    return options.filter((option) =>
      String(option.label || option.value).toLowerCase().includes(query),
    )
  }, [options, searchable, searchQuery])

  const selectOption = (option) => {
    onChange(option.value)
    setOpen(false)
    setSearchQuery('')
  }

  const handleKeyDown = (event) => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const index = Math.max(0, filteredOptions.findIndex((option) => String(option.value) === String(value)))
      const nextIndex = (index + (event.key === 'ArrowDown' ? 1 : filteredOptions.length - 1)) % Math.max(1, filteredOptions.length)
      if (filteredOptions[nextIndex]) {
        selectOption(filteredOptions[nextIndex])
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (event.target === searchInputRef.current) return
      event.preventDefault()
      setOpen((current) => !current)
      if (open) setSearchQuery('')
    }
  }

  return (
    <div className={`custom-dropdown ${className}`} ref={rootRef}>
      <button
        id={controlId}
        type="button"
        className="custom-dropdown-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setOpen((current) => !current)
          if (open) setSearchQuery('')
        }}
        onKeyDown={handleKeyDown}
      >
        <span>{selected?.label}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="custom-dropdown-menu" role="listbox" aria-label={ariaLabel}>
          {searchable && (
            <div className="custom-dropdown-search" onClick={(e) => e.stopPropagation()}>
              <Search size={13} className="custom-dropdown-search-icon" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                className="custom-dropdown-search-input"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={searchPlaceholder}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="custom-dropdown-search-clear"
                  onClick={() => {
                    setSearchQuery('')
                    searchInputRef.current?.focus()
                  }}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
          <div className="custom-dropdown-options-list">
            {filteredOptions.length === 0 ? (
              <div className="custom-dropdown-empty">No matching options</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={String(option.value) === String(value)}
                  className={`custom-dropdown-option ${String(option.value) === String(value) ? 'selected' : ''}`}
                  onClick={() => selectOption(option)}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
