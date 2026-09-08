#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TYPE="${1:-debug}"
BUNDLE="${BUNDLE:-apk}"
ENV_FILE="${ENV_FILE:-}"
SKIP_WEB="${SKIP_WEB:-0}"
PUBLISH="${PUBLISH:-0}"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_PATH="${REMOTE_PATH:-~/starwaves/server/static/updates}"

cyan(){ echo -e "\033[36m==> $*\033[0m"; }
green(){ echo -e "\033[32m  ✓ $*\033[0m"; }
yellow(){ echo -e "\033[33m  ! $*\033[0m"; }

cyan "Starwaves Android build ($TYPE, $BUNDLE)"
command -v node >/dev/null || { echo "Missing node"; exit 1; }
command -v npm >/dev/null || { echo "Missing npm"; exit 1; }
java -version 2>&1 | head -1 || yellow "java not found — Gradle needs JDK 17/21"

if [[ -z "$ENV_FILE" ]]; then
  if [[ "$TYPE" == "release" && -f website/.env.android ]]; then ENV_FILE="website/.env.android"
  elif [[ -f website/.env.prod ]]; then ENV_FILE="website/.env.prod"
  elif [[ -f website/.env ]]; then ENV_FILE="website/.env"; fi
fi
cyan "Env file: $ENV_FILE"

PKG_VER=$(node -p "require('./website/package.json').version")
green "package.json version $PKG_VER"

# version bump logic
GRADLE="website/android/app/build.gradle"
if [[ -f "$GRADLE" ]]; then
  VC=$(grep -oP 'versionCode\s+\K\d+' "$GRADLE" || echo 1)
  if [[ "$TYPE" == "release" ]]; then VC=$((VC+1)); fi
  sed -i -E "s/versionCode\s+[0-9]+/versionCode $VC/" "$GRADLE"
  sed -i -E "s/versionName\s+\"[^\"]+\"/versionName \"$PKG_VER\"/" "$GRADLE"
  green "Patched $GRADLE -> versionCode $VC versionName $PKG_VER"
fi

if [[ "$SKIP_WEB" != "1" ]]; then
  cyan "Web build + cap sync"
  pushd website >/dev/null
  npm install
  npm run build
  npx cap sync android
  popd >/dev/null
fi

cyan "Gradle build ($TYPE)"
pushd website/android >/dev/null
chmod +x gradlew 2>/dev/null || true
if [[ "$TYPE" == "debug" ]]; then ./gradlew assembleDebug
else
  if [[ "$BUNDLE" == "aab" ]]; then ./gradlew bundleRelease
  elif [[ "$BUNDLE" == "apk" ]]; then ./gradlew assembleRelease
  else ./gradlew assembleRelease bundleRelease; fi
fi
popd >/dev/null
green "Gradle done"

# manifest
if [[ "$TYPE" == "release" ]]; then
  MANIFEST_DIR="server/static/updates"
  mkdir -p "$MANIFEST_DIR"
  APK=$(ls website/android/app/build/outputs/apk/release/*.apk 2>/dev/null | head -1 || echo "")
  if [[ -f "$APK" ]]; then
    SHA=$(sha256sum "$APK" | awk '{print $1}')
    SIZE=$(stat -c%s "$APK" 2>/dev/null || stat -f%z "$APK")
    cat > "$MANIFEST_DIR/android.json" <<JSON
{
  "latestVersion": "$PKG_VER",
  "versionCode": $VC,
  "url": "/updates/starwaves-$PKG_VER.apk",
  "notes": "Starwaves $PKG_VER — backend-hosted auto-update (force:false)",
  "force": false,
  "sha256": "$SHA",
  "size": $SIZE,
  "publishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
    cp "$APK" "$MANIFEST_DIR/starwaves-$PKG_VER.apk"
    green "Wrote $MANIFEST_DIR/android.json + APK copy"
  fi
fi

if [[ "$PUBLISH" == "1" ]]; then
  if [[ -z "$REMOTE_HOST" ]]; then yellow "PUBLISH=1 but REMOTE_HOST empty"; exit 0; fi
  cyan "Publish to $REMOTE_HOST:$REMOTE_PATH"
  ssh "$REMOTE_HOST" "mkdir -p $REMOTE_PATH"
  scp website/android/app/build/outputs/apk/release/*.apk "$REMOTE_HOST:$REMOTE_PATH/" 2>/dev/null || scp website/android/app/build/outputs/apk/debug/*.apk "$REMOTE_HOST:$REMOTE_PATH/" || true
  scp server/static/updates/android.json "$REMOTE_HOST:$REMOTE_PATH/" 2>/dev/null || true
  green "Publish done"
fi

green "Android build complete ($TYPE)"
