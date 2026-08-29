"""Studio curated templates: SaaS starter (React + Vite dashboard shell with auth pages)."""

REACT_SAAS = {
    "id": "react-saas",
    "name": "React SaaS Starter",
    "description": "React + Vite SaaS shell with landing, login, and dashboard views plus a client-side auth guard.",
    "stack": "react-vite",
    "files": [
        {
            "path": "package.json",
            "content": """{
  "name": "studio-saas",
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
            "path": "vite.config.js",
            "content": """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
""",
        },
        {
            "path": "index.html",
            "content": """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Studio SaaS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
""",
        },
        {
            "path": "src/main.jsx",
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
            "path": "src/auth.jsx",
            "content": """import { createContext, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)

// Demo-only session store. Swap for a real backend when ready.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const value = useMemo(
    () => ({
      user,
      login: (email) => setUser({ email }),
      logout: () => setUser(null),
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
""",
        },
        {
            "path": "src/App.jsx",
            "content": """import { useState } from 'react'
import { AuthProvider, useAuth } from './auth.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'

function Router() {
  const [route, setRoute] = useState('landing')
  const { user } = useAuth()

  if (user) return <Dashboard />
  if (route === 'login') return <Login onBack={() => setRoute('landing')} />
  return <Landing onLogin={() => setRoute('login')} />
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  )
}
""",
        },
        {
            "path": "src/pages/Landing.jsx",
            "content": """export default function Landing({ onLogin }) {
  return (
    <main className="page center">
      <h1>Your SaaS, shipped fast</h1>
      <p>Describe features to Eve and she builds them into this app.</p>
      <button onClick={onLogin}>Sign in</button>
    </main>
  )
}
""",
        },
        {
            "path": "src/pages/Login.jsx",
            "content": """import { useState } from 'react'
import { useAuth } from '../auth.jsx'

export default function Login({ onBack }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')

  return (
    <main className="page center">
      <h2>Sign in</h2>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (email.trim()) login(email.trim())
        }}
      >
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Continue</button>
      </form>
      <button className="link" onClick={onBack}>Back</button>
    </main>
  )
}
""",
        },
        {
            "path": "src/pages/Dashboard.jsx",
            "content": """import { useAuth } from '../auth.jsx'

const METRICS = [
  { label: 'Users', value: '1,284' },
  { label: 'MRR', value: '$9.4k' },
  { label: 'Churn', value: '1.8%' },
]

export default function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <main className="page">
      <header className="topbar">
        <strong>Studio SaaS</strong>
        <span>{user?.email}</span>
        <button className="link" onClick={logout}>Sign out</button>
      </header>
      <section className="metrics">
        {METRICS.map((m) => (
          <article key={m.label} className="metric">
            <span>{m.label}</span>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>
    </main>
  )
}
""",
        },
        {
            "path": "src/styles.css",
            "content": """* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: #fafafa;
  color: #18181b;
}

.page { max-width: 880px; margin: 0 auto; padding: 2rem 1.5rem; }
.center { min-height: 100vh; display: grid; place-content: center; gap: 1rem; text-align: center; }

button {
  padding: 0.65rem 1.3rem;
  border-radius: 8px;
  border: 1px solid #27272a;
  background: #18181b;
  color: #fff;
  cursor: pointer;
}

button.link { background: none; border: none; color: #3f3f46; text-decoration: underline; }

.form { display: grid; gap: 0.75rem; justify-items: stretch; }
.form input {
  padding: 0.65rem 0.9rem;
  border-radius: 8px;
  border: 1px solid #a1a1aa;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  justify-content: space-between;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e4e4e7;
}

.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
.metric { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 1rem; display: grid; gap: 0.35rem; }
.metric span { color: #71717a; font-size: 0.85rem; }
.metric strong { font-size: 1.4rem; }
""",
        },
        {
            "path": ".gitignore",
            "content": """node_modules
dist
.env
.env.*
!.env.example
""",
        },
        {
            "path": "README.md",
            "content": """# Studio SaaS

React + Vite SaaS shell generated by StarWaves Studio with a demo client-side
auth flow (landing → login → dashboard). Replace `src/auth.jsx` with your real
backend when ready.
""",
        },
    ],
}

SAAS_TEMPLATES = [REACT_SAAS]
