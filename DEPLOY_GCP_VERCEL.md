# Deploy — Vercel (frontend) + GCP VM (backend)

> Split: **Vercel** hosts `website/` (React/Vite), **GCP e2-micro VM** hosts `server` + `postgres` + `redis` + `whatsapp-worker` + `nginx`.

## 1) GHCR images (already building)

Pushed on every `main` push:

- `ghcr.io/susin-d/dashboard-backend:latest` — FastAPI backend (single image, no website)
- `ghcr.io/susin-d/dashboard-server` / `-whatsapp-worker` / `-website` — legacy 3-image stack (ignore if using Vercel)

New backend-only workflow: `.github/workflows/docker-backend.yml` → `dashboard-backend` (also alias `dashboard`).

## 2) GCP VM — one-time setup

```bash
# create e2-micro (us-central1, Debian 12, 30GB, allow http/https)
gcloud compute instances create starwaves-api \
  --machine-type=e2-micro --zone=us-central1-a --image-family=debian-12 --image-project=debian-cloud \
  --tags=http-server,https-server --boot-disk-size=30GB

gcloud compute firewall-rules create allow-starwaves --allow tcp:80,tcp:443 --target-tags=http-server,https-server || true

# ssh
gcloud compute ssh starwaves-api --zone=us-central1-a
```

On VM:

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git

# swap for 1GB VM (free tier)
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

git clone https://github.com/susin-d/dashboard.git starwaves && cd starwaves

# env
cp .env.docker.example server/.env
nano server/.env  # set:
#  AUTH_SECRET_KEY=$(openssl rand -base64 48)
#  CRON_SECRET=$(openssl rand -hex 32)
#  CORS_ORIGINS=https://starwaves.vercel.app,https://starwaves.susindran.in,https://*.vercel.app,http://<VM_EXTERNAL_IP>
#  FRONTEND_URL=https://starwaves.vercel.app
#  DATABASE_URL=postgresql+asyncpg://starwaves:starwaves_password@postgres:5432/starwaves
#  plus OPENAI/ANTHROPIC/GEMINI keys etc

# login to GHCR (use PAT classic with read:packages)
echo $GITHUB_TOKEN | docker login ghcr.io -u susin-d --password-stdin

# pull + run backend-only (no website container)
docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml pull
docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml up -d
docker compose -f docker-compose.yml -f docker-compose.backend.yml ps
curl -i http://localhost/health
curl -i http://localhost:8000/api/v1/health

# logs
docker compose -f docker-compose.yml -f docker-compose.backend.yml logs -f server
```

`nginx/conf.d/default.backend.conf` on VM serves:
- `GET /health`, `/api/*`, `/ws/*`, `/docs` → `server:8000`
- `GET /` → `302` to `https://starwaves.vercel.app`

Add DNS **A** `api.starwaves.susindran.in → <VM_EXTERNAL_IP>` and TLS:

```bash
sudo apt install -y certbot
sudo certbot --nginx -d api.starwaves.susindran.in
# certbot will uncomment HTTPS server block in default.backend.conf if you copy it to 443
```

Then update `server/.env` / `.env.docker.example` to `VITE_API_URL=https://api.starwaves.susindran.in/api/v1` and redeploy Vercel env.

## 3) Vercel — frontend

Vercel Project → Settings → Environment Variables:

```
VITE_API_URL=https://api.starwaves.susindran.in/api/v1
# or http://<VM_EXTERNAL_IP>/api/v1 during dev
```

`vercel.json` already SPA rewrites (`/(.*) → /index.html`), no API proxy needed — frontend calls GCP directly.
On push to `main`, Vercel auto-deploys `website/`.

Local dev still works:

```bash
# website/.env
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

## 4) Pull updates (zero-build on VM)

```bash
cd ~/starwaves
git pull
echo $GITHUB_TOKEN | docker login ghcr.io -u susin-d --password-stdin
docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml pull
docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml up -d
```

Or dispatch **Backend — Build and Push to GHCR** workflow → VM `watchtower` / cron pull.

## 5) Cost — e2-micro free tier

- VM: 1 vCPU, 1GB RAM + 1G swap → fits `postgres 128M + redis 96M + server 512M + nginx`
- Disk: 30GB standard (free)
- If OOM, `docker stats --no-stream` + `free -h`, prune `docker system prune`.

## 6) Troubleshooting

- `AUTH_SECRET_KEY must be strong` → `openssl rand -base64 48` → `server/.env`
- `CORS` 403 on Vercel → add `https://<vercel-preview>--*.vercel.app` to `CORS_ORIGINS`
- `502` on `/` → expected (redirects to Vercel), check `/api/v1/health`
- `502` on `/api` → `docker logs starwaves-server` → DB `DATABASE_URL` typo?
- GHCR `denied` → `docker login ghcr.io`, ensure package is Public (`ghcr.io/susin-d/dashboard-backend` → Package settings → Public)
