"""Studio curated templates: full-stack app (React frontend + FastAPI backend)."""

FULLSTACK_REACT_FASTAPI = {
    "id": "fullstack-react-fastapi",
    "name": "Full-Stack React + FastAPI",
    "description": "React 19 + Vite frontend with a FastAPI + SQLite backend, wired via a Vite proxy and docker-compose.",
    "stack": "react-fastapi",
    "files": [
        {
            "path": "frontend/package.json",
            "content": """{
  "name": "studio-fullstack-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.5.0",
    "vite": "^6.3.5"
  }
}
""",
        },
        {
            "path": "frontend/vite.config.js",
            "content": """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
""",
        },
        {
            "path": "frontend/index.html",
            "content": """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Studio Full-Stack</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
""",
        },
        {
            "path": "frontend/src/main.jsx",
            "content": """import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
""",
        },
        {
            "path": "frontend/src/App.jsx",
            "content": """import { useEffect, useState } from 'react'

export default function App() {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const loadTasks = async () => {
    try {
      const res = await fetch('/api/tasks')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTasks(data.tasks ?? [])
      setError('')
    } catch (err) {
      setError(`Could not reach API: ${err.message}`)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  const addTask = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    })
    setTitle('')
    loadTasks()
  }

  return (
    <main className="app">
      <h1>Studio Full-Stack</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={addTask} className="row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task…" />
        <button type="submit">Add</button>
      </form>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </main>
  )
}
""",
        },
        {
            "path": "frontend/src/styles.css",
            "content": """body { margin: 0; font-family: system-ui, sans-serif; background: #fafafa; color: #18181b; }
.app { max-width: 640px; margin: 0 auto; padding: 3rem 1.5rem; display: grid; gap: 1rem; }
.row { display: flex; gap: 0.5rem; }
input { flex: 1; padding: 0.6rem 0.9rem; border-radius: 8px; border: 1px solid #a1a1aa; }
button { padding: 0.6rem 1.2rem; border-radius: 8px; border: none; background: #18181b; color: #fff; cursor: pointer; }
.error { color: #3f3f46; background: #e4e4e7; padding: 0.6rem 0.9rem; border-radius: 8px; }
""",
        },
        {
            "path": "backend/main.py",
            "content": '''"""Task API backend for the Studio full-stack template (FastAPI + SQLite)."""

import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = "tasks.db"


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                done INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Studio Full-Stack API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks():
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute("SELECT id, title, done, created_at FROM tasks ORDER BY id").fetchall()
    return {
        "tasks": [
            {"id": r[0], "title": r[1], "done": bool(r[2]), "created_at": r[3]} for r in rows
        ]
    }


@app.post("/api/tasks", status_code=201)
def create_task(body: TaskCreate):
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "INSERT INTO tasks (title, done, created_at) VALUES (?, 0, ?)",
            (body.title, now),
        )
        conn.commit()
    return {"id": cursor.lastrowid, "title": body.title, "done": False, "created_at": now}


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
''',
        },
        {
            "path": "backend/requirements.txt",
            "content": """fastapi>=0.115
uvicorn[standard]>=0.30
pydantic>=2.7
""",
        },
        {
            "path": "docker-compose.yml",
            "content": """services:
  backend:
    image: python:3.12-slim
    working_dir: /app
    volumes:
      - ./backend:/app
    command: sh -c "pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000"
    ports:
      - "8000:8000"

  frontend:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./frontend:/app
    command: sh -c "npm install && npm run dev -- --host 0.0.0.0"
    ports:
      - "5173:5173"
    depends_on:
      - backend
""",
        },
        {
            "path": ".gitignore",
            "content": """node_modules
dist
__pycache__/
*.db
.env
.env.*
!.env.example
""",
        },
        {
            "path": "README.md",
            "content": """# Studio Full-Stack App

React (Vite) frontend + FastAPI (SQLite) backend generated by StarWaves Studio.

## Local development

```bash
# Terminal 1 — backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Terminal 2 — frontend (proxies /api to :8000)
cd frontend && npm install && npm run dev
```

Or with Docker: `docker compose up --build`.
""",
        },
    ],
}

FULLSTACK_TEMPLATES = [FULLSTACK_REACT_FASTAPI]
