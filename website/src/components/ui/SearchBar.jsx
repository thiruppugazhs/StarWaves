import { forwardRef, useRef } from 'react'
import { Search, X } from 'lucide-react'

export const SearchBar = forwardRef(function SearchBar(
  {
    value = '',
    onChange,
    onClear,
    placeholder = 'Search...',
    ariaLabel = 'Search',
    className = '',
    iconSize = 14,
    disabled = false,
    autoFocus = false,
    id,
    name,
    onKeyDown,
    ...props
  },
  forwardedRef
) {
  const localRef = useRef(null)
  const inputRef = forwardedRef || localRef

  const handleChange = (event) => {
    onChange?.(event.target.value, event)
  }

  const handleClear = (event) => {
    if (onClear) {
      onClear(event)
    } else {
      onChange?.('', event)
    }
    if (inputRef && 'current' in inputRef && inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleKeyDownInternal = (event) => {
    if (event.key === 'Escape' && value) {
      event.stopPropagation()
      handleClear(event)
    }
    onKeyDown?.(event)
  }

  return (
    <div className={`search-bar ${className} ${disabled ? 'disabled' : ''}`}>
      <Search size={iconSize} className="search-bar-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="search"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDownInternal}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        autoFocus={autoFocus}
        className="search-bar-input"
        autoComplete="off"
        spellCheck="false"
        {...props}
      />
      {Boolean(value) && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="search-bar-clear"
          aria-label="Clear search"
          tabIndex={0}
        >
          <X size={Math.max(14, iconSize - 2)} aria-hidden="true" />
        </button>
      )}
    </div>
  )
})
