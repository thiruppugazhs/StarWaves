#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
VERSION="${VERSION:-$(node -p "require('./website/package.json').version")}"
PUBLISH="${PUBLISH:-0}"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_PATH="${REMOTE_PATH:-~/starwaves/server/static/updates/bundles}"
cyan(){ echo -e "\033[36m==> $*\033[0m"; }
green(){ echo -e "\033[32m  ✓ $*\033[0m"; }
cyan "OTA bundle build v$VERSION"
if [[ ! -f website/dist/index.html ]]; then
  pushd website >/dev/null
  npm install
  npm run build
  popd >/dev/null
fi
tmp="/tmp/starwaves-ota-$VERSION.zip"
rm -f "$tmp"
pushd website/dist >/dev/null
zip -r "$tmp" . >/dev/null
popd >/dev/null
SHA=$(sha256sum "$tmp" | awk '{print $1}')
mkdir -p server/static/updates/bundles
BUNDLE_ID="bundle-$VERSION"
cp "$tmp" "server/static/updates/bundles/$BUNDLE_ID.zip"
cat > server/static/updates/bundles/latest.json <<JSON
{
  "bundleId": "$BUNDLE_ID",
  "version": "$VERSION",
  "url": "/updates/bundles/$BUNDLE_ID.zip",
  "checksum": "$SHA",
  "notes": "OTA web bundle $VERSION",
  "publishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
green "Wrote server/static/updates/bundles/latest.json"
if [[ "$PUBLISH" == "1" ]]; then
  if [[ -z "$REMOTE_HOST" ]]; then echo "Need REMOTE_HOST"; exit 0; fi
  ssh "$REMOTE_HOST" "mkdir -p $REMOTE_PATH"
  scp "$tmp" "$REMOTE_HOST:$REMOTE_PATH/$BUNDLE_ID.zip"
  scp server/static/updates/bundles/latest.json "$REMOTE_HOST:$REMOTE_PATH/latest.json"
  green "Publish done"
fi
