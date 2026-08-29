# StarWaves FastAPI server

## Setup

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` when you need custom configuration.

## Firebase Cloud Firestore

This backend uses Cloud Firestore through the Firebase Admin SDK. Create a
Firebase project and enable Firestore, then set:

```powershell
$env:FIREBASE_PROJECT_ID="your-project-id"
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\secure\path\service-account.json"
```

Keep the service-account JSON outside the repository. On Google-managed
hosting, use Application Default Credentials instead of a downloaded key.

Database access is lazy and shared:

```python
from app.db import get_firestore

database = get_firestore()
```

The next resource API can use this client without initializing Firebase again.

## Run

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API documentation:

- Swagger UI: http://127.0.0.1:8000/docs
- OpenAPI JSON: http://127.0.0.1:8000/openapi.json
- Health check: http://127.0.0.1:8000/api/v1/health

## Profile API

- `POST /api/v1/profiles` — create a profile
- `GET /api/v1/profiles` — list profiles
- `GET /api/v1/profiles/{profile_id}` — get one profile
- `PATCH /api/v1/profiles/{profile_id}` — update selected fields
- `DELETE /api/v1/profiles/{profile_id}` — delete a profile

Profiles are stored in the Firestore `profiles` collection.

## Documents API

These routes require a Firebase ID token in the `Authorization: Bearer <token>`
header:

- `GET /api/v1/documents` — list the signed-in user's documents
- `PUT /api/v1/documents/{document_id}` — create or update a document
- `DELETE /api/v1/documents/{document_id}` — remove a document

Document metadata is stored under `users/{uid}/documents/{document_id}`. File
contents uploaded through StarWaves remain in the user's Google Drive.

## GitHub OAuth

Create a GitHub OAuth App and configure its callback URL as:

`http://127.0.0.1:8000/api/v1/integrations/github/callback`

Then set `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, and a long
random `GITHUB_OAUTH_STATE_SECRET` in `server/.env`. Connected tokens are
encrypted before storage in `users/{uid}/integrations/github`.

## Todo API

All Todo routes require a Firebase ID token:

- `GET /api/v1/todos`
- `POST /api/v1/todos`
- `PATCH /api/v1/todos/{todo_id}`
- `DELETE /api/v1/todos/{todo_id}`

Todos are stored under `users/{uid}/todos/{todo_id}`.

## Workspace data APIs

- `GET/POST /api/v1/jobs`
- `DELETE /api/v1/jobs/{job_id}`
- `GET/POST /api/v1/hackathons`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/{notification_id}`
- `GET /api/v1/contests` — live upcoming Codeforces contests

Jobs, hackathons, and notifications are stored below the authenticated
`users/{uid}` Firestore document. The contests endpoint contains no seeded
records and fetches its response from Codeforces.
