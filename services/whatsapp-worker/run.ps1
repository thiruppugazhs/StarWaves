# Requires GCC (mingw) on Windows. Install via: winget install -e --id GnuWin32.Make; choco install mingw -y
$env:CGO_ENABLED=1
go run main.go
