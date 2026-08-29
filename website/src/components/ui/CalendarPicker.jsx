import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function isSameDay(first, second) {
  return first && second && first.toDateString() === second.toDateString()
}

function buildDays(month) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = new Date(start)
  gridStart.setDate(1 - start.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
}

export function CalendarPicker({ value = null, onChange, placeholder = 'dd------yyyy' }) {
  const rootRef = useRef(null)
  const today = useMemo(() => new Date(), [])
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => new Date((value || today).getFullYear(), (value || today).getMonth(), 1))

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  const days = useMemo(() => buildDays(month), [month])
  const displayValue = value
    ? value.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

  const moveMonth = (offset) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  const selectDate = (date) => {
    onChange?.(date)
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setOpen(false)
  }

  return (
    <div className="calendar-picker" ref={rootRef}>
      <button type="button" className="calendar-picker-input" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span className={displayValue ? '' : 'calendar-picker-placeholder'}>{displayValue || placeholder}</span>
        <ChevronDown size={16} className={open ? 'chevron-open' : ''} />
      </button>
      {open && (
        <div className="calendar-picker-popover" role="dialog" aria-label="Choose a date">
          <div className="calendar-picker-header">
            <strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
            <div>
              <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="calendar-picker-weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-picker-days">
            {days.map((date) => (
              <button
                key={date.toISOString()}
                className={`${date.getMonth() === month.getMonth() ? '' : 'outside-month'} ${isSameDay(date, value) ? 'selected' : ''} ${isSameDay(date, today) ? 'today' : ''}`}
                onClick={() => selectDate(date)}
              >{date.getDate()}</button>
            ))}
          </div>
          <div className="calendar-picker-footer">
            <button type="button" onClick={() => { onChange?.(null); setOpen(false) }}>Clear</button>
            <button type="button" onClick={() => selectDate(today)}>Today</button>
          </div>
        </div>
      )}
    </div>
  )
}
