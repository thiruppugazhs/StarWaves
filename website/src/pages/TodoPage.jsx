import "../styles/pages/todo.css"
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { createTodo, deleteTodo, updateTodo } from '../lib/todosApi'
import { Alert, ConfirmDialog, EmptyState, FilterBar, FilterPills, Modal, SearchBar } from '../components/ui'
import { usePersistentState } from '../hooks/usePersistentState'

export function TodoPage({ tasks, setTasks, createIntent }) {
  const [newTask, setNewTask] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = usePersistentState('starwaves.todo.filter', 'all')
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [taskSaving, setTaskSaving] = useState(false)
  const [taskError, setTaskError] = useState('')
  const [deleteRequested, setDeleteRequested] = useState(null)

  const [editingTask, setEditingTask] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    if (createIntent?.type === 'todo') setTaskFormOpen(true)
  }, [createIntent?.requestId, createIntent?.type])

  const visibleTasks = useMemo(() => {
    let result = tasks
    if (filter === 'active') result = result.filter((task) => !task.completed)
    else if (filter === 'completed') result = result.filter((task) => task.completed)

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((task) => task.title.toLowerCase().includes(q))
    }
    return result
  }, [filter, searchQuery, tasks])

  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isOverdue = (task) => !task.completed && Boolean(task.dueDate) && task.dueDate < todayKey
  const doneCount = tasks.filter((task) => task.completed).length
  const overdueCount = tasks.filter(isOverdue).length
  const donePercent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0

  const addTask = async (event) => {
    event.preventDefault()
    const title = newTask.trim()
    if (!title) return
    setTaskSaving(true)
    setTaskError('')
    try {
      const created = await createTodo({ title, dueDate })
      setTasks((current) => [created, ...current])
      setNewTask('')
      setDueDate('')
      setTaskFormOpen(false)
    } catch (error) {
      setTaskError(error.message)
    } finally {
      setTaskSaving(false)
    }
  }

  const openEditModal = (task) => {
    setEditingTask(task)
    setEditTitle(task.title || '')
    setEditDueDate(task.dueDate || '')
    setEditError('')
  }

  const saveTaskEdit = async (event) => {
    event.preventDefault()
    if (!editingTask) return
    const title = editTitle.trim()
    if (!title) return
    setEditSaving(true)
    setEditError('')
    try {
      const updated = await updateTodo(editingTask.id, { title, dueDate: editDueDate })
      setTasks((current) =>
        current.map((item) => (item.id === editingTask.id ? updated : item)),
      )
      setEditingTask(null)
    } catch (error) {
      setEditError(error.message)
    } finally {
      setEditSaving(false)
    }
  }

  const toggleTask = async (id) => {
    const task = tasks.find((item) => item.id === id)
    if (!task) return
    setTaskError('')
    try {
      const updated = await updateTodo(id, { completed: !task.completed })
      setTasks((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      )
    } catch (error) {
      setTaskError(error.message)
    }
  }

  const removeTask = async () => {
    const task = deleteRequested
    if (!task) return
    setDeleteRequested(null)
    setTaskError('')
    try {
      await deleteTodo(task.id)
      setTasks((current) => current.filter((item) => item.id !== task.id))
    } catch (error) {
      setTaskError(error.message)
    }
  }

  return (
    <section className="todo-page">
      <FilterBar
        className="todo-toolbar"
        search={
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search tasks by title..."
            ariaLabel="Search tasks"
          />
        }
        filters={
          <FilterPills
            className="todo-filters"
            ariaLabel="Filter tasks"
            items={[
              { id: 'all', label: 'All', count: tasks.length },
              { id: 'active', label: 'Active', count: tasks.filter((t) => !t.completed).length },
              { id: 'completed', label: 'Completed', count: tasks.filter((t) => t.completed).length },
            ]}
            activeId={filter}
            onChange={setFilter}
          />
        }
        actions={
          <button
            className="primary-button todo-add-trigger"
            type="button"
            onClick={() => setTaskFormOpen(true)}
          >
            <Plus size={15} />
            Add task
          </button>
        }
        isFiltered={Boolean(searchQuery || filter !== 'all')}
        onReset={() => {
          setSearchQuery('')
          setFilter('all')
        }}
      />

      {taskError && (
        <Alert variant="error" onDismiss={() => setTaskError('')}>
          {taskError}
        </Alert>
      )}

      {tasks.length > 0 && (
        <div className="todo-progress" role="status">
          <div className="todo-progress-track">
            <i style={{ '--progress': `${donePercent}%` }} />
          </div>
          <span>
            {doneCount} of {tasks.length} done
            {overdueCount > 0 && ` · ${overdueCount} overdue`}
          </span>
        </div>
      )}

      {visibleTasks.length ? (
        <div className="todo-list">
          {visibleTasks.map((task) => (
            <div
              className={`todo-item ${task.completed ? 'completed' : ''} ${isOverdue(task) ? 'is-overdue' : ''}`}
              data-record-id={task.id}
              key={task.id}
            >
              <button
                type="button"
                className="todo-check"
                onClick={() => toggleTask(task.id)}
                aria-label={`${task.completed ? 'Mark active' : 'Complete'} ${task.title}`}
              >
                {task.completed && <Check size={12} strokeWidth={2.5} />}
              </button>
              <div className="todo-item-copy">
                <span>{task.title}</span>
                {isOverdue(task) && <em className="todo-overdue-flag">Overdue</em>}
                {task.dueDate && (
                  <small>
                    <CalendarDays size={12} />
                    {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(
                      undefined,
                      { day: 'numeric', month: 'short', year: 'numeric' },
                    )}
                  </small>
                )}
              </div>
              <div className="todo-item-actions">
                <button
                  className="todo-delete"
                  type="button"
                  onClick={() => openEditModal(task)}
                  aria-label={`Edit ${task.title}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="todo-delete"
                  type="button"
                  onClick={() => setDeleteRequested(task)}
                  aria-label={`Delete ${task.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={searchQuery ? Search : Check}
          title={searchQuery ? 'No tasks match' : 'No tasks here'}
          description={
            searchQuery
              ? `Nothing matches “${searchQuery.trim()}”. Try a different search or filter.`
              : filter === 'all'
                ? 'Create your first task to get started.'
                : `No ${filter} tasks. Try a different filter.`
          }
          action={
            searchQuery || filter !== 'all' ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setFilter('all')
                }}
              >
                Clear filters
              </button>
            ) : null
          }
        />
      )}

      <Modal
        isOpen={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        className="todo-modal"
        subtitle="New task"
        title="What needs to be done?"
      >
        <form className="todo-modal-form" onSubmit={addTask}>
          <label htmlFor="task-title">Task name</label>
          <input
            id="task-title"
            value={newTask}
            onChange={(event) => setNewTask(event.target.value)}
            placeholder="Enter a task"
            data-modal-initial-focus
            disabled={taskSaving}
          />
          <label htmlFor="task-date">Due date (optional)</label>
          <input
            id="task-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            disabled={taskSaving}
          />
          {taskError && (
            <Alert variant="error" onDismiss={() => setTaskError('')}>
              {taskError}
            </Alert>
          )}
          <div className="todo-modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setTaskFormOpen(false)}
              disabled={taskSaving}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={taskSaving}>
              <Plus size={17} />
              {taskSaving ? 'Saving…' : 'Add task'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        className="todo-modal"
        subtitle="Edit task"
        title="Update details"
      >
        <form className="todo-modal-form" onSubmit={saveTaskEdit}>
          <label htmlFor="edit-task-title-input">Task name</label>
          <input
            id="edit-task-title-input"
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            placeholder="Enter task name"
            data-modal-initial-focus
            disabled={editSaving}
            required
          />
          <label htmlFor="edit-task-date-input">Due date (optional)</label>
          <input
            id="edit-task-date-input"
            type="date"
            value={editDueDate}
            onChange={(event) => setEditDueDate(event.target.value)}
            disabled={editSaving}
          />
          {editError && (
            <Alert variant="error" onDismiss={() => setEditError('')}>
              {editError}
            </Alert>
          )}
          <div className="todo-modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditingTask(null)}
              disabled={editSaving}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(deleteRequested)}
        title="Delete task?"
        message={deleteRequested ? `“${deleteRequested.title}” will be permanently deleted.` : ''}
        confirmLabel="Delete task"
        onCancel={() => setDeleteRequested(null)}
        onConfirm={removeTask}
      />
    </section>
  )
}
