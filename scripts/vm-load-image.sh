#!/usr/bin/env bash
# vm-load-image.sh — Get the built backend image on VM and (re)start the stack
# Supports both GHCR pull and DIRECT tar load (paired with pc-build-image.sh)
#
# Usage (inside VM, ~/starwaves):
#   bash scripts/vm-load-image.sh                  # GHCR latest (git pull + docker pull)
#   bash scripts/vm-load-image.sh --tag mytest     # GHCR mytest
#   bash scripts/vm-load-image.sh --tar /tmp/backend-latest.tar.gz --tag latest  # direct tar
#   # from PC in one shot:
#   gcloud compute ssh personal-vm --zone=us-central1-a --command='bash ~/starwaves/scripts/vm-load-image.sh --tag latest'
set -euo pipefail
cd "$(dirname "$0")/.."

TAG="latest"
TAR=""
IMAGE="ghcr.io/susin-d/dashboard-backend"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2;;
    --tar) TAR="$2"; shift 2;;
    -h|--help) echo "Usage: $0 [--tag TAG] [--tar /path/to/image.tar.gz]"; exit 0;;
    *) echo "Unknown arg $1"; exit 1;;
  esac
done

echo "== Git pull (compose files) =="
git pull origin main 2>&1 | tail -n 20 || echo "git pull skipped"

if [[ -n "$TAR" && -f "$TAR" ]]; then
  echo "== Direct load from $TAR =="
  # handle .tar.gz vs .tar
  if [[ "$TAR" == *.gz ]]; then
    gunzip -c "$TAR" | docker load
  else
    docker load -i "$TAR"
  fi
  # ensure tag matches what compose expects (ghcr.io/...:latest)
  # docker save preserved the original tag, but re-tag to latest for safety
  docker tag "${IMAGE}:${TAG}" "${IMAGE}:latest" 2>/dev/null || true
  echo "Loaded ${IMAGE}:${TAG}"
  echo "== Restart backend-only stack (local image, no pull) =="
  docker compose -f docker-compose.yml -f docker-compose.backend.yml up -d
else
  echo "== GHCR pull ${IMAGE}:${TAG} =="
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u susin-d --password-stdin || true
  elif [[ -n "${GHCR_PAT:-}" ]]; then
    echo "$GHCR_PAT" | docker login ghcr.io -u susin-d --password-stdin || true
  else
    echo "No GITHUB_TOKEN/GHCR_PAT — trying anonymous pull (needs Public package)"
  fi
  docker pull "${IMAGE}:${TAG}"
  if [[ "$TAG" != "latest" ]]; then docker tag "${IMAGE}:${TAG}" "${IMAGE}:latest" || true; fi
  echo "== Restart backend-only stack (GHCR) =="
  docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml up -d
fi

echo "== Status =="
docker compose -f docker-compose.yml -f docker-compose.backend.yml ps 2>&1 | head -n 30 || docker ps | head -n 30
echo "== Health =="
sleep 5
curl -fsS http://localhost:8000/api/v1/health | head -c 2500; echo ""
curl -fsS http://localhost:8000/api/v1/health | grep -q '"status":"ok"' && echo " -> API ok" || (echo "API health failed"; docker logs starwaves-server --tail 80; exit 1)
curl -fsS http://localhost/health | head -c 2000; echo ""
echo "Done — ${IMAGE}:${TAG} live"

# Optional: show detailed health summary if jq is available
if command -v jq >/dev/null 2>&1; then
  echo "== Detailed health summary =="
  curl -fsS http://localhost:8000/api/v1/health | jq '{status, summary, checks}' 2>&1 | head -n 40
fi
