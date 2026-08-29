import { useEffect, useState } from 'react'
import { CalendarDays, Check, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { ConfirmDialog, SettingsCard } from '../../components/ui'
import {
  beginGoogleCalendarOAuth,
  loadGoogleCalendarData,
  removeGoogleCalendarAccount,
} from '../../lib/googleCalendar'

export function CalendarSection({ user, onGoogleCalendarsChange }) {
  const [calendarConnections, setCalendarConnections] = useState([])
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [calendarMessage, setCalendarMessage] = useState('')
  const [disconnectAllRequested, setDisconnectAllRequested] = useState(false)
  const [removeRequested, setRemoveRequested] = useState(null)

  useEffect(() => {
    let active = true
    const searchParams = new URLSearchParams(window.location.search)
    const result = searchParams.get('calendar')
    const reason = searchParams.get('reason')
    if (result) {
      setCalendarMessage(
        result === 'connected'
          ? 'Google Calendar connected successfully.'
          : `Google Calendar connection failed: ${reason || 'OAuth authorization failed'}`,
      )
      window.history.replaceState({}, '', window.location.pathname)
    }
    loadGoogleCalendarData()
      .then((data) => {
        if (!active) return
        setCalendarConnections(data.connections)
        onGoogleCalendarsChange(data.events)
      })
      .catch((error) => {
        if (active) setCalendarMessage(error.message)
      })
    return () => {
      active = false
    }
  }, [user?.uid, onGoogleCalendarsChange])

  const addGoogleCalendarAccount = async () => {
    setCalendarBusy(true)
    setCalendarMessage('')
    try {
      await beginGoogleCalendarOAuth()
      const data = await loadGoogleCalendarData()
      setCalendarConnections(data.connections)
      onGoogleCalendarsChange(data.events)
    } catch (error) {
      setCalendarMessage(error.message || 'Google Calendar could not be connected.')
    } finally {
      setCalendarBusy(false)
    }
  }

  const refreshCalendars = async () => {
    setCalendarBusy(true)
    setCalendarMessage('')
    try {
      const result = await loadGoogleCalendarData()
      setCalendarConnections(result.connections)
      onGoogleCalendarsChange(result.events)
      setCalendarMessage('Calendar events refreshed.')
    } catch (error) {
      setCalendarMessage(error.message)
    } finally {
      setCalendarBusy(false)
    }
  }

  const removeCalendarAccount = async (connection) => {
    setCalendarBusy(true)
    setCalendarMessage('')
    try {
      await removeGoogleCalendarAccount(connection.id)
      const result = await loadGoogleCalendarData()
      setCalendarConnections(result.connections)
      onGoogleCalendarsChange(result.events)
      setCalendarMessage(`${connection.email} disconnected.`)
    } catch (error) {
      setCalendarMessage(error.message)
    } finally {
      setCalendarBusy(false)
    }
  }

  const disconnectAllCalendarAccounts = async () => {
    setCalendarBusy(true)
    setCalendarMessage('')
    try {
      await Promise.all(calendarConnections.map((c) => removeGoogleCalendarAccount(c.id)))
      setCalendarConnections([])
      onGoogleCalendarsChange([])
      setCalendarMessage('All Google Calendar accounts disconnected.')
    } catch (error) {
      setCalendarMessage(error.message)
    } finally {
      setCalendarBusy(false)
    }
  }

  return (
    <>
      <SettingsCard
        className="google-calendar-settings-card"
        icon={<CalendarDays size={19} />}
        title="Google Calendar"
        description="Combine calendars from multiple Google accounts"
        action={
          <button
            className={calendarConnections.length > 0 ? 'workspace-connected' : ''}
            onClick={calendarConnections.length > 0 ? () => setDisconnectAllRequested(true) : addGoogleCalendarAccount}
            disabled={calendarBusy}
          >
            {calendarConnections.length > 0 && <Check size={15} />}
            {calendarBusy
              ? calendarConnections.length > 0 ? 'Disconnecting…' : 'Connecting…'
              : calendarConnections.length > 0
                ? 'Disconnect'
                : 'Add Google account'}
          </button>
        }
      >

        <div className="google-calendar-settings-body">
          {calendarConnections.length ? (
            <>
              <div className="google-calendar-account-list">
                {calendarConnections.map((connection) => (
                  <div className="google-calendar-account" key={connection.email}>
                    <span className="google-calendar-avatar">
                      {connection.picture ? (
                        <img src={connection.picture} alt="" />
                      ) : (
                        connection.name[0]?.toUpperCase()
                      )}
                    </span>
                    <div>
                      <strong>{connection.name}</strong>
                      <small>
                        {connection.email} · {connection.calendars.length}{' '}
                        {connection.calendars.length === 1
                          ? 'calendar'
                          : 'calendars'}
                      </small>
                      <div className="google-calendar-chips">
                        {connection.calendars.slice(0, 4).map((calendar) => (
                          <span key={calendar.id}>
                            <i style={{ background: calendar.color }} />
                            {calendar.name}
                          </span>
                        ))}
                        {connection.calendars.length > 4 && (
                          <span>+{connection.calendars.length - 4} more</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="google-calendar-remove"
                      onClick={() => setRemoveRequested(connection)}
                      aria-label={`Disconnect ${connection.email}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="google-calendar-actions">
                <button className="google-calendar-refresh" onClick={refreshCalendars} disabled={calendarBusy}>
                  <RefreshCw size={14} />
                  Refresh all calendars
                </button>
                <button className="google-calendar-add-account" onClick={addGoogleCalendarAccount} disabled={calendarBusy}>
                  <Plus size={14} />
                  Add another account
                </button>
              </div>
            </>
          ) : (
            <p className="google-calendar-empty">
              Add a Google account to import its visible calendars. Add
              another account to merge both into the StarWaves calendar.
            </p>
          )}
          {calendarMessage && <strong role="status">{calendarMessage}</strong>}
        </div>
      </SettingsCard>

      <ConfirmDialog
        isOpen={disconnectAllRequested}
        title="Disconnect integration?"
        message="Disconnect all Google Calendar accounts from StarWaves? You can reconnect them later."
        confirmLabel="Disconnect"
        onCancel={() => setDisconnectAllRequested(false)}
        onConfirm={() => {
          setDisconnectAllRequested(false)
          disconnectAllCalendarAccounts()
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(removeRequested)}
        title="Disconnect integration?"
        message={removeRequested?.email
          ? `Disconnect ${removeRequested.email} from StarWaves? You can reconnect it later.`
          : 'Disconnect this integration from StarWaves? You can reconnect it later.'}
        confirmLabel="Disconnect"
        onCancel={() => setRemoveRequested(null)}
        onConfirm={() => {
          const connection = removeRequested
          setRemoveRequested(null)
          if (connection) removeCalendarAccount(connection)
        }}
      />
    </>
  )
}
