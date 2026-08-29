# PC — Build and Push to GHCR (run on your Windows PC, repo root)
# 1) GHCR PAT: GitHub → Settings → Developer settings → PAT classic → write:packages
# 2) Run:  .\scripts\pc-build-push.ps1 -Tag latest
# 3) Then on VM:  bash scripts/vm-pull.sh   (or .\scripts\vm-pull.ps1 from PC)
param(
  [string]$Tag = "latest",
  [string]$Image = "ghcr.io/susin-d/dashboard-backend"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "== GHCR login ==" -ForegroundColor Cyan
# will prompt for PAT if not logged in
docker login ghcr.io -u susin-d
if ($LASTEXITCODE -ne 0) { throw "docker login failed" }

Write-Host "== Build backend (server) ==" -ForegroundColor Cyan
# uses server/Dockerfile, no website
docker build -f server/Dockerfile -t "${Image}:${Tag}" -t "${Image}:latest" ./server
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

Write-Host "== Push to GHCR ==" -ForegroundColor Cyan
docker push "${Image}:${Tag}"
if ($Tag -ne "latest") { docker push "${Image}:latest" }

Write-Host ""
Write-Host "Pushed ${Image}:${Tag}" -ForegroundColor Green
Write-Host "GHCR: https://github.com/susin-d/dashboard/pkgs/container/dashboard-backend"
Write-Host ""
Write-Host "Next — pull on VM:" -ForegroundColor Yellow
Write-Host "  gcloud compute ssh personal-vm --zone=us-central1-a --command='bash ~/starwaves/scripts/vm-pull.sh'"
Write-Host "  # or inside VM:  bash scripts/vm-pull.sh"
Write-Host "  # or from PC:    .\scripts\vm-pull.ps1"
