import '../styles/pages/calendar-grid.css'
import { useEffect, useMemo, useState } from 'react'
import { usePersistentState } from '../hooks/usePersistentState'
import { CalendarDetailPanel } from './calendar/CalendarDetailPanel'
import { CalendarMonthView } from './calendar/CalendarMonthView'
import { CalendarToolbar } from './calendar/CalendarToolbar'
import { buildCalendarDays, weekDays } from './calendar/calendarUtils'

export function CalendarPage({ eventsByDate, onNavigate }) {
  const today = useMemo(() => new Date(), [])
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [selectedDate, setSelectedDate] = useState(null)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [calendarView, setCalendarView] = usePersistentState('starwaves.calendar.view', 'days')
  const [pickerDate, setPickerDate] = useState(null)
  const [focusedEventId, setFocusedEventId] = useState(null)
  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth])
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => ({
        value: month,
        label: new Date(2024, month, 1).toLocaleDateString(undefined, {
          month: 'long',
        }),
      })),
    [],
  )

  useEffect(() => {
    const rawFocus = localStorage.getItem('starwaves.calendar-focus')
    if (!rawFocus) return
    try {
      const focus = JSON.parse(rawFocus)
      const focusDate = new Date(`${focus.dateKey}T00:00:00`)
      if (Number.isNaN(focusDate.getTime())) return
      setVisibleMonth(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1))
      setSelectedDate(focusDate)
      setFocusedEventId(focus.targetId)
      localStorage.removeItem('starwaves.calendar-focus')
    } catch {
      localStorage.removeItem('starwaves.calendar-focus')
    }
  }, [])

  useEffect(() => {
    if (!focusedEventId) return
    const target = document.querySelector(`[data-record-id="${CSS.escape(focusedEventId)}"]`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('notification-target-highlight')
    const timer = window.setTimeout(() => target.classList.remove('notification-target-highlight'), 1600)
    return () => window.clearTimeout(timer)
  }, [focusedEventId, selectedDate])

  const yearBlockStart = Math.floor(visibleMonth.getFullYear() / 12) * 12
  const calendarTitle =
    calendarView === 'days'
      ? visibleMonth.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
      : calendarView === 'months'
        ? String(visibleMonth.getFullYear())
        : `${yearBlockStart} – ${yearBlockStart + 11}`

  const changeMonth = (offset) => {
    setVisibleMonth((current) => {
      if (calendarView === 'months') {
        return new Date(current.getFullYear() + offset, current.getMonth(), 1)
      }
      if (calendarView === 'years') {
        return new Date(current.getFullYear() + offset * 12, current.getMonth(), 1)
      }
      return new Date(current.getFullYear(), current.getMonth() + offset, 1)
    })
  }

  const selectView = (view) => {
    setCalendarView(view)
    setViewMenuOpen(false)
  }

  const goToToday = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
    setCalendarView('days')
  }

  return (
    <section className="calendar-page">
      <CalendarToolbar
        calendarTitle={calendarTitle}
        pickerDate={pickerDate}
        onPickerChange={(date) => {
          setPickerDate(date)
          if (date) {
            setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1))
            setCalendarView('days')
          }
        }}
        calendarView={calendarView}
        onSelectView={selectView}
        viewMenuOpen={viewMenuOpen}
        onToggleViewMenu={() => setViewMenuOpen((open) => !open)}
        onPrev={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
        onToday={goToToday}
      />

      {calendarView === 'days' && (
        <CalendarMonthView
          days={days}
          today={today}
          eventsByDate={eventsByDate}
          onSelectDate={setSelectedDate}
        />
      )}

      {calendarView === 'months' && (
        <div className="calendar-months-grid">
          {months.map((month) => {
            const year = visibleMonth.getFullYear()
            const firstWeekday = new Date(year, month.value, 1).getDay()
            const numberOfDays = new Date(year, month.value + 1, 0).getDate()

            return (
              <button
                className={`calendar-month-card ${
                  today.getFullYear() === year &&
                  today.getMonth() === month.value
                    ? 'current'
                    : ''
                }`}
                key={month.value}
                onClick={() => {
                  setVisibleMonth(new Date(year, month.value, 1))
                  setCalendarView('days')
                }}
              >
                <strong>{month.label}</strong>
                <div className="mini-calendar-weekdays">
                  {weekDays.map((day) => (
                    <span key={day}>{day[0]}</span>
                  ))}
                </div>
                <div className="mini-calendar-days">
                  {Array.from({ length: firstWeekday }, (_, index) => (
                    <span key={`blank-${index}`} />
                  ))}
                  {Array.from({ length: numberOfDays }, (_, index) => {
                    const day = index + 1
                    const isToday =
                      today.getFullYear() === year &&
                      today.getMonth() === month.value &&
                      today.getDate() === day
                    return (
                      <span className={isToday ? 'today' : ''} key={day}>
                        {day}
                      </span>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {calendarView === 'years' && (
        <div className="calendar-years-grid">
          {Array.from({ length: 12 }, (_, index) => yearBlockStart + index).map(
            (year) => (
              <button
                className={today.getFullYear() === year ? 'current' : ''}
                key={year}
                onClick={() => {
                  setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1))
                  setCalendarView('months')
                }}
              >
                <span>{year}</span>
                {today.getFullYear() === year && <small>Current year</small>}
              </button>
            ),
          )}
        </div>
      )}

      {selectedDate && (
        <CalendarDetailPanel
          selectedDate={selectedDate}
          eventsByDate={eventsByDate}
          onClose={() => setSelectedDate(null)}
          onNavigate={onNavigate}
        />
      )}
    </section>
  )
}
