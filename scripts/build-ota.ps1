<#
.SYNOPSIS
  Build and publish OTA web bundle (zip of website/dist) for Capgo/self-host.
#>
[CmdletBinding()]
param(
  [string]$EnvFile = "",
  [string]$Version = "",
  [switch]$Publish,
  [string]$RemoteHost = "",
  [string]$RemotePath = "~/starwaves/server/static/updates/bundles"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/..").Path
Set-Location -LiteralPath $root
. "$PSScriptRoot/lib/common.ps1"

if (-not $Version) { $Version = Get-PackageVersion -PackageJson "website/package.json" }
Write-Step "OTA bundle build v$Version"

if (-not (Test-Path -LiteralPath "website/dist/index.html")) {
  Write-Step "Web build (vite)"
  Push-Location -LiteralPath "website"
  & npm install
  & npm run build
  Pop-Location
}

$tmp = Join-Path $env:TEMP "starwaves-ota-$Version.zip"
if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
Write-Step "Zipping website/dist -> $tmp"
# Use Compress-Archive
Compress-Archive -Path "website/dist/*" -DestinationPath $tmp -Force
$sha = Get-FileSha256 -Path $tmp
$size = (Get-Item -LiteralPath $tmp).Length
Write-Ok "Bundle $(Format-Bytes -Bytes $size) sha256 $sha"

$manifestDir = "server/static/updates/bundles"
New-Item -ItemType Directory -Path $manifestDir -Force | Out-Null
$bundleId = "bundle-$Version"
$destZip = Join-Path $manifestDir "$bundleId.zip"
Copy-Item -LiteralPath $tmp -Destination $destZip -Force
Write-Ok "Copied to $destZip"

$manifest = [ordered]@{
  bundleId = $bundleId
  version = $Version
  url = "/updates/bundles/$bundleId.zip"
  checksum = $sha
  notes = "OTA web bundle $Version"
  publishedAt = (Get-Date).ToUniversalTime().ToString("o")
}
$latestPath = Join-Path $manifestDir "latest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $latestPath -NoNewline
Write-Ok "Wrote $latestPath"
Get-Content -LiteralPath $latestPath | Write-Host -ForegroundColor DarkGray

if ($Publish) {
  if (-not $RemoteHost) { Write-Warn "-Publish needs -RemoteHost"; exit 0 }
  Write-Step "Publish OTA to $RemoteHost`:$RemotePath"
  & ssh $RemoteHost "mkdir -p $RemotePath" 2>&1 | Write-Host
  & scp $destZip "${RemoteHost}:$RemotePath/$bundleId.zip" 2>&1 | Write-Host
  & scp $latestPath "${RemoteHost}:$RemotePath/latest.json" 2>&1 | Write-Host
  Write-Ok "Publish done — verify: curl https://$RemoteHost/api/v1/updates/ota/latest.json"
}

Write-Ok "OTA build complete"
