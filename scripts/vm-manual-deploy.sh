#!/usr/bin/env bash
# Manual deploy on GCP VM — backend only (no website)
# Run inside VM:  ~/starwaves/scripts/vm-manual-deploy.sh
# Or one-liner from laptop: gcloud compute ssh starwaves-api --zone=us-central1-a --command="bash ~/starwaves/scripts/vm-manual-deploy.sh"
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== Git pull =="
git pull origin main
echo "== GHCR login (use PAT with read:packages) =="
# assumes GITHUB_TOKEN env on VM, else paste PAT
if [ -n "${GITHUB_TOKEN:-}" ]; then
  echo "$GITHUB_TOKEN" | docker login ghcr.io -u susin-d --password-stdin || true
else
  echo "Set GITHUB_TOKEN or run: echo <PAT> | docker login ghcr.io -u susin-d --password-stdin"
fi
echo "== Pull latest backend (no local build) =="
docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml pull
echo "== Up -d (backend-only, nginx -> 302 to Vercel) =="
docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml up -d
echo "== Status =="
docker compose -f docker-compose.yml -f docker-compose.backend.yml ps
echo "== Health =="
curl -fsS http://localhost:8000/api/v1/health && echo " -> API ok" || (echo "API health failed"; docker logs starwaves-server --tail 50; exit 1)
curl -fsS http://localhost/health && echo " -> nginx ok" || echo "nginx health failed (check nginx logs)"
echo "== Prune old images =="
docker image prune -f
echo "Done — backend at https://api.starwaves.susindran.in (Vercel frontend calls this)"
