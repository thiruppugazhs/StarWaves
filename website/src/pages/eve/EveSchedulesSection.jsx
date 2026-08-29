import { useState, useEffect, useCallback } from 'react'
import {
  CalendarClock,
  Clock,
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  PhoneCall,
  MessageSquare,
} from 'lucide-react'
import { CustomDropdown } from '../../components/ui/CustomDropdown'
import {
  listEveSchedules,
  createEveSchedule,
  deleteEveSchedule,
  runEveScheduleNow,
} from '../../lib/eveSchedulesApi'

export function EveSchedulesSection({ onScheduleTriggered }) {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [runningId, setRunningId] = useState(null)
  const [actionMessage, setActionMessage] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [scheduleType, setScheduleType] = useState('one_time')
  const [actionType, setActionType] = useState('chat_prompt')
  const [timeOffsetHours, setTimeOffsetHours] = useState('1')
  const [cronExpression, setCronExpression] = useState('0 9 * * *')

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listEveSchedules()
      setSchedules(data.schedules || [])
    } catch {
      // Gracefully fall back to empty array if backend endpoint is unavailable
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
        action_type: actionType,
      }

      if (scheduleType === 'one_time') {
        const runAt = new Date(Date.now() + Number(timeOffsetHours) * 3600 * 1000).toISOString()
        payload.run_at = runAt
      } else {
        payload.cron_expression = cronExpression.trim()
      }

      await createEveSchedule(payload)
      setTitle('')
      setPrompt('')
      setShowForm(false)
      setActionMessage('Automated schedule created successfully.')
      await loadSchedules()
      onScheduleTriggered?.()
    } catch (err) {
      setError(err.message || 'Could not create automated schedule.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteEveSchedule(id)
      setActionMessage('Schedule deleted.')
      await loadSchedules()
      onScheduleTriggered?.()
    } catch (err) {
      setError(err.message || 'Could not delete schedule.')
    }
  }

  const handleRunNow = async (id) => {
    setRunningId(id)
    setError('')
    setActionMessage('')
    try {
      await runEveScheduleNow(id)
      setActionMessage('Schedule executed now.')
      await loadSchedules()
      onScheduleTriggered?.()
    } catch (err) {
      setError(err.message || 'Could not run schedule now.')
    } finally {
      setRunningId(null)
    }
  }

  return (
    <section className="eve-subpage-section" aria-label="Eve Automated Schedules">
      <div className="eve-subpage-header">
        <div>
          <h2>Automated Reminders &amp; Schedules</h2>
          <p>
            Schedule recurring check-ins, automated morning briefings, or one-time reminder calls from Eve.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => setShowForm((prev) => !prev)}
        >
          <Plus size={14} />
          <span>{showForm ? 'Close Form' : 'New Schedule'}</span>
        </button>
      </div>

      {actionMessage && (
        <div className="eve-success-banner" role="status">
          <CheckCircle2 size={15} />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="eve-error-banner" role="alert">
          <XCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <div className="eve-schedule-composer-card">
          <h3>
            <CalendarClock size={16} />
            <span>Configure Automated Schedule</span>
          </h3>
          <p>Eve will execute the prompt or initiate a voice call automatically at the specified time.</p>

          <form className="eve-schedule-full-form" onSubmit={handleCreate}>
            <div className="form-group">
              <label className="input-label">Title</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Daily morning workspace plan & briefing"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="input-label">Prompt / Instruction for Eve</label>
              <textarea
                className="form-input"
                placeholder="e.g. Plan my day, summarize overdue tasks, stale projects, and upcoming calendar meetings."
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
              />
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label className="input-label">Action Type</label>
                <CustomDropdown
                  value={actionType}
                  onChange={setActionType}
                  ariaLabel="Action Type"
                  options={[
                    { value: 'chat_prompt', label: 'AI Chat Prompt & Summary' },
                    { value: 'voice_call', label: 'Automated Voice Call (Phone / Audio)' },
                  ]}
                />
              </div>

              <div className="form-group">
                <label className="input-label">Schedule Frequency</label>
                <CustomDropdown
                  value={scheduleType}
                  onChange={setScheduleType}
                  ariaLabel="Schedule Frequency"
                  options={[
                    { value: 'one_time', label: 'One-time Reminder' },
                    { value: 'recurring', label: 'Recurring Schedule (Cron)' },
                  ]}
                />
              </div>
            </div>

            {scheduleType === 'one_time' ? (
              <div className="form-group">
                <label className="input-label">Execute In</label>
                <CustomDropdown
                  value={timeOffsetHours}
                  onChange={setTimeOffsetHours}
                  ariaLabel="Execute In"
                  options={[
                    { value: '0.25', label: '15 minutes' },
                    { value: '0.5', label: '30 minutes' },
                    { value: '1', label: '1 hour' },
                    { value: '2', label: '2 hours' },
                    { value: '4', label: '4 hours' },
                    { value: '8', label: '8 hours' },
                    { value: '24', label: '24 hours (Tomorrow)' },
                  ]}
                />
              </div>
            ) : (
              <div className="form-group">
                <label className="input-label">Cron Expression (UTC)</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  placeholder="0 9 * * *"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  required
                />
                <small className="form-help-text">
                  Examples: <code>0 9 * * *</code> (Daily at 9:00 AM UTC), <code>0 9 * * 1-5</code> (Weekdays at 9:00 AM)
                </small>
              </div>
            )}

            <div className="eve-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={isSubmitting}
              >
                <Plus size={14} />
                <span>{isSubmitting ? 'Saving…' : 'Save Schedule'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="eve-subpage-empty">
          <p>Loading automated schedules…</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="eve-subpage-empty">
          <CalendarClock size={32} />
          <h3>No automated schedules configured</h3>
          <p>
            Create automated reminders above so Eve can summarize your day, check in on project deadlines, or give you a voice briefing.
          </p>
          {!showForm && (
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowForm(true)}
            >
              <Plus size={14} />
              <span>Create your first schedule</span>
            </button>
          )}
        </div>
      ) : (
        <div className="eve-schedules-grid" role="list">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="eve-schedule-card">
              <div className="eve-schedule-card-header">
                <div className="eve-schedule-type-badge">
                  {schedule.action_type === 'voice_call' ? (
                    <>
                      <PhoneCall size={13} />
                      <span>Voice Call</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare size={13} />
                      <span>Chat Prompt</span>
                    </>
                  )}
                </div>

                <div className="eve-card-actions-row">
                  <button
                    type="button"
                    className="eve-card-run-btn"
                    onClick={() => handleRunNow(schedule.id)}
                    disabled={runningId === schedule.id}
                    title="Execute this schedule now"
                  >
                    <Play size={12} />
                    <span>{runningId === schedule.id ? 'Running…' : 'Run now'}</span>
                  </button>
                  <button
                    type="button"
                    className="eve-card-delete-btn"
                    onClick={() => handleDelete(schedule.id)}
                    title="Delete schedule"
                    aria-label={`Delete ${schedule.title}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <h3 className="eve-schedule-card-title">{schedule.title}</h3>
              <p className="eve-schedule-card-prompt">“{schedule.prompt}”</p>

              <div className="eve-schedule-meta">
                <div className="eve-schedule-time">
                  <Clock size={13} />
                  <span>
                    {schedule.schedule_type === 'recurring'
                      ? `Recurring (${schedule.cron_expression || 'Cron'})`
                      : schedule.run_at
                        ? `Runs at ${new Date(schedule.run_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'One-time reminder'}
                  </span>
                </div>
                {schedule.last_run_at && (
                  <span className="eve-schedule-last-run">
                    Last ran {new Date(schedule.last_run_at).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
