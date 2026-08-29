import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  Clock,
  Loader,
  MessageSquare,
  PhoneCall,
  Play,
  Plus,
  Power,
  Trash2,
} from 'lucide-react'
import {
  createEveSchedule,
  deleteEveSchedule,
  listEveSchedules,
  runEveScheduleNow,
  updateEveSchedule,
} from '../../lib/eveSchedulesApi'

export function EveSchedulesCard({ onScheduleTriggered }) {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [runningId, setRunningId] = useState(null)

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
      // Gracefully fall back to empty array if backend schedules endpoint is unavailable or redeploying
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
    try {
      const now = new Date()
      let executeAt = null
      if (scheduleType === 'one_time') {
        const offsetMs = (parseFloat(timeOffsetHours) || 1) * 3600 * 1000
        executeAt = new Date(now.getTime() + offsetMs).toISOString()
      }

      await createEveSchedule({
        title: title.trim(),
        prompt: prompt.trim(),
        schedule_type: scheduleType,
        action_type: actionType,
        execute_at: executeAt,
        cron_expression: scheduleType === 'recurring' ? cronExpression : null,
        enabled: true,
      })

      setTitle('')
      setPrompt('')
      setShowForm(false)
      loadSchedules()
    } catch (err) {
      setError(err.message || 'Could not create schedule.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (schedule) => {
    try {
      await updateEveSchedule(schedule.id, { enabled: !schedule.enabled })
      loadSchedules()
    } catch (err) {
      setError(err.message || 'Could not update schedule status.')
    }
  }

  const handleDelete = async (scheduleId) => {
    try {
      await deleteEveSchedule(scheduleId)
      setSchedules((current) => current.filter((s) => s.id !== scheduleId))
    } catch (err) {
      setError(err.message || 'Could not delete schedule.')
    }
  }

  const handleRunNow = async (scheduleId) => {
    setRunningId(scheduleId)
    setError('')
    try {
      await runEveScheduleNow(scheduleId)
      onScheduleTriggered?.()
      loadSchedules()
    } catch (err) {
      setError(err.message || 'Execution failed.')
    } finally {
      setRunningId(null)
    }
  }

  return (
    <div className="eve-sidebar-card eve-schedules-card">
      <div className="eve-card-header">
        <h3>
          <Clock size={15} />
          Automated Reminders & Schedules
        </h3>
        <button
          type="button"
          className="icon-button"
          onClick={() => setShowForm((prev) => !prev)}
          title="Add automated schedule"
        >
          <Plus size={14} />
        </button>
      </div>

      <p className="eve-sidebar-desc">
        Set automated prompts or voice calls for Eve to execute on a schedule or reminder.
      </p>

      {error && (
        <div className="eve-error-banner" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <form className="eve-schedule-form" onSubmit={handleCreate}>
          <div className="form-field">
            <label className="input-label">Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Daily morning workspace plan"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="input-label">Eve Prompt / Action</label>
            <textarea
              className="form-input"
              placeholder="e.g. Plan my day, summarize overdue tasks and stale projects"
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="input-label">Action Type</label>
              <select
                className="form-input"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
              >
                <option value="chat_prompt">AI Chat Prompt</option>
                <option value="voice_call">Eve Voice Call</option>
              </select>
            </div>

            <div className="form-field">
              <label className="input-label">Schedule</label>
              <select
                className="form-input"
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
              >
                <option value="one_time">One-time Reminder</option>
                <option value="recurring">Recurring Cron</option>
              </select>
            </div>
          </div>

          {scheduleType === 'one_time' ? (
            <div className="form-field">
              <label className="input-label">Run In (Hours)</label>
              <select
                className="form-input"
                value={timeOffsetHours}
                onChange={(e) => setTimeOffsetHours(e.target.value)}
              >
                <option value="0.25">15 minutes</option>
                <option value="0.5">30 minutes</option>
                <option value="1">1 hour</option>
                <option value="3">3 hours</option>
                <option value="6">6 hours</option>
                <option value="24">24 hours</option>
              </select>
            </div>
          ) : (
            <div className="form-field">
              <label className="input-label">Cron Expression</label>
              <input
                type="text"
                className="form-input"
                placeholder="0 9 * * * (9:00 AM daily)"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
              />
            </div>
          )}

          <div className="eve-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowForm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? <Loader size={14} className="calls-spin" /> : 'Save Schedule'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="eve-sidebar-desc">Loading schedules…</p>
      ) : schedules.length === 0 ? (
        <p className="eve-sidebar-desc">No automated schedules configured.</p>
      ) : (
        <div className="eve-schedule-list" role="list">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className={`eve-schedule-item ${!schedule.enabled ? 'disabled' : ''}`}
            >
              <div className="eve-schedule-main">
                <div className="eve-schedule-title-row">
                  <span className="eve-schedule-title">{schedule.title}</span>
                  <span className="eve-schedule-badge">
                    {schedule.action_type === 'voice_call' ? (
                      <PhoneCall size={12} />
                    ) : (
                      <MessageSquare size={12} />
                    )}
                    {schedule.schedule_type}
                  </span>
                </div>
                <p className="eve-schedule-prompt">{schedule.prompt}</p>
                {schedule.next_run_at && (
                  <span className="eve-schedule-time">
                    <Calendar size={11} /> Next: {new Date(schedule.next_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <div className="eve-schedule-actions">
                <button
                  type="button"
                  className={`icon-button ${schedule.enabled ? 'active' : ''}`}
                  title={schedule.enabled ? 'Disable schedule' : 'Enable schedule'}
                  onClick={() => handleToggle(schedule)}
                >
                  <Power size={13} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  title="Run now (test)"
                  onClick={() => handleRunNow(schedule.id)}
                  disabled={runningId === schedule.id}
                >
                  {runningId === schedule.id ? (
                    <Loader size={13} className="calls-spin" />
                  ) : (
                    <Play size={13} />
                  )}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  title="Delete schedule"
                  onClick={() => handleDelete(schedule.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
