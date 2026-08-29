import { apiRequest } from './request'

const BASE_PATH = '/todos'
const ERROR_MESSAGE = 'The todo database is unavailable.'
const TOKEN_MESSAGE = 'Sign in to access your todo list.'

function request(path = '', options = {}) {
  return apiRequest(path, {
    basePath: BASE_PATH,
    errorMessage: ERROR_MESSAGE,
    missingTokenMessage: TOKEN_MESSAGE,
    ...options,
  })
}

function fromApi(todo) {
  return {
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
    dueDate: todo.due_date ?? '',
  }
}

export async function loadTodos() {
  const todos = await request()
  return todos.map(fromApi)
}

export async function createTodo(todo) {
  const created = await request('', {
    method: 'POST',
    body: JSON.stringify({
      title: todo.title,
      completed: false,
      due_date: todo.dueDate || null,
    }),
  })
  return fromApi(created)
}

export async function updateTodo(todoId, changes) {
  const payload = {}
  if ('title' in changes) payload.title = changes.title
  if ('completed' in changes) payload.completed = changes.completed
  if ('dueDate' in changes) payload.due_date = changes.dueDate || null
  const updated = await request(`/${encodeURIComponent(todoId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return fromApi(updated)
}

export function deleteTodo(todoId) {
  return request(`/${encodeURIComponent(todoId)}`, { method: 'DELETE' })
}
