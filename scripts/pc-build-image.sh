#!/usr/bin/env bash
# pc-build-image.sh — Build backend image on LOCAL PC and send to VM
# Two modes:
#   GHCR (default):  docker push → VM pulls via GHCR (needs PAT, best for CI)
#   DIRECT (--direct): docker save → gcloud scp → VM docker load (no PAT, fastest for local dev)
#
# Usage:
#   ./scripts/pc-build-image.sh                  # GHCR latest
#   ./scripts/pc-build-image.sh --tag mytest     # GHCR mytest
#   ./scripts/pc-build-image.sh --direct         # direct transfer, tag local
#   ./scripts/pc-build-image.sh --direct --tag mytest --vm personal-vm --zone us-central1-a
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TAG="latest"
MODE="ghcr"
VM="personal-vm"
ZONE="us-central1-a"
IMAGE="ghcr.io/susin-d/dashboard-backend"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2;;
    --direct) MODE="direct"; shift;;
    --ghcr) MODE="ghcr"; shift;;
    --vm) VM="$2"; shift 2;;
    --zone) ZONE="$2"; shift 2;;
    -h|--help) echo "Usage: $0 [--tag TAG] [--direct|--ghcr] [--vm NAME] [--zone ZONE]"; exit 0;;
    *) echo "Unknown arg $1"; exit 1;;
  esac
done

echo "== Build backend (server) -> ${IMAGE}:${TAG}  [mode=${MODE}] =="
docker build -f server/Dockerfile -t "${IMAGE}:${TAG}" -t "${IMAGE}:latest" ./server
echo "Built ${IMAGE}:${TAG}"

if [[ "$MODE" == "ghcr" ]]; then
  echo "== Push to GHCR =="
  echo "If login fails: GitHub -> Settings -> Developer settings -> PAT classic (write:packages)"
  docker login ghcr.io -u susin-d || true
  docker push "${IMAGE}:${TAG}"
  if [[ "$TAG" != "latest" ]]; then docker push "${IMAGE}:latest"; fi
  echo ""
  echo "Pushed ${IMAGE}:${TAG}"
  echo "Next on VM:"
  echo "  gcloud compute ssh ${VM} --zone=${ZONE} --command='bash ~/starwaves/scripts/vm-load-image.sh --tag ${TAG}'"
  echo "  # or inside VM: bash scripts/vm-load-image.sh --tag ${TAG}"
else
  echo "== Direct transfer via gcloud scp =="
  TMP_TAR="$(mktemp /tmp/starwaves-backend-XXXX.tar.gz)"
  echo "Saving ${IMAGE}:${TAG} -> $TMP_TAR ..."
  docker save "${IMAGE}:${TAG}" | gzip > "$TMP_TAR"
  ls -lh "$TMP_TAR"
  echo "Copy to ${VM}:/tmp/backend-${TAG}.tar.gz ..."
  gcloud compute scp "$TMP_TAR" "${VM}:/tmp/backend-${TAG}.tar.gz" --zone="${ZONE}"
  echo "Loading on VM and restarting stack ..."
  gcloud compute ssh "${VM}" --zone="${ZONE}" --command="bash ~/starwaves/scripts/vm-load-image.sh --tar /tmp/backend-${TAG}.tar.gz --tag ${TAG}"
  rm -f "$TMP_TAR"
  echo "Done — direct image live on ${VM}"
fi
