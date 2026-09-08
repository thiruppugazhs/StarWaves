#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TYPE="${1:-release}"
WITH_OTA="${WITH_OTA:-0}"
./scripts/build-android.sh "$TYPE"
./scripts/build-desktop.sh "$TYPE"
if [[ "$WITH_OTA" == "1" ]]; then ./scripts/build-ota.sh; fi
echo "✓ All builds complete ($TYPE)"
