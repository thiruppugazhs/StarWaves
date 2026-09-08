# pc-build-image.ps1 — Build backend image on LOCAL Windows PC and send to VM
#
# Two modes:
#   GHCR (default):  docker push → VM pulls via GHCR (needs GITHUB_TOKEN)
#   DIRECT:          docker save → gcloud scp → VM docker load (no PAT)
#
# Usage:
#   .\scripts\pc-build-image.ps1
#   .\scripts\pc-build-image.ps1 -Tag mytest
#   .\scripts\pc-build-image.ps1 -Direct
#   .\scripts\pc-build-image.ps1 -Direct -Tag mytest -Vm personal-vm -Zone us-central1-a
#
# GHCR authentication:
#   $env:GITHUB_TOKEN = "github_pat_xxxxxxxxxxxxxxxxxxxx"
#
#   Then run:
#   .\scripts\pc-build-image.ps1

param(
  [string]$Tag = "latest",
  [switch]$Direct,
  [string]$Vm = "personal-vm",
  [string]$Zone = "us-central1-a",
  [string]$Image = "ghcr.io/susin-d/dashboard-backend"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$mode = if ($Direct) { "direct" } else { "ghcr" }

Write-Host "== Build backend (server) -> ${Image}:${Tag} [mode=$mode] ==" -ForegroundColor Cyan

# ------------------------------------------------------------
# Build
# ------------------------------------------------------------

docker build `
  -f server/Dockerfile `
  -t "${Image}:${Tag}" `
  -t "${Image}:latest" `
  ./server

if ($LASTEXITCODE -ne 0) {
  throw "docker build failed"
}

Write-Host "Built ${Image}:${Tag}" -ForegroundColor Green

# ------------------------------------------------------------
# GHCR MODE
# ------------------------------------------------------------

if ($mode -eq "ghcr") {

  Write-Host "== Push to GHCR ==" -ForegroundColor Cyan

  # Require GitHub token
  if ([string]::IsNullOrWhiteSpace($env:GITHUB_TOKEN)) {
    Write-Host ""
    Write-Host "GITHUB_TOKEN is not set." -ForegroundColor Red
    Write-Host ""
    Write-Host "Set it in PowerShell with:" -ForegroundColor Yellow
    Write-Host '  $env:GITHUB_TOKEN = "github_pat_xxxxxxxxxxxxxxxxxxxx"' -ForegroundColor White
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Yellow
    throw "GITHUB_TOKEN is required for GHCR authentication"
  }

  # Login using token through stdin.
  # This avoids putting the token in the command line/history.
  $env:GITHUB_TOKEN | docker login ghcr.io -u "susin-d" --password-stdin

  if ($LASTEXITCODE -ne 0) {
    throw "docker login failed"
  }

  Write-Host "GHCR login succeeded." -ForegroundColor Green

  # Push requested tag
  Write-Host "Pushing ${Image}:${Tag} ..." -ForegroundColor Cyan

  docker push "${Image}:${Tag}"

  if ($LASTEXITCODE -ne 0) {
    throw "docker push failed for ${Image}:${Tag}"
  }

  # Also push latest when using a custom tag
  if ($Tag -ne "latest") {

    Write-Host "Pushing ${Image}:latest ..." -ForegroundColor Cyan

    docker push "${Image}:latest"

    if ($LASTEXITCODE -ne 0) {
      throw "docker push failed for ${Image}:latest"
    }
  }

  Write-Host "Pushed ${Image}:${Tag}" -ForegroundColor Green

  Write-Host ""
  Write-Host "Next on VM:" -ForegroundColor Yellow
  Write-Host "  gcloud compute ssh $Vm --zone=$Zone --command='bash ~/starwaves/scripts/vm-load-image.sh --tag $Tag'"
  Write-Host ""
  Write-Host "Or inside VM:" -ForegroundColor Yellow
  Write-Host "  bash scripts/vm-load-image.sh --tag $Tag"

# ------------------------------------------------------------
# DIRECT MODE
# ------------------------------------------------------------

} else {

  Write-Host "== Direct transfer via gcloud scp ==" -ForegroundColor Cyan

  $tmpTar = Join-Path $env:TEMP "starwaves-backend-$Tag.tar.gz"
  $tmpRawTar = Join-Path $env:TEMP "starwaves-backend-$Tag.tar"

  # Clean up previous files
  Remove-Item $tmpTar -ErrorAction SilentlyContinue
  Remove-Item $tmpRawTar -ErrorAction SilentlyContinue

  Write-Host "Saving ${Image}:${Tag} ..." -ForegroundColor Cyan

  # Check whether gzip is available
  $gzipAvailable = $null -ne (Get-Command gzip -ErrorAction SilentlyContinue)

  if ($gzipAvailable) {

    Write-Host "Compressing Docker image with gzip..." -ForegroundColor Cyan

    # Docker save -> gzip -> file
    docker save "${Image}:${Tag}" | gzip > $tmpTar

    if ($LASTEXITCODE -ne 0) {
      throw "docker save/gzip failed"
    }

    $uploadFile = $tmpTar

  } else {

    Write-Host "gzip not found. Saving raw Docker tar..." -ForegroundColor Yellow

    docker save -o $tmpRawTar "${Image}:${Tag}"

    if ($LASTEXITCODE -ne 0) {
      throw "docker save failed"
    }

    $uploadFile = $tmpRawTar
  }

  $fileInfo = Get-Item $uploadFile

  Write-Host ""
  Write-Host "Image archive:" -ForegroundColor Cyan
  Write-Host "  $($fileInfo.FullName)"
  Write-Host "  Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB"
  Write-Host ""

  $remoteFile = "/tmp/backend-$Tag.tar.gz"

  if (-not $gzipAvailable) {
    $remoteFile = "/tmp/backend-$Tag.tar"
  }

  Write-Host "Copying to ${Vm}:$remoteFile ..." -ForegroundColor Cyan

  gcloud compute scp `
    $uploadFile `
    "${Vm}:$remoteFile" `
    --zone=$Zone

  if ($LASTEXITCODE -ne 0) {
    throw "gcloud scp failed"
  }

  Write-Host "Image copied successfully." -ForegroundColor Green

  Write-Host "Loading image on VM and restarting stack ..." -ForegroundColor Cyan

  gcloud compute ssh `
    $Vm `
    --zone=$Zone `
    --command="bash ~/starwaves/scripts/vm-load-image.sh --tar $remoteFile --tag $Tag"

  if ($LASTEXITCODE -ne 0) {
    throw "VM image load failed"
  }

  # Cleanup local archive
  Remove-Item $tmpTar -ErrorAction SilentlyContinue
  Remove-Item $tmpRawTar -ErrorAction SilentlyContinue

  Write-Host ""
  Write-Host "Done — direct image live on $Vm" -ForegroundColor Green
}