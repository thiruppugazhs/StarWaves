import '../../styles/pages/calendar-grid.css'
import { CalendarDays } from 'lucide-react'
import { calendarDateKey } from '../../utils/calendarEvents'
import { isSameDay, weekDays } from './calendarUtils'

export function CalendarMonthView({ days, today, eventsByDate, onSelectDate }) {
  return (
    <>
      <div className="calendar-grid">
        {weekDays.map((day) => (
          <div className="calendar-weekday" key={day}>
            {day}
          </div>
        ))}

        {days.map(({ date, isCurrentMonth }) => {
          const isToday = isSameDay(date, today)
          const dayItems = eventsByDate.get(calendarDateKey(date)) ?? []

          return (
            <button
              className={`calendar-day ${isCurrentMonth ? '' : 'outside-month'} ${
                isToday ? 'today' : ''
              }`}
              key={date.toISOString()}
              onClick={() => onSelectDate(date)}
              aria-label={date.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            >
              <span>{date.getDate()}</span>
              <div className="calendar-events">
                {dayItems.slice(0, 2).map((item) => (
                  <div
                    className={`calendar-event ${item.className}`}
                    key={item.id}
                    title={item.label}
                  >
                    {item.label}
                  </div>
                ))}
                {dayItems.length > 2 && (
                  <small>+{dayItems.length - 2} more</small>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <div className="calendar-mobile-agenda" aria-label="Monthly agenda">
        {days
          .filter(({ date, isCurrentMonth }) =>
            isCurrentMonth && (eventsByDate.get(calendarDateKey(date))?.length ?? 0) > 0,
          )
          .map(({ date }) => {
            const dayItems = eventsByDate.get(calendarDateKey(date)) ?? []
            return (
              <button
                type="button"
                className="calendar-agenda-day"
                key={date.toISOString()}
                onClick={() => onSelectDate(date)}
              >
                <span>
                  <strong>{date.getDate()}</strong>
                  <small>{date.toLocaleDateString(undefined, { month: 'short', weekday: 'short' })}</small>
                </span>
                <span>
                  {dayItems.slice(0, 3).map((item) => (
                    <small key={item.id}>{item.label}</small>
                  ))}
                  {dayItems.length > 3 && <small>+{dayItems.length - 3} more</small>}
                </span>
              </button>
            )
          })}
        {!(days || []).some(({ date, isCurrentMonth }) =>
          isCurrentMonth && (eventsByDate.get(calendarDateKey(date))?.length ?? 0) > 0,
        ) && (
          <div className="calendar-agenda-empty">
            <CalendarDays size={22} />
            <strong>No activity this month</strong>
            <span>Tasks, events, contests, and deadlines will appear here.</span>
          </div>
        )}
      </div>
    </>
  )
}
