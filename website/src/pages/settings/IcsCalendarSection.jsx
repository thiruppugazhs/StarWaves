import { FileUp, Trash2, Upload } from 'lucide-react'
import { parseIcsContent } from '../../utils/icsParser'
import { SettingsCard } from '../../components/ui'

export function IcsCalendarSection({
  importedIcsCalendars = [],
  setImportedIcsCalendars,
  setImportedIcsEvents,
}) {
  const handleIcsFileUpload = (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target.result
        const calId = `ics-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        const calName = file.name.replace(/\.ics$/i, '')
        const parsed = parseIcsContent(text, calName, calId)
        if (parsed.events.length) {
          if (setImportedIcsCalendars) {
            setImportedIcsCalendars((current) => [...current, parsed.calendar])
          }
          if (setImportedIcsEvents) {
            setImportedIcsEvents((current) => [...current, ...parsed.events])
          }
        }
      }
      reader.readAsText(file)
    })
    event.target.value = ''
  }

  const removeImportedIcsCalendar = (calendarId) => {
    if (setImportedIcsCalendars) {
      setImportedIcsCalendars((current) => current.filter((c) => c.id !== calendarId))
    }
    if (setImportedIcsEvents) {
      setImportedIcsEvents((current) => current.filter((e) => e.calendarId !== calendarId))
    }
  }

  return (
    <SettingsCard
      className="ics-calendar-settings-card"
      icon={<FileUp size={19} />}
      title="Imported Calendar Files (.ics)"
      description="Import multiple iCal / .ics files to view external calendar events"
      action={
        <label className="ics-upload-button">
          <Upload size={15} />
          <span>Import .ics file</span>
          <input
            type="file"
            accept=".ics,text/calendar"
            multiple
            onChange={handleIcsFileUpload}
            style={{ display: 'none' }}
          />
        </label>
      }
    >
      <div className="google-calendar-settings-body">
        {importedIcsCalendars.length ? (
          <div className="google-calendar-account-list">
            {importedIcsCalendars.map((cal) => (
              <div className="google-calendar-account" key={cal.id}>
                <span className="google-calendar-avatar">
                  <FileUp size={16} />
                </span>
                <div>
                  <strong>{cal.name}</strong>
                  <small>{cal.eventCount} {cal.eventCount === 1 ? 'event' : 'events'} imported</small>
                </div>
                <button
                  className="google-calendar-remove"
                  onClick={() => removeImportedIcsCalendar(cal.id)}
                  aria-label={`Remove ${cal.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="google-calendar-empty">
            Upload .ics calendar files from Apple Calendar, Outlook, or Google Calendar exports.
          </p>
        )}
      </div>
    </SettingsCard>
  )
}
