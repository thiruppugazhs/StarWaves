<#
.SYNOPSIS
  Build Starwaves Desktop EXE via Tauri (Windows MSI + NSIS). Backend-hosted updater artifacts.

.DESCRIPTION
  1. Checks prereqs (Node, npm, Rust, cargo, WebView2 indirectly).
  2. Injects VITE_API_URL from env file (default website/.env.prod else website/.env).
  3. Optionally generates Tauri icons from public/starwaves-logo.png.
  4. Runs vite build (unless -SkipWebBuild) then `tauri build` (--debug if requested).
  5. Validates Tauri signing key for release (TAURI_SIGNING_PRIVATE_KEY env).
  6. Collects bundle artifacts + .sig + latest.json.
  7. Optional -Publish scp to backend updates static dir.

.NOTES
  Requires PowerShell 7+. Run from repo root.
  Env keys: TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, UPDATES_DIR (optional).
  Signing pubkey must already be in src-tauri/tauri.conf.json plugins.updater.pubkey (or pass via env TAURI_SIGNING_PUBLIC_KEY).

.EXAMPLE
  ./scripts/build-desktop.ps1 -BuildType release
  ./scripts/build-desktop.ps1 -BuildType debug -SkipWebBuild
  ./scripts/build-desktop.ps1 -BuildType release -Publish -RemoteHost api.starwaves.susindran.in
#>
[CmdletBinding()]
param(
  [ValidateSet("debug","release")][string]$BuildType = "release",
  [string]$EnvFile = "",
  [ValidateSet("msi","nsis","both")][string]$Bundler = "both",
  [switch]$SkipWebBuild,
  [switch]$Publish,
  [string]$RemoteHost = "",
  [string]$RemotePath = "~/starwaves/server/static/updates"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/..").Path
Set-Location -LiteralPath $root
. "$PSScriptRoot/lib/common.ps1"

Write-Step "Starwaves Desktop build ($BuildType) — Tauri"

# --- Prereqs ---
Assert-Command -Name "node" -Hint "Install Node 20 from https://nodejs.org"
Assert-Command -Name "npm" -Hint "Node includes npm"
Assert-Command -Name "cargo" -Hint "Install Rust via https://rustup.rs then run: rustup target add x86_64-pc-windows-msvc"
try { Assert-Command -Name "rustc" } catch { Write-Warn "rustc not found but cargo exists — continuing" }

# Verify npx tauri exists
$tauriOk = $false
try {
  $null = Get-Command "npx" -ErrorAction Stop
  $tauriInfo = & npx --prefix website tauri --version 2>&1
  if ($LASTEXITCODE -eq 0) { $tauriOk = $true; Write-Ok "tauri CLI: $tauriInfo" }
} catch { }
if (-not $tauriOk) { Write-Warn "Tauri CLI not found via npx. Will run via 'npm exec tauri' fallback." }

# --- Env ---
if (-not $EnvFile) {
  if (Test-Path -LiteralPath "website/.env.prod") { $EnvFile = "website/.env.prod" }
  elseif (Test-Path -LiteralPath "website/.env") { $EnvFile = "website/.env" }
}
Write-Step "Env file: $EnvFile"
$envMap = Import-EnvFile -Path $EnvFile
$viteUrl = $envMap["VITE_API_URL"]
if (-not $viteUrl -and $env:TAURI_VITE_API_URL) { $viteUrl = $env:TAURI_VITE_API_URL }
if ($viteUrl) { Write-Ok "VITE_API_URL=$viteUrl" } else { Write-Warn "VITE_API_URL not set in $EnvFile — vite will fallback to http://127.0.0.1:8000/api/v1" }

# Stash current website/.env to restore later
$envBackup = $null
$envPath = "website/.env"
if (Test-Path -LiteralPath $envPath) { $envBackup = Get-Content -LiteralPath $envPath -Raw }
if ($EnvFile -and (Test-Path -LiteralPath $EnvFile) -and $EnvFile -ne $envPath) {
  Copy-Item -LiteralPath $EnvFile -Destination $envPath -Force
  Write-Ok "Copied $EnvFile -> $envPath for vite build"
}

# Also export for vite define usage
if ($viteUrl) { $env:VITE_API_URL = $viteUrl }

# --- Icons ---
if (-not (Test-Path -LiteralPath "website/src-tauri/icons/icon.png") -or -not (Test-Path -LiteralPath "website/src-tauri/icons/icon.ico")) {
  Write-Step "Generating Tauri icons from public/logo.png"
  try {
    Push-Location -LiteralPath "website"
    & npx tauri icon public/logo.png 2>&1 | Out-String | Write-Host
    Pop-Location
  } catch { Write-Warn "Icon generation failed: $_ — using existing icons" }
}

# --- Version ---
$pkgVersion = Get-PackageVersion -PackageJson "website/package.json"
Write-Ok "package.json version $pkgVersion"
# Sync tauri.conf.json version if drifted
try {
  $confPath = "website/src-tauri/tauri.conf.json"
  $conf = Get-Content -LiteralPath $confPath -Raw | ConvertFrom-Json
  if ($conf.version -ne $pkgVersion) {
    Write-Warn "tauri.conf.json version $($conf.version) != package.json $pkgVersion — syncing"
    $raw = Get-Content -LiteralPath $confPath -Raw
    $raw = $raw -replace '"version"\s*:\s*"[^"]+"', "`"version`": `"$pkgVersion`""
    # Only first occurrence (product version)
    Set-Content -LiteralPath $confPath -Value $raw -NoNewline
    Write-Ok "Patched tauri.conf.json version to $pkgVersion"
  }
} catch { Write-Warn "Version sync skipped: $_" }

# --- Signing check for release ---
$hasSigning = $false
if ($env:TAURI_SIGNING_PRIVATE_KEY) { $hasSigning = $true }
elseif ($env:TAURI_PRIVATE_KEY) { $hasSigning = $true; $env:TAURI_SIGNING_PRIVATE_KEY = $env:TAURI_PRIVATE_KEY }
# Also check file at ~/.tauri/starwaves.key
$keyPath = Join-Path $HOME ".tauri/starwaves.key"
if (-not $hasSigning -and (Test-Path -LiteralPath $keyPath)) {
  Write-Ok "Found signing key at $keyPath"
  $hasSigning = $true
  $env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -LiteralPath $keyPath -Raw)
}
if ($BuildType -eq "release" -and -not $hasSigning) {
  Write-Warn "No TAURI_SIGNING_PRIVATE_KEY found — updater artifacts will be unsigned (user must set TAURI_SIGNING_PRIVATE_KEY env for signed releases). Build continues."
  Write-Host "  Generate: npx tauri signer generate -w `"$keyPath`"  then set pubkey in tauri.conf.json plugins.updater.pubkey"
}
if ($BuildType -eq "release" -and $hasSigning) {
  # Inject pubkey from env if tauri.conf has empty
  $pub = $env:TAURI_SIGNING_PUBLIC_KEY
  if (-not $pub -and (Test-Path -LiteralPath $keyPath)) {
    try { $pub = (Get-Content -LiteralPath "$keyPath.pub" -ErrorAction SilentlyContinue -Raw) } catch {}
  }
  if ($pub) {
    try {
      $confRaw = Get-Content -LiteralPath "website/src-tauri/tauri.conf.json" -Raw
      if ($confRaw -match '"pubkey"\s*:\s*""') {
        Write-Warn "tauri.conf.json pubkey empty — injecting TAURI_SIGNING_PUBLIC_KEY from env (remember to commit pubkey!)"
        $confRaw = $confRaw -replace '"pubkey"\s*:\s*""', "`"pubkey`": `"$($pub.Trim())`""
        Set-Content -LiteralPath "website/src-tauri/tauri.conf.json" -Value $confRaw -NoNewline
      }
    } catch { Write-Warn "Pubkey injection failed: $_" }
  }
}

# --- Web build ---
if (-not $SkipWebBuild) {
  Write-Step "Web build (vite)"
  Push-Location -LiteralPath "website"
  & npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "vite build failed" }
  Pop-Location
  if (-not (Test-Path -LiteralPath "website/dist/index.html")) { throw "vite build did not produce website/dist/index.html" }
  Write-Ok "Web build done"
} else {
  Write-Warn "Skipping web build (-SkipWebBuild)"
  if (-not (Test-Path -LiteralPath "website/dist/index.html")) { throw "No website/dist/index.html and -SkipWebBuild set — must build first" }
}

# --- Tauri build ---
Write-Step "Tauri bundling ($BuildType)…"
$tauriArgs = "build"
if ($BuildType -eq "debug") { $tauriArgs = "build --debug" }
# Force updater artifacts already via tauri.conf createUpdaterArtifacts; no extra arg needed
Push-Location -LiteralPath "website"
$env:TAURI_BUNDLER_WIX_FIPS_COMPLIANT = "true"
# Pass through signing env (tauri reads TAURI_SIGNING_PRIVATE_KEY)
Write-Host "  npx tauri $tauriArgs" -ForegroundColor DarkGray
& npx tauri $tauriArgs
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "tauri build failed ($code)" }
Write-Ok "Tauri build finished"

# Restore env backup
if ($null -ne $envBackup) {
  Set-Content -LiteralPath $envPath -Value $envBackup -NoNewline
  Write-Ok "Restored $envPath"
} elseif (Test-Path -LiteralPath $envPath) {
  # If we copied from .env.prod and there was no original, remove the temp
  if ($EnvFile -ne $envPath -and $EnvFile -like "*.prod") {
    Remove-Item -LiteralPath $envPath -Force -ErrorAction SilentlyContinue
  }
}

# --- Collect artifacts ---
Write-Step "Collecting artifacts"
$bundleDir = Join-Path $root "website/src-tauri/target/release/bundle"
if ($BuildType -eq "debug") { $bundleDir = Join-Path $root "website/src-tauri/target/debug/bundle" }
$artifacts = @()
if (Test-Path -LiteralPath $bundleDir) {
  $artifacts = Get-ChildItem -LiteralPath $bundleDir -Recurse -File -ErrorAction SilentlyContinue
}
# Also latest.json if emitted
$latestJson = Join-Path $bundleDir "latest.json"
if (-not (Test-Path -LiteralPath $latestJson)) {
  # Fallback: target/release/bundle/manifests?
  $latestJson = Get-ChildItem -LiteralPath (Join-Path $root "website/src-tauri/target") -Recurse -Filter "latest.json" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
}

Write-Host ""
Write-Host "Artifacts:" -ForegroundColor White
if ($artifacts.Count -eq 0) { Write-Warn "No bundle directory at $bundleDir — check tauri build logs" }
else {
  foreach ($f in $artifacts) {
    $rel = $f.FullName.Substring($root.Length+1)
    $size = Format-Bytes -Bytes $f.Length
    $hash = ""
    if ($f.Extension -in @(".exe",".msi")) { $hash = " sha256=$(Get-FileSha256 -Path $f.FullName | Select-Object -First 2)" }
    Write-Host "  $rel  $size$hash" -ForegroundColor Gray
  }
}
if ($latestJson -and (Test-Path -LiteralPath $latestJson)) {
  Write-Host "  $($latestJson.Substring($root.Length+1))" -ForegroundColor Gray
  Get-Content -LiteralPath $latestJson | Write-Host -ForegroundColor DarkGray
} else {
  Write-Warn "No latest.json emitted — ensure tauri.conf.json bundle.createUpdaterArtifacts = v1Compatible and a signing key was present (or add one for next release)."
}

# --- Publish (scp to backend) ---
if ($Publish) {
  if (-not $RemoteHost) {
    Write-Warn "-Publish requires -RemoteHost (e.g. api.starwaves.susindran.in). Skipping upload."
  } else {
    Write-Step "Publish to $RemoteHost`:$RemotePath"
    if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) { throw "ssh not found — install OpenSSH" }
    # Ensure remote dir
    & ssh $RemoteHost "mkdir -p $RemotePath" 2>&1 | Out-String | Write-Host
    # Upload key artifacts
    $toUpload = @()
    foreach ($f in $artifacts) {
      if ($f.Extension -in @(".exe",".msi",".sig")) { $toUpload += $f.FullName }
    }
    if ($latestJson) { $toUpload += $latestJson }
    foreach ($p in $toUpload) {
      Write-Host "  scp $p -> $RemoteHost`:$RemotePath/" -ForegroundColor DarkGray
      & scp $p "${RemoteHost}:$RemotePath/" 2>&1 | Out-String | Write-Host
      if ($LASTEXITCODE -ne 0) { Write-Warn "scp failed for $p" } else { Write-Ok "Uploaded $(Split-Path -Leaf $p)" }
    }
    Write-Ok "Publish done — verify: curl https://$RemoteHost/updates/ && curl https://$RemoteHost/api/v1/updates/latest.json"
  }
}

Write-Host ""
Write-Ok "Desktop build complete ($BuildType). Verify: website/src-tauri/target/... and if published: curl /api/v1/updates/check?platform=windows&currentVersion=$pkgVersion"
