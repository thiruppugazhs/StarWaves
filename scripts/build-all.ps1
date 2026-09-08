<#
.SYNOPSIS
  Build all Starwaves artifacts: Android + Desktop (+ optional OTA).
#>
[CmdletBinding()]
param(
  [ValidateSet("debug","release")][string]$BuildType = "release",
  [switch]$WithOTA,
  [switch]$Publish,
  [string]$RemoteHost = "",
  [string]$EnvFileAndroid = "",
  [string]$EnvFileDesktop = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/..").Path
Set-Location -LiteralPath $root

$publishArgs = @()
if ($Publish) { $publishArgs += "-Publish" }
if ($RemoteHost) { $publishArgs += "-RemoteHost"; $publishArgs += $RemoteHost }

Write-Host "=== Building Android ===" -ForegroundColor White
& "$PSScriptRoot/build-android.ps1" -BuildType $BuildType -EnvFile $EnvFileAndroid @publishArgs
if ($LASTEXITCODE -ne 0) { throw "build-android failed" }

Write-Host ""
Write-Host "=== Building Desktop ===" -ForegroundColor White
& "$PSScriptRoot/build-desktop.ps1" -BuildType $BuildType -EnvFile $EnvFileDesktop @publishArgs
if ($LASTEXITCODE -ne 0) { throw "build-desktop failed" }

if ($WithOTA) {
  Write-Host ""
  Write-Host "=== Building OTA ===" -ForegroundColor White
  & "$PSScriptRoot/build-ota.ps1" @publishArgs
  if ($LASTEXITCODE -ne 0) { throw "build-ota failed" }
}

Write-Host ""
Write-Host "✓ All builds complete ($BuildType)" -ForegroundColor Green
Write-Host "  Verify: curl http://localhost:8000/api/v1/updates/check?platform=android&currentVersion=0.0.9" -ForegroundColor DarkGray
Write-Host "          curl http://localhost:8000/api/v1/updates/latest.json" -ForegroundColor DarkGray
