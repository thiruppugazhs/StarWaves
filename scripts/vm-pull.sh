#!/usr/bin/env bash
# Pull latest backend on GCP VM — no build.
# Run INSIDE VM (personal-vm @ ~/starwaves):
#   bash scripts/vm-pull.sh
#   # or with tag: TAG=v1.0.1 bash scripts/vm-pull.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== Git pull (compose files) =="
git pull origin main || echo "git pull skipped (offline or no changes)"
TAG="${TAG:-latest}"
IMAGE="ghcr.io/susin-d/dashboard-backend"

echo "== GHCR login =="
if [ -n "${GITHUB_TOKEN:-}" ]; then
  echo "$GITHUB_TOKEN" | docker login ghcr.io -u susin-d --password-stdin || true
elif [ -n "${GHCR_PAT:-}" ]; then
  echo "$GHCR_PAT" | docker login ghcr.io -u susin-d --password-stdin || true
else
  # try without login if package is Public
  echo "No GITHUB_TOKEN/GHCR_PAT — trying anonymous pull (works if package is Public)"
fi

echo "== Pull ${IMAGE}:${TAG} =="
docker pull "${IMAGE}:${TAG}"
if [ "$TAG" != "latest" ]; then
  docker tag "${IMAGE}:${TAG}" "${IMAGE}:latest"
fi

echo "== Restart backend-only stack =="
docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml up -d

echo "== Status =="
docker compose -f docker-compose.yml -f docker-compose.backend.yml ps

echo "== Health =="
curl -fsS http://localhost:8000/api/v1/health && echo " -> API ok" || (echo "API health failed"; docker logs starwaves-server --tail 50; exit 1)
curl -fsS http://localhost/health && echo " -> nginx ok" || echo "nginx check failed"

echo "Done — pulled ${IMAGE}:${TAG}"
