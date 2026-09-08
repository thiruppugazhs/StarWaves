<#
.SYNOPSIS
  Build Starwaves Android APK/AAB via Capacitor + Gradle. Backend-hosted auto-update manifest.

.DESCRIPTION
  1. Checks Node, Java, Android SDK.
  2. Injects VITE_API_URL from env file (default website/.env.android else .env).
  3. Bumps android/versionCode+versionName from package.json (monotonic).
  4. vite build + cap sync android.
  5. Runs gradlew assembleDebug|assembleRelease|bundleRelease.
  6. Generates server/static/updates/android.json manifest (+ sha256/size).
  7. Optional -Publish scp to backend updates dir.

.NOTES
  Requires JDK 17+ (Gradle 8 wants 17/21), ANDROID_HOME or website/android/local.properties.
  Env: ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD for signing.

.EXAMPLE
  ./scripts/build-android.ps1 -BuildType debug
  ./scripts/build-android.ps1 -BuildType release -Publish -RemoteHost api.starwaves.susindran.in
  ./scripts/build-android.ps1 -BuildType release -Bundle aab -SkipWebBuild
#>
[CmdletBinding()]
param(
  [ValidateSet("debug","release")][string]$BuildType = "debug",
  [ValidateSet("apk","aab","both")][string]$Bundle = "apk",
  [string]$EnvFile = "",
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

Write-Step "Starwaves Android build ($BuildType, $Bundle) — Capacitor + Gradle"

# --- Prereqs ---
Assert-Command -Name "node" -Hint "https://nodejs.org"
Assert-Command -Name "npm"
# Java
try {
  $jv = & java -version 2>&1 | Out-String
  Write-Ok "java: $($jv.Split("`n")[0].Trim())"
} catch { Write-Warn "java not found — Gradle requires JDK 17/21. Install via Android Studio JBR or Temurin." }
# Android SDK
$hasSdk = $false
if ($env:ANDROID_HOME -and (Test-Path -LiteralPath $env:ANDROID_HOME)) { $hasSdk = $true; Write-Ok "ANDROID_HOME=$env:ANDROID_HOME" }
elseif ($env:ANDROID_SDK_ROOT -and (Test-Path -LiteralPath $env:ANDROID_SDK_ROOT)) { $hasSdk = $true }
elseif (Test-Path -LiteralPath "website/android/local.properties") {
  $hasSdk = $true
  $lp = Get-Content -LiteralPath "website/android/local.properties" -Raw
  Write-Ok "local.properties present"
}
if (-not $hasSdk) { Write-Warn "No Android SDK found (ANDROID_HOME or local.properties). Gradle may fail. Install Android Studio." }

# --- Env ---
if (-not $EnvFile) {
  if ($BuildType -eq "release" -and (Test-Path -LiteralPath "website/.env.android")) { $EnvFile = "website/.env.android" }
  elseif (Test-Path -LiteralPath "website/.env.prod") { $EnvFile = "website/.env.prod" }
  elseif (Test-Path -LiteralPath "website/.env") { $EnvFile = "website/.env" }
}
Write-Step "Env file: $EnvFile"
$envMap = Import-EnvFile -Path $EnvFile
$viteUrl = $envMap["VITE_API_URL"]
if ($viteUrl) { Write-Ok "VITE_API_URL=$viteUrl" }

$envBackup = $null
$envPath = "website/.env"
if (Test-Path -LiteralPath $envPath) { $envBackup = Get-Content -LiteralPath $envPath -Raw }
if ($EnvFile -and (Test-Path -LiteralPath $EnvFile) -and $EnvFile -ne $envPath) {
  Copy-Item -LiteralPath $EnvFile -Destination $envPath -Force
  Write-Ok "Copied $EnvFile -> $envPath for vite build"
}
if ($viteUrl) { $env:VITE_API_URL = $viteUrl }

# --- Version sync (package.json -> gradle) ---
$pkgVersion = Get-PackageVersion -PackageJson "website/package.json"
Write-Ok "package.json version $pkgVersion"
$gradlePath = "website/android/app/build.gradle"
if (Test-Path -LiteralPath $gradlePath) {
  $gradleRaw = Get-Content -LiteralPath $gradlePath -Raw
  # Bump versionCode monotonic
  $vc = 1
  if ($gradleRaw -match 'versionCode\s+(\d+)') { $vc = [int]$Matches[1] }
  $newVc = $vc
  # Only bump on release or if versionName changes?
  if ($BuildType -eq "release") { $newVc = $vc + 1 }
  # Also check existing android.json versionCode to avoid collision if package.json bump not yet
  $existingJson = "server/static/updates/android.json"
  if (Test-Path -LiteralPath $existingJson) {
    try {
      $j = Get-Content -LiteralPath $existingJson -Raw | ConvertFrom-Json
      if ($j.versionCode -ge $newVc) { $newVc = [int]$j.versionCode + ($BuildType -eq "release" ? 1 : 0) }
    } catch {}
  }
  $gradleRaw = $gradleRaw -replace 'versionCode\s+\d+', "versionCode $newVc"
  $gradleRaw = $gradleRaw -replace 'versionName\s+"[^"]+"', "versionName `"$pkgVersion`""
  Set-Content -LiteralPath $gradlePath -Value $gradleRaw -NoNewline
  Write-Ok "Patched $gradlePath -> versionCode $newVc versionName $pkgVersion"
  $script:androidVersionCode = $newVc
} else {
  Write-Warn "No $gradlePath — skipping version patch"
  $script:androidVersionCode = 1
}

# Ensure gradle.properties java.home overridable
$gp = "website/android/gradle.properties"
if (Test-Path -LiteralPath $gp) {
  $gpRaw = Get-Content -LiteralPath $gp -Raw
  if ($env:JAVA_HOME -and $gpRaw -match 'org\.gradle\.java\.home=') {
    Write-Ok "JAVA_HOME=$env:JAVA_HOME will override gradle.properties java.home via CLI"
  }
}

# --- Web build + cap sync ---
if (-not $SkipWebBuild) {
  Write-Step "Web build + Capacitor sync"
  Push-Location -LiteralPath "website"
  # Use npm install (ci is too strict/slow when optionalDeps change); npm install is resilient
  & npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "vite build failed" }
  & npx cap sync android
  if ($LASTEXITCODE -ne 0) { throw "cap sync failed" }
  Pop-Location
  if (-not (Test-Path -LiteralPath "website/dist/index.html")) { throw "No website/dist/index.html" }
  Write-Ok "Web + cap sync done"
} else {
  Write-Warn "Skipping web build (-SkipWebBuild)"
  # still sync if dist exists
  if (Test-Path -LiteralPath "website/dist/index.html") {
    Push-Location -LiteralPath "website"; & npx cap copy android; Pop-Location
  }
}

# --- Signing config hint for release ---
if ($BuildType -eq "release") {
  $hasKeystore = $false
  if ($env:ANDROID_KEYSTORE_PATH -and (Test-Path -LiteralPath $env:ANDROID_KEYSTORE_PATH)) { $hasKeystore = $true }
  elseif (Test-Path -LiteralPath "website/android/app/release.keystore") { $hasKeystore = $true }
  if (-not $hasKeystore) {
    Write-Warn "No keystore found (ANDROID_KEYSTORE_PATH or website/android/app/release.keystore). APK will be unsigned. To sign: keytool -genkeypair -keystore website/android/app/release.keystore -alias starwaves -keyalg RSA -keysize 2048 -validity 10000"
  } else {
    Write-Ok "Keystore present — Gradle will sign if signingConfigs configured (add ANDROID_KEYSTORE_* env)."
  }
}

# --- Gradle build ---
Write-Step "Gradle build ($BuildType, $Bundle)"
$gradleArgs = @()
if ($BuildType -eq "debug") { $gradleArgs = @("assembleDebug") }
else {
  if ($Bundle -eq "apk") { $gradleArgs = @("assembleRelease") }
  elseif ($Bundle -eq "aab") { $gradleArgs = @("bundleRelease") }
  else { $gradleArgs = @("assembleRelease","bundleRelease") }
}
# On Windows prefer gradlew.bat
$gradlew = "gradlew"
if ($IsWindows -or $env:OS -like "*Windows*") {
  if (Test-Path -LiteralPath "website/android/gradlew.bat") { $gradlew = "gradlew.bat" }
} else {
  # bash fallback
  if (Test-Path -LiteralPath "website/android/gradlew") { & chmod +x "website/android/gradlew" 2>$null }
}

Push-Location -LiteralPath "website/android"
$gradleExe = ".\$gradlew"
if ($gradlew -eq "gradlew") { $gradleExe = "./gradlew" }
$gradleCmd = "$gradleExe $($gradleArgs -join ' ')"
# JAVA_HOME override via cli if present
$extra = ""
if ($env:JAVA_HOME) { $extra = " -Dorg.gradle.java.home=`"$env:JAVA_HOME`"" }
Write-Host "  $gradleCmd$extra" -ForegroundColor DarkGray
if ($env:JAVA_HOME) {
  & $gradleExe @gradleArgs "-Dorg.gradle.java.home=$env:JAVA_HOME"
} else {
  & $gradleExe @gradleArgs
}
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "Gradle build failed ($code): $($gradleArgs -join ' ')" }
Write-Ok "Gradle done"

# Restore env
if ($null -ne $envBackup) {
  Set-Content -LiteralPath $envPath -Value $envBackup -NoNewline
  Write-Ok "Restored $envPath"
} elseif (Test-Path -LiteralPath $envPath) {
  if ($EnvFile -ne $envPath) { Remove-Item -LiteralPath $envPath -Force -ErrorAction SilentlyContinue }
}

# --- Collect artifacts + manifest ---
Write-Step "Collecting Android artifacts"
$apkDebug = "website/android/app/build/outputs/apk/debug/app-debug.apk"
$apkRelease = "website/android/app/build/outputs/apk/release/app-release.apk"
$apkUnsigned = "website/android/app/build/outputs/apk/release/app-release-unsigned.apk"
$aabRelease = "website/android/app/build/outputs/bundle/release/app-release.aab"

$found = @()
foreach ($p in @($apkDebug,$apkRelease,$apkUnsigned,$aabRelease)) {
  if (Test-Path -LiteralPath $p) {
    $sz = (Get-Item -LiteralPath $p).Length
    $rel = $p
    Write-Host "  $rel  $(Format-Bytes -Bytes $sz) sha256=$(Get-FileSha256 -Path $p | Select-Object -First 2)" -ForegroundColor Gray
    $found += $p
  }
}
if ($found.Count -eq 0) { Write-Warn "No APK/AAB found under website/android/app/build/outputs/" }

# Generate / update android.json manifest for release (also for debug preview if requested)
if ($BuildType -eq "release" -or $env:GENERATE_ANDROID_JSON) {
  $manifestApk = $apkRelease
  if (-not (Test-Path -LiteralPath $manifestApk) -and (Test-Path -LiteralPath $apkUnsigned)) { $manifestApk = $apkUnsigned }
  if (-not (Test-Path -LiteralPath $manifestApk) -and (Test-Path -LiteralPath $apkDebug)) { $manifestApk = $apkDebug }
  $sha = $null; $size = $null
  if (Test-Path -LiteralPath $manifestApk) { $sha = Get-FileSha256 -Path $manifestApk; $size = (Get-Item -LiteralPath $manifestApk).Length }
  $manifestDir = "server/static/updates"
  New-Item -ItemType Directory -Path $manifestDir -Force | Out-Null
  $apkName = "starwaves-$pkgVersion.apk"
  if ($Bundle -eq "aab" -and (Test-Path -LiteralPath $aabRelease)) { $apkName = "starwaves-$pkgVersion.aab" }
  # Absolute URL for backend: prefer API base if known
  $base = if ($env:API_BASE_URL) { $env:API_BASE_URL.TrimEnd('/') } else { "" }
  if ($base -and $base.EndsWith("/api/v1")) { $base = $base.Substring(0, $base.Length - 7) }
  $url = if ($base) { "$base/updates/$apkName" } else { "/updates/$apkName" }
  $manifest = [ordered]@{
    latestVersion = $pkgVersion
    versionCode = $script:androidVersionCode
    url = $url
    notes = "Starwaves $pkgVersion — backend-hosted auto-update (force:false). See CHANGELOG.md"
    force = $false
    sha256 = $sha
    size = $size
    publishedAt = (Get-Date).ToUniversalTime().ToString("o")
  }
  $manifestPath = Join-Path $manifestDir "android.json"
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -NoNewline
  Write-Ok "Wrote $manifestPath"
  Get-Content -LiteralPath $manifestPath | Write-Host -ForegroundColor DarkGray
  # Also copy APK to updates dir for serving if Publish not used locally
  if (Test-Path -LiteralPath $manifestApk) {
    $dest = Join-Path $manifestDir $apkName
    Copy-Item -LiteralPath $manifestApk -Destination $dest -Force
    Write-Ok "Copied APK to $dest for local /updates hosting"
  }
}

# --- Publish ---
if ($Publish) {
  if (-not $RemoteHost) { Write-Warn "-Publish requires -RemoteHost. Skipping scp." }
  else {
    Write-Step "Publish to $RemoteHost`:$RemotePath"
    & ssh $RemoteHost "mkdir -p $RemotePath" 2>&1 | Out-String | Write-Host
    foreach ($p in $found) {
      $leaf = if ($p -like "*app-release*") { "starwaves-$pkgVersion$(if($p -like "*.aab") {".aab"} else {".apk"})" } else { Split-Path -Leaf $p }
      Write-Host "  scp $p -> $RemoteHost`:$RemotePath/$leaf" -ForegroundColor DarkGray
      & scp $p "${RemoteHost}:$RemotePath/$leaf" 2>&1 | Out-String | Write-Host
    }
    # Also push android.json
    $localManifest = "server/static/updates/android.json"
    if (Test-Path -LiteralPath $localManifest) {
      & scp $localManifest "${RemoteHost}:$RemotePath/android.json" 2>&1 | Out-String | Write-Host
      Write-Ok "Uploaded android.json"
    }
    Write-Ok "Publish done — verify: curl https://$RemoteHost/api/v1/updates/android.json && curl https://$RemoteHost/api/v1/updates/check?platform=android&currentVersion=$pkgVersion"
  }
}

Write-Host ""
Write-Ok "Android build complete ($BuildType). Artifacts: $($found -join ', ')"
Write-Host "  Install: adb install -r website/android/app/build/outputs/apk/debug/app-debug.apk" -ForegroundColor DarkGray
Write-Host "  Update check: curl /api/v1/updates/check?platform=android&currentVersion=$pkgVersion" -ForegroundColor DarkGray
