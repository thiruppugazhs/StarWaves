# StarWaves Docker Deployment Guide

This guide explains how to build, run, and manage the full StarWaves stack (React website frontend, FastAPI backend, PostgreSQL database, WhatsApp worker, and Nginx reverse proxy) containerized with Docker and Docker Compose.

---

## 🚀 Architecture Overview

| Service | Container Name | Internal Port | Host Port | Description |
| --- | --- | --- | --- | --- |
| **nginx** | `starwaves-nginx` | `80`, `443` | `80`, `443` | Edge reverse proxy (VM: `api.starwaves.susindran.in` → `/api/` & `/ws/`; `/` local dev only) + 5r/s rate limit |
| **website** | `starwaves-website` | `80` | `3000` | React 19 + Vite frontend SPA (prod on Vercel `starwaves.susindran.in`, VM keeps for local dev) |
| **server** | `starwaves-server` | `8000` | `—` (expose only) | FastAPI (Uvicorn 1 worker, e2-micro 512M limit, pools 5/5, Redis cache) |
| **postgres** | `starwaves-postgres` | `5432` | `5432` | PostgreSQL 16 (e2-micro: 128M shared_buffers, 512M effective_cache, 50 max_conn) |
| **redis** | `starwaves-redis` | `6379` | `—` | Redis 7 (96M, allkeys-lru, RDB on VM disk) for caches/locks/rate limit |
| **whatsapp-worker** | `starwaves-whatsapp-worker` | `3001` | `3001` | Go WhatsApp Whatsmeow worker (local volume `whatsapp-data`) |

---

## 📦 GHCR Prebuilt Images (no local build)

Images are auto-published to **GHCR** on every `push` to `main` via `.github/workflows/docker-ghcr.yml`:

- `ghcr.io/susin-d/dashboard-server:latest`
- `ghcr.io/susin-d/dashboard-website:latest`
- `ghcr.io/susin-d/dashboard-whatsapp-worker:latest`

Tags: `latest`, `main`, `main-<sha>`, `v*.*.*` (semver).

**Pull & run without building:**

```bash
# login once (use a PAT with read:packages)
echo $GITHUB_TOKEN | docker login ghcr.io -u susin-d --password-stdin

# pull + run with prebuilt images
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d

# pin to a SHA/tag
TAG=main-abc1234 docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
```

GHCR images use `linux/amd64`, GHA cache, and are built with `VITE_API_URL=/api/v1` for the website.

---

## 🚀 Quick Start with Docker Compose (local build)

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine (v24.0+)
- Docker Compose (v2.20+)

### 2. Environment Setup
Create or update `server/.env` with your production secrets (refer to `.env.docker.example`):

```bash
cp .env.docker.example server/.env
```

### 3. Build & Launch Containers

Run the docker compose stack in detached mode:

```bash
docker compose up --build -d
# — or with GHCR overlay: docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
```

Check the status of running services:

```bash
docker compose ps
```

---

## 🔍 Verification & Health Check

### Access the Application
- **Web App**: [http://localhost](http://localhost) (or [http://localhost:3000](http://localhost:3000) for direct website container)
- **API Documentation**: [http://localhost/docs](http://localhost/docs) or [http://localhost:8000/docs](http://localhost:8000/docs)

### Test Server Health via Nginx Proxy
```bash
curl -i http://localhost/health
```

Expected Response:
```json
HTTP/1.1 200 OK
Server: nginx/...
Content-Type: application/json

{"status":"ok"}
```

### Direct FastAPI Backend Check
```bash
curl -i http://localhost:8000/api/v1/health
```

### Direct Website Container Check
```bash
curl -i http://localhost:3000/
```

---

## 🛠 Useful Commands

| Action | Command |
| --- | --- |
| **View all logs** | `docker compose logs -f` |
| **View website logs** | `docker compose logs -f website` |
| **View server logs** | `docker compose logs -f server` |
| **View nginx logs** | `docker compose logs -f nginx` |
| **Restart services** | `docker compose restart` |
| **Stop stack** | `docker compose down` |
| **Stop stack & remove volumes** | `docker compose down -v` ⚠️ **WILL DELETE** `postgres-data`, `workspace-data`, `whatsapp-data`, `redis-data` (no backup on free tier) |
| **Check e2-micro RAM** | `docker stats --no-stream` + `free -h` + `df -h` |
| **Create 1G swap (Ubuntu once)** | `sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab` |
| **Run server unit tests inside container** | `docker compose exec server python -m unittest discover tests` |
| **Rebuild website image without cache** | `docker compose build --no-cache website` |
| **Rebuild server image without cache** | `docker compose build --no-cache server` |

---

## 🔒 Production Security & SSL/TLS Setup

1. **Non-Root Execution**: The FastAPI server process runs as a low-privilege `appuser` (UID 10001) inside the container.
2. **Reverse Proxy Security**: Nginx strips internal server headers, applies Gzip compression, sets security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`), and limits body uploads to 20MB.
3. **HTTPS / Certbot Setup**:
   - Place your SSL certs in `nginx/certs/`.
   - Uncomment the SSL server block in [`nginx/conf.d/default.conf`](file:///c:/project/starwaves/nginx/conf.d/default.conf).
   - Reload Nginx: `docker compose exec nginx nginx -s reload`.
