@echo off
echo Stopping StarWaves Docker services...
cd /d "%~dp0"
docker compose down
echo Done.
pause
