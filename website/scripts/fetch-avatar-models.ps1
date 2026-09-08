param(
  [string]$VrmSource = "https://github.com/vrm-c/vrm-specification/raw/master/samples/VRM1_Constraint_Twist_Sample/VRM1_Constraint_Twist_Sample.vrm",
  [string]$HaruSource = "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@latest/test/assets/haru/haru_greeter_t03.model3.json"
)
# Fetches optional CC0 example models for local dev.
# - VRM sample (VRM Consortium) -> public/avatars/vrm/eve-mono.vrm
# - Haru Live2D (Cubism SDK sample) is already stubbed; this script can replace it with CDN fetch.
# Run: powershell -ExecutionPolicy Bypass -File scripts/fetch-avatar-models.ps1
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
$vrmDest = Join-Path $root "website/public/avatars/vrm/eve-mono.vrm"
$vrmDuo = Join-Path $root "website/public/avatars/vrm/eve-duo.vrm"
try {
  Write-Host "Fetching VRM sample -> $vrmDest" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $VrmSource -OutFile $vrmDest -UseBasicParsing
  Copy-Item $vrmDest $vrmDuo -Force
  Write-Host "VRM fetch OK: $((Get-Item $vrmDest).Length) bytes" -ForegroundColor Green
} catch { Write-Host "VRM fetch failed (offline ok, fallback will render): $_" -ForegroundColor Yellow }

# Haru: CDN model3.json + moc3/textures would need bulk fetch; we keep stub unless user opts in.
Write-Host "Done. Fallback procedural avatars render without network; fetched assets override." -ForegroundColor Green
