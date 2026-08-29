import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader,
  PhoneCall,
  Play,
  Plus,
  Power,
  Trash2,
  XCircle,
} from 'lucide-react'
import {
  createEveSchedule,
  deleteEveSchedule,
  listEveSchedules,
  runEveScheduleNow,
  updateEveSchedule,
} from '../../lib/eveSchedulesApi'

const TIME_OPTIONS = [
  { value: '0.25', label: '15 minutes' },
  { value: '0.5', label: '30 minutes' },
  { value: '1', label: '1 hour' },
  { value: '2', label: '2 hours' },
  { value: '4', label: '4 hours' },
  { value: '8', label: '8 hours' },
  { value: '24', label: '24 hours' },
]

function formatScheduleTime(schedule) {
  if (schedule.schedule_type === 'recurring') {
    return `Recurring · ${schedule.cron_expression || 'Cron'}`
  }
  const raw = schedule.execute_at || schedule.run_at || schedule.next_run_at
  if (raw) {
    try {
      return `Runs at ${new Date(raw).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`
    } catch {
      return raw
    }
  }
  return 'One-time reminder'
}

export function ScheduledCallsSection() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [runningId, setRunningId] = useState(null)

  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [scheduleType, setScheduleType] = useState('one_time')
  const [timeOffsetHours, setTimeOffsetHours] = useState('1')
  const [cronExpression, setCronExpression] = useState('0 9 * * *')

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listEveSchedules()
      const all = data.schedules || []
      // On Calls page, show only voice_call schedules as "scheduled calls".
      // Fall back to all if none are voice calls to avoid empty confusion.
      const calls = all.filter((s) => s.action_type === 'voice_call')
      setSchedules(calls.length > 0 || all.length === 0 ? calls : calls)
    } catch {
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!title.trim() || !prompt.trim() || isSubmitting) return
    setIsSubmitting(true)
    setError('')
    setActionMessage('')
    try {
      const payload = {
        title: title.trim(),
        prompt: prompt.trim(),
        schedule_type: scheduleType,
        action_type: 'voice_call',
        enabled: true,
      }
      if (scheduleType === 'one_time') {
        const offsetMs = (parseFloat(timeOffsetHours) || 1) * 3600 * 1000
        payload.execute_at = new Date(Date.now() + offsetMs).toISOString()
      } else {
        payload.cron_expression = cronExpression.trim()
        payload.execute_at = null
      }
      await createEveSchedule(payload)
      setTitle('')
      setPrompt('')
      setShowForm(false)
      setActionMessage('Scheduled call created — Eve will call at the set time.')
      await loadSchedules()
    } catch (err) {
      setError(err.message || 'Could not create scheduled call.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteEveSchedule(id)
      setSchedules((prev) => prev.filter((s) => s.id !== id))
      setActionMessage('Scheduled call deleted.')
    } catch (err) {
      setError(err.message || 'Could not delete scheduled call.')
    }
  }

  const handleToggle = async (schedule) => {
    try {
      await updateEveSchedule(schedule.id, { enabled: !schedule.enabled })
      await loadSchedules()
    } catch (err) {
      setError(err.message || 'Could not update schedule.')
    }
  }

  const handleRunNow = async (id) => {
    setRunningId(id)
    setError('')
    setActionMessage('')
    try {
      await runEveScheduleNow(id)
      setActionMessage('Eve is calling now.')
      await loadSchedules()
    } catch (err) {
      setError(err.message || 'Could not trigger call now.')
    } finally {
      setRunningId(null)
    }
  }

  return (
    <section className="calls-scheduled-card" aria-label="Scheduled calls">
      <div className="calls-scheduled-header">
        <div>
          <h2>
            <CalendarClock size={16} />
            Scheduled calls
          </h2>
          <p>Schedule Eve to call you automatically — one-time reminders or recurring check-ins.</p>
        </div>
        <button
          type="button"
          className={showForm ? 'secondary-button' : 'primary-button'}
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus size={14} />
          <span>{showForm ? 'Close' : 'Schedule a call'}</span>
        </button>
      </div>

      {actionMessage && (
        <div className="calls-scheduled-banner success" role="status">
          <CheckCircle2 size={14} />
          <span>{actionMessage}</span>
        </div>
      )}
      {error && (
        <div className="calls-scheduled-banner error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <form className="calls-scheduled-form" onSubmit={handleCreate}>
          <div className="calls-scheduled-form-grid">
            <label className="calls-scheduled-field">
              <span>Title</span>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Daily morning briefing call"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label className="calls-scheduled-field">
              <span>When</span>
              <select
                className="form-input"
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
              >
                <option value="one_time">One-time</option>
                <option value="recurring">Recurring (cron)</option>
              </select>
            </label>
          </div>

          <label className="calls-scheduled-field">
            <span>What should Eve say when she calls?</span>
            <textarea
              className="form-input"
              placeholder="e.g. Give me a briefing on overdue tasks, upcoming calendar events, and stale projects."
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </label>

          {scheduleType === 'one_time' ? (
            <label className="calls-scheduled-field">
              <span>Call me in</span>
              <select
                className="form-input"
                value={timeOffsetHours}
                onChange={(e) => setTimeOffsetHours(e.target.value)}
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="calls-scheduled-field">
              <span>Cron expression (UTC)</span>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="0 9 * * *"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                required
              />
              <small className="calls-scheduled-help">
                Examples: <code>0 9 * * *</code> daily 9 AM UTC, <code>0 9 * * 1-5</code> weekdays 9 AM UTC
              </small>
            </label>
          )}

          <div className="calls-scheduled-actions">
            <button type="button" className="secondary-button" onClick={() => setShowForm(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? <Loader size={14} className="calls-spin" /> : <PhoneCall size={14} />}
              <span>{isSubmitting ? 'Scheduling…' : 'Schedule call'}</span>
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="calls-scheduled-empty">
          <Loader size={18} className="calls-spin" />
          <span>Loading scheduled calls…</span>
        </div>
      ) : schedules.length === 0 ? (
        <div className="calls-scheduled-empty">
          <Clock size={22} />
          <h3>No scheduled calls yet</h3>
          <p>Ask Eve to “call me in 30 minutes” in chat, or schedule one above for an automated voice call.</p>
          {!showForm && (
            <button type="button" className="primary-button" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              <span>Schedule your first call</span>
            </button>
          )}
        </div>
      ) : (
        <div className="calls-scheduled-list" role="list">
          {schedules.map((schedule) => (
            <div key={schedule.id} className={`calls-scheduled-item ${!schedule.enabled ? 'disabled' : ''}`} role="listitem">
              <div className="calls-scheduled-item-main">
                <div className="calls-scheduled-item-title-row">
                  <PhoneCall size={13} />
                  <span className="calls-scheduled-item-title">{schedule.title}</span>
                  <span className={`calls-scheduled-badge ${schedule.schedule_type}`}>{schedule.schedule_type === 'recurring' ? 'Recurring' : 'One-time'}</span>
                  {!schedule.enabled && <span className="calls-scheduled-badge muted">Disabled</span>}
                </div>
                <p className="calls-scheduled-item-prompt">“{schedule.prompt}”</p>
                <div className="calls-scheduled-item-meta">
                  <span>
                    <Clock size={11} />
                    {formatScheduleTime(schedule)}
                  </span>
                  {schedule.next_run_at && schedule.schedule_type === 'recurring' && (
                    <span className="calls-scheduled-next">
                      Next: {new Date(schedule.next_run_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {schedule.last_run_at && (
                    <span className="calls-scheduled-last">Last: {new Date(schedule.last_run_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
              </div>
              <div className="calls-scheduled-item-actions">
                <button
                  type="button"
                  className={`icon-button ${schedule.enabled ? 'active' : ''}`}
                  title={schedule.enabled ? 'Disable' : 'Enable'}
                  onClick={() => handleToggle(schedule)}
                  aria-label={schedule.enabled ? 'Disable scheduled call' : 'Enable scheduled call'}
                >
                  <Power size={13} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  title="Call now"
                  onClick={() => handleRunNow(schedule.id)}
                  disabled={runningId === schedule.id}
                  aria-label="Trigger scheduled call now"
                >
                  {runningId === schedule.id ? <Loader size={13} className="calls-spin" /> : <Play size={13} />}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  title="Delete"
                  onClick={() => handleDelete(schedule.id)}
                  aria-label={`Delete scheduled call ${schedule.title}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="calls-scheduled-footer">
        <XCircle size={12} />
        <span>
          You can also say in Eve chat: “Eve, call me in 20 minutes to review my tasks” or “Call me every weekday at 9am”. Recurring calls run on UTC cron.
        </span>
      </div>
    </section>
  )
}
