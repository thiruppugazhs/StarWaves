@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   StarWaves Local Dev (Postgres Docker + local services)
echo ===================================================

cd /d "%~dp0"

REM -- Check Docker --
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker is not running. Start Docker Desktop first.
    pause
    exit /b 1
)

echo [1/4] Starting PostgreSQL (docker)...
docker compose up -d postgres redis
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to start postgres/redis.
    pause
    exit /b 1
)

echo   Waiting for Postgres to be healthy...
:wait_pg
docker inspect --format="{{.State.Health.Status}}" starwaves-postgres 2>nul | findstr /i "healthy" >nul
if %ERRORLEVEL% neq 0 (
    timeout /t 2 /nobreak >nul
    goto wait_pg
)
echo   Postgres is healthy.

echo [2/4] Starting FastAPI Server (local)...
start "StarWaves Server" cmd /k "cd /d "%~dp0server" && if not exist .venv (python -m venv .venv) && call .venv\Scripts\activate.bat && pip install -q -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [3/4] Starting WhatsApp Worker (local)...
start "StarWaves Worker" cmd /k "cd /d "%~dp0services\whatsapp-worker" && go run main.go"

echo [4/4] Starting Frontend (Vite)...
start "StarWaves Frontend" cmd /k "cd /d "%~dp0website" && npm install && npm run dev"

echo ===================================================
echo   All services launching in separate windows
echo   - Frontend:        http://localhost:5173
echo   - Backend API:     http://localhost:8000/api/v1/health
echo   - WhatsApp Worker: http://localhost:3001/health
echo   - PostgreSQL:      localhost:5432 (user: starwaves)
echo   - Redis:           localhost:6379
echo ===================================================
echo   Tip: Use stop.bat or docker compose down to stop DB.
exit /b 0
