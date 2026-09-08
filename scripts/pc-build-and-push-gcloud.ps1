# pc-build-and-push-gcloud.ps1
#
# Build backend locally -> push Docker image to GHCR -> VM pulls image
#
# Usage:
#   .\scripts\pc-build-and-push-gcloud.ps1
#   .\scripts\pc-build-and-push-gcloud.ps1 -Tag mytest
#   .\scripts\pc-build-and-push-gcloud.ps1 -Vm personal-vm -Zone us-central1-a
#
# Requirements:
#   - Docker Desktop running
#   - gcloud CLI installed
#   - Logged in with: gcloud auth login
#   - Docker logged in to GHCR:
#       docker login ghcr.io -u susin-d
#   - VM has:
#       ~/starwaves/scripts/vm-pull.sh
#

param(
    [string]$Tag = "latest",
    [string]$Vm = "personal-vm",
    [string]$Zone = "us-east1-b",
    [string]$Image = "starwaves-backend",
    [string]$VmUser = "susindransd",
    [string]$GhcrImage = "ghcr.io/susin-d/dashboard-backend"
)

$ErrorActionPreference = "Stop"

# ------------------------------------------------------------
# Go to project root
# ------------------------------------------------------------

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Starwaves Backend -> GHCR -> GCP VM" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "VM       : $Vm" -ForegroundColor Yellow
Write-Host "User     : $VmUser" -ForegroundColor Yellow
Write-Host "Zone     : $Zone" -ForegroundColor Yellow
Write-Host "Local    : $Image`:$Tag" -ForegroundColor Yellow
Write-Host "GHCR     : $GhcrImage`:$Tag" -ForegroundColor Yellow
Write-Host ""

# ------------------------------------------------------------
# Validate GHCR image
# ------------------------------------------------------------

if ([string]::IsNullOrWhiteSpace($GhcrImage)) {
    throw @"
GHCR_IMAGE is not configured.

Set it first:

`$env:GHCR_IMAGE = "ghcr.io/YOUR_GITHUB_USERNAME/starwaves-backend"

Then run this script again.
"@
}

if (-not $GhcrImage.StartsWith("ghcr.io/")) {
    throw "GHCR image must start with ghcr.io/"
}

# ------------------------------------------------------------
# Check Docker
# ------------------------------------------------------------

Write-Host "Checking Docker..." -ForegroundColor Cyan

docker info *> $null

if ($LASTEXITCODE -ne 0) {
    throw "Docker is not running. Start Docker Desktop first."
}

Write-Host "Docker OK." -ForegroundColor Green

# ------------------------------------------------------------
# Check gcloud
# ------------------------------------------------------------

Write-Host "Checking gcloud..." -ForegroundColor Cyan

gcloud --version *> $null

if ($LASTEXITCODE -ne 0) {
    throw "gcloud CLI is not installed or not in PATH."
}

Write-Host "gcloud OK." -ForegroundColor Green

# ------------------------------------------------------------
# Check Docker GHCR authentication
# ------------------------------------------------------------

Write-Host ""
Write-Host "Checking GHCR authentication..." -ForegroundColor Cyan

$dockerConfig = docker info 2>$null

# Test access by checking Docker's configured credential helper/auth.
# The actual push below is the final authentication check.
Write-Host "GHCR authentication will be verified during push." -ForegroundColor Yellow

# ------------------------------------------------------------
# Check SSH access
# ------------------------------------------------------------

Write-Host ""
Write-Host "Checking SSH access to VM..." -ForegroundColor Cyan

gcloud compute ssh `
    "${VmUser}@${Vm}" `
    --zone=$Zone `
    --command="echo SSH_OK" *> $null

if ($LASTEXITCODE -ne 0) {
    throw "Cannot SSH into ${VmUser}@${Vm}. Check your gcloud SSH setup."
}

Write-Host "SSH OK." -ForegroundColor Green

# ------------------------------------------------------------
# Check VM pull script
# ------------------------------------------------------------

Write-Host ""
Write-Host "Checking VM image pull script..." -ForegroundColor Cyan

$pullScript = "~/starwaves/scripts/vm-pull.sh"

gcloud compute ssh `
    "${VmUser}@${Vm}" `
    --zone=$Zone `
    --command="test -f $pullScript"

if ($LASTEXITCODE -ne 0) {
    throw "VM pull script not found: $pullScript"
}

Write-Host "VM pull script found." -ForegroundColor Green

# ------------------------------------------------------------
# Build Docker image
# ------------------------------------------------------------

Write-Host ""
Write-Host "== Building backend image ==" -ForegroundColor Cyan

docker build `
    --no-cache `
    -f server/Dockerfile `
    -t "${Image}:${Tag}" `
    ./server

if ($LASTEXITCODE -ne 0) {
    throw "Docker build failed."
}

Write-Host ""
Write-Host "Build successful: ${Image}:${Tag}" -ForegroundColor Green

# ------------------------------------------------------------
# Tag image for GHCR
# ------------------------------------------------------------

$ghcrTag = "${GhcrImage}:${Tag}"

Write-Host ""
Write-Host "== Tagging image for GHCR ==" -ForegroundColor Cyan

docker tag "${Image}:${Tag}" $ghcrTag
if ($LASTEXITCODE -ne 0) {
    throw "Docker tag failed."
}

if ($Tag -ne "latest") {
    docker tag "${Image}:${Tag}" "${GhcrImage}:latest"
}

Write-Host "Tagged as: $ghcrTag" -ForegroundColor Green

# ------------------------------------------------------------
# Push image to GHCR
# ------------------------------------------------------------

Write-Host ""
Write-Host "== Pushing image to GHCR ==" -ForegroundColor Cyan
Write-Host "This may take a while depending on upload speed." -ForegroundColor Yellow

docker push $ghcrTag

if ($LASTEXITCODE -ne 0) {
    throw @"
GHCR push failed.

Make sure you are logged in:

docker login ghcr.io

For GitHub Container Registry, use:
Username: your GitHub username
Password: GitHub Personal Access Token with package write permission.
"@
}

if ($Tag -ne "latest") {
    docker push "${GhcrImage}:latest"
}

Write-Host ""
Write-Host "GHCR push successful." -ForegroundColor Green

# ------------------------------------------------------------
# Pull image on VM
# ------------------------------------------------------------

Write-Host ""
Write-Host "== Pulling image on VM ==" -ForegroundColor Cyan

$remoteCommand = "TAG=$Tag bash $pullScript"

Write-Host ""
Write-Host "Remote command:" -ForegroundColor DarkGray
Write-Host $remoteCommand -ForegroundColor DarkGray
Write-Host ""

gcloud compute ssh `
    "${VmUser}@${Vm}" `
    --zone=$Zone `
    --command=$remoteCommand

if ($LASTEXITCODE -ne 0) {
    throw "VM image pull/restart failed."
}

Write-Host ""
Write-Host "VM image pulled successfully." -ForegroundColor Green

# ------------------------------------------------------------
# Verify running container
# ------------------------------------------------------------

Write-Host ""
Write-Host "== Verifying backend container ==" -ForegroundColor Cyan

gcloud compute ssh `
    "${VmUser}@${Vm}" `
    --zone=$Zone `
    --command="docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Could not verify container status." -ForegroundColor Yellow
}
else {
    Write-Host ""
    Write-Host "Container verification complete." -ForegroundColor Green
}

# ------------------------------------------------------------
# Done
# ------------------------------------------------------------

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

Write-Host "Local image : ${Image}:${Tag}" -ForegroundColor Green
Write-Host "GHCR image  : ${ghcrTag}" -ForegroundColor Green
Write-Host "VM          : $Vm" -ForegroundColor Green
Write-Host "User        : $VmUser" -ForegroundColor Green
Write-Host "Zone        : $Zone" -ForegroundColor Green
Write-Host ""

Write-Host "Backend deployed successfully." -ForegroundColor Green