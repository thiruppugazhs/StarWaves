#!/usr/bin/env bash
# PC — Build and Push to GHCR (run on your PC, repo root)
# Usage:  ./scripts/pc-build-push.sh [latest]
#   ./scripts/pc-build-push.sh latest
#   # then on VM: bash scripts/vm-pull.sh  (or gcloud ssh ...)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TAG="${1:-latest}"
IMAGE="ghcr.io/susin-d/dashboard-backend"

echo "== GHCR login =="
echo "Paste PAT with write:packages"
docker login ghcr.io -u susin-d

echo "== Build backend (server) =="
docker build -f server/Dockerfile -t "${IMAGE}:${TAG}" -t "${IMAGE}:latest" ./server

echo "== Push to GHCR =="
docker push "${IMAGE}:${TAG}"
if [ "$TAG" != "latest" ]; then docker push "${IMAGE}:latest"; fi

echo ""
echo "Pushed ${IMAGE}:${TAG}"
echo "GHCR: https://github.com/susin-d/dashboard/pkgs/container/dashboard-backend"
echo ""
echo "Next — pull on VM:"
echo "  gcloud compute ssh personal-vm --zone=us-central1-a --command='bash ~/starwaves/scripts/vm-pull.sh'"
echo "  # or inside VM: bash scripts/vm-pull.sh"
