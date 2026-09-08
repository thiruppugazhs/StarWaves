#!/usr/bin/env bash
set -euo pipefail
# Starwaves Desktop build (Tauri) — bash variant for WSL/CI/Linux/macOS
# Mirrors build-desktop.ps1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TYPE="${1:-release}" # debug|release
SKIP_WEB="${SKIP_WEB:-0}"
PUBLISH="${PUBLISH:-0}"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_PATH="${REMOTE_PATH:-~/starwaves/server/static/updates}"

green(){ echo -e "\033[32m  ✓ $*\033[0m"; }
cyan(){ echo -e "\033[36m==> $*\033[0m"; }
yellow(){ echo -e "\033[33m  ! $*\033[0m"; }

cyan "Starwaves Desktop build ($TYPE) — Tauri"

command -v node >/dev/null || { echo "Missing node"; exit 1; }
command -v npm >/dev/null || { echo "Missing npm"; exit 1; }
command -v cargo >/dev/null || { echo "Missing cargo (rustup.rs)"; exit 1; }

# env
ENV_FILE="${ENV_FILE:-}"
if [[ -z "$ENV_FILE" ]]; then
  if [[ -f website/.env.prod ]]; then ENV_FILE="website/.env.prod"
  elif [[ -f website/.env ]]; then ENV_FILE="website/.env"; fi
fi
cyan "Env file: $ENV_FILE"
if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs -d '\n' 2>/dev/null || true)
  # temp shadowing website/.env for vite
  if [[ "$ENV_FILE" != "website/.env" ]]; then
    cp "$ENV_FILE" website/.env.tmpbak 2>/dev/null || true
    cp "$ENV_FILE" website/.env
    trap 'if [[ -f website/.env.tmpbak ]]; then mv website/.env.tmpbak website/.env; else rm -f website/.env; fi' EXIT
  fi
fi

PKG_VER=$(node -p "require('./website/package.json').version")
green "package.json version $PKG_VER"

if [[ "$SKIP_WEB" != "1" ]]; then
  cyan "Web build (vite)"
  pushd website >/dev/null
  npm install
  npm run build
  popd >/dev/null
  [[ -f website/dist/index.html ]] || { echo "No dist/index.html"; exit 1; }
  green "Web build done"
fi

cyan "Tauri bundling ($TYPE)…"
pushd website >/dev/null
if [[ "$TYPE" == "debug" ]]; then npx tauri build --debug; else npx tauri build; fi
popd >/dev/null
green "Tauri build finished"

echo ""
echo "Artifacts:"
find website/src-tauri/target -type f \( -name "*.exe" -o -name "*.msi" -o -name "*.sig" -o -name "latest.json" \) -print 2>/dev/null | head -20 || yellow "No bundle artifacts found — check tauri logs"

if [[ "$PUBLISH" == "1" ]]; then
  if [[ -z "$REMOTE_HOST" ]]; then yellow "PUBLISH=1 but REMOTE_HOST empty — skipping scp"; exit 0; fi
  cyan "Publish to $REMOTE_HOST:$REMOTE_PATH"
  ssh "$REMOTE_HOST" "mkdir -p $REMOTE_PATH"
  find website/src-tauri/target -type f \( -name "*.exe" -o -name "*.msi" -o -name "*.sig" -o -name "latest.json" \) -exec scp {} "$REMOTE_HOST:$REMOTE_PATH/" \;
  green "Publish done — verify: curl https://$REMOTE_HOST/api/v1/updates/latest.json"
fi

green "Desktop build complete ($TYPE). Verify: curl /api/v1/updates/check?platform=windows&currentVersion=$PKG_VER"
