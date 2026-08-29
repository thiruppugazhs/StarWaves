# StarWaves

StarWaves is a personal productivity workspace that brings projects, job
applications, tasks, documents, calendars, email, hackathons, and competitive
programming activity into one dashboard.

The application has a React/Vite frontend and a FastAPI backend. Firebase
Authentication provides user sessions, while Cloud Firestore stores user data
and integration settings.

## Features

- Customizable workspace dashboard
- Profile editing and password reset support
- Full persistent CRUD operations for Projects, Jobs, Hackathons, Documents, and Todos
- Project and GitHub repository tracking with editing and deletion
- Job application tracking with status, notes, editing, and deletion
- Todo management with due dates, completion toggle, and editing
- Google Drive document upload, import, metadata editing, and deletion
- Gmail inbox, search, compose, reply, star, archive, and trash actions
- Google Calendar aggregation
- Competitive-programming contests and profile statistics
- Hackathon discovery with configurable sources and manual entry CRUD
- Calendar-derived reminders and persistent notification management (mark read, mark all read, delete)
- Light and dark themes
- Responsive desktop and mobile layouts

## Technology

### Frontend

- React 19
- Vite
- Firebase Authentication
- Lucide React
- React Grid Layout
- Plain CSS with shared design tokens

### Backend

- Python and FastAPI
- Firebase Admin SDK
- Cloud Firestore
- HTTPX
- Google OAuth APIs
- GitHub OAuth and GraphQL APIs

## Repository structure

```text
Starwaves/
├── website/                 React frontend
│   ├── src/components/      Shared UI components
│   ├── src/hooks/           Authentication, routing, and data hooks
│   ├── src/lib/             Frontend API clients
│   ├── src/pages/           Workspace pages
│   └── src/styles/          Tokens, components, and page styles
├── server/                  FastAPI backend
│   ├── app/
│   │   ├── api/routes/      HTTP endpoints and OAuth callbacks
│   │   ├── core/            Configuration and authentication
│   │   ├── repositories/    Firestore data access
│   │   ├── schemas/         API request and response models
│   │   └── services/        External integration services
│   └── tests/               Backend unittest suite
└── README.md
```

## Prerequisites

- Node.js 20.19+ or 22.12+
- Python 3.11+
- A Firebase project with Authentication and Firestore enabled
- Google OAuth credentials for Calendar and Drive integrations
- A GitHub OAuth app for GitHub integration

Gmail actions use the Google account connected through Firebase Authentication
and request the required Gmail scopes in the browser.

## Local setup

### 1. Configure the frontend

```powershell
cd website
Copy-Item .env.example .env
npm install
```

Fill in `website/.env` with backend API configuration:

```dotenv
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

### 2. Configure the backend

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Configure Firebase Admin credentials and the integrations in `server/.env`.
The principal variables are:

```dotenv
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:\secure\firebase-service-account.json

GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
GITHUB_OAUTH_STATE_SECRET=

GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_STATE_SECRET=
```

Keep service-account files and OAuth secrets outside the repository. Do not
commit either `.env` file.

### 3. Configure OAuth callbacks

Use these callback URLs for local development:

```text
GitHub:
http://127.0.0.1:8000/api/v1/integrations/github/callback

Google Calendar:
http://127.0.0.1:8000/api/v1/integrations/google-calendar/callback

Google Drive:
http://127.0.0.1:8000/api/v1/integrations/google-drive/callback
```

Also add the frontend origin to the authorized JavaScript origins:

```text
http://127.0.0.1:5173
http://localhost:5173
```

## Running locally

Start the API:

```powershell
cd server
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in another terminal:

```powershell
cd website
npm run dev
```

Open `http://127.0.0.1:5173`.

API documentation is available at:

- Swagger UI: `http://127.0.0.1:8000/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`
- Health check: `http://127.0.0.1:8000/api/v1/health`

## Testing and Verification

### Backend Tests

From `server/`:

```powershell
python -m unittest discover tests
```

### Frontend Verification & Tests

From `website/`:

```powershell
npm run dev       # Start the development server
npm run build     # Create a production build
npm run preview   # Preview the production build
npm run lint      # Run Oxlint
node --test src/lib/__tests__/workspaceApi.test.js  # Run unit tests
```

## API overview

Authenticated workspace routes expect a Firebase ID token:

```http
Authorization: Bearer <firebase-id-token>
```

The API covers:

- Profiles
- Todos
- Documents
- Projects
- Jobs
- Hackathons and hackathon sources
- Notifications
- Competitive-programming profiles and statistics
- Live programming contests
- GitHub
- Gmail connection state
- Google Calendar
- Google Drive

Refer to the interactive Swagger documentation for the exact request and
response schemas.

## Known limitations

- Global search navigates between pages but does not search workspace records.
- Calendar event creation and editing are not implemented.
- Mail attachments, forwarding, rich-text composition, and persistent drafts
  are not implemented.
- The production frontend build currently emits a bundle-size advisory.


