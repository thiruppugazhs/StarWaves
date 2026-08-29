@echo off
REM Requires GCC (mingw) - choco install mingw -y
set CGO_ENABLED=1
go run main.go
