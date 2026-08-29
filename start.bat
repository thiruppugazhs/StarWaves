@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Starting StarWaves Services (DB, Server, Worker)
echo ===================================================

cd /d "%~dp0"

REM -- Check Docker --
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker is not running. Start Docker Desktop first.
    pause
    exit /b 1
)

echo [1/3] Starting PostgreSQL (docker)...
docker compose up -d postgres redis
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to start Docker DB. Make sure Docker Desktop is running.
    pause
    exit /b %ERRORLEVEL%
)

echo [2/3] Starting Server + WhatsApp Worker (docker)...
docker compose up -d server whatsapp-worker
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to start Server/Worker containers.
    pause
    exit /b %ERRORLEVEL%
)

echo [3/3] Launching Website Frontend Dev Server...
start "StarWaves Frontend" cmd /k "cd /d "%~dp0website" && npm run dev"

echo ===================================================
echo   StarWaves is running!
echo   - Frontend:        http://localhost:5173
echo   - Backend API:     http://localhost:8000 (or http://localhost/api/v1)
echo   - WhatsApp Worker: http://localhost:3001
echo   - PostgreSQL DB:   localhost:5432
echo ===================================================

exit /b 0