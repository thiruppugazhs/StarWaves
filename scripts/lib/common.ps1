# Common helpers for Starwaves build scripts (PowerShell 7+)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step { param([string]$Msg) Write-Host "==> $Msg" -ForegroundColor Cyan }
function Write-Ok { param([string]$Msg) Write-Host "  ✓ $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "  ! $Msg" -ForegroundColor Yellow }
function Write-Err { param([string]$Msg) Write-Host "  ✗ $Msg" -ForegroundColor Red }

function Assert-Command {
  param([string]$Name, [string]$Hint = "")
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Err "Missing required command: $Name"
    if ($Hint) { Write-Host "  Hint: $Hint" }
    throw "Prerequisite missing: $Name"
  }
}

function Get-PackageVersion {
  param([string]$PackageJson = "website/package.json")
  if (-not (Test-Path -LiteralPath $PackageJson)) { throw "package.json not found at $PackageJson" }
  $j = Get-Content -LiteralPath $PackageJson -Raw | ConvertFrom-Json
  return $j.version
}

function Invoke-Checked {
  param([string]$Cmd, [string]$WorkDir = "")
  if ($WorkDir) { Push-Location -LiteralPath $WorkDir }
  try {
    Write-Host "  $ $Cmd" -ForegroundColor DarkGray
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    Invoke-Expression $Cmd
    $code = $LASTEXITCODE
    $ErrorActionPreference = $old
    if ($code -ne 0 -and $null -ne $code) { throw "Command failed ($code): $Cmd" }
  } finally { if ($WorkDir) { Pop-Location } }
}

function Resolve-EnvFile {
  param([string]$Preferred, [string]$Fallback = "website/.env")
  if ($Preferred -and (Test-Path -LiteralPath $Preferred)) { return $Preferred }
  if (Test-Path -LiteralPath $Fallback) { return $Fallback }
  return $null
}

function Import-EnvFile {
  param([string]$Path)
  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return @{} }
  $map = @{}
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }
    $k = $line.Substring(0, $eq).Trim()
    $v = $line.Substring($eq + 1).Trim()
    # Strip quotes
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    $map[$k] = $v
  }
  return $map
}

function Get-FileSha256 {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $h = Get-FileHash -LiteralPath $Path -Algorithm SHA256
  return $h.Hash.ToLowerInvariant()
}

function Format-Bytes {
  param([long]$Bytes)
  if ($Bytes -lt 1024) { return "$Bytes B" }
  if ($Bytes -lt 1024*1024) { return "{0:N1} KB" -f ($Bytes/1024) }
  return "{0:N1} MB" -f ($Bytes/(1024*1024))
}
