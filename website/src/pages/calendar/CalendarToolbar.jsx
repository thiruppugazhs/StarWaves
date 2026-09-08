import '../../styles/pages/calendar-toolbar.css'
import { ChevronDown } from 'lucide-react'
import { CalendarPicker, Pagination } from '../../components/ui'

const VIEW_OPTIONS = [
  ['days', 'Days', 'Full monthly calendar'],
  ['months', 'Months', 'All months in the year'],
  ['years', 'Years', 'Quick year navigation'],
]

export function CalendarToolbar({
  calendarTitle,
  pickerDate,
  onPickerChange,
  calendarView,
  onSelectView,
  viewMenuOpen,
  onToggleViewMenu,
  onPrev,
  onNext,
  onToday,
}) {
  return (
    <div className="calendar-toolbar">
      <div>
        <p className="calendar-eyebrow">Calendar</p>
        <h1>{calendarTitle}</h1>
      </div>

      <div className="calendar-actions">
        <button className="secondary-button" type="button" onClick={onToday}>
          Today
        </button>
        <CalendarPicker value={pickerDate} onChange={onPickerChange} />
        <div className="calendar-view-switcher">
          <button
            className="calendar-view-button"
            onClick={onToggleViewMenu}
            aria-expanded={viewMenuOpen}
          >
            {calendarView[0].toUpperCase() + calendarView.slice(1)}
            <ChevronDown
              className={viewMenuOpen ? 'chevron-open' : ''}
              size={14}
            />
          </button>
          {viewMenuOpen && (
            <div className="calendar-view-menu">
              {VIEW_OPTIONS.map(([value, label, description]) => (
                <button
                  className={calendarView === value ? 'active' : ''}
                  key={value}
                  onClick={() => onSelectView(value)}
                >
                  <span>{label}</span>
                  <small>{description}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <Pagination
          className="calendar-pagination"
          ariaLabel="Calendar navigation"
          onPrev={onPrev}
          onNext={onNext}
        />
        <span className="calendar-readonly-note">Events are managed by their source calendars</span>
      </div>
    </div>
  )
}
