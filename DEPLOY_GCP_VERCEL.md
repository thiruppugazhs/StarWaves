# StarWaves Deployment Guide: GCP e2-micro (Free Tier) + Vercel

This guide deploys StarWaves across the ideal free-tier architecture:
- **Frontend (`website/`)**: Hosted on **Vercel** (Global CDN, free SSL, instant edge delivery).
- **Backend (`server/`) & WhatsApp Worker (`services/whatsapp-worker/`)**: Hosted on a **Google Cloud e2-micro VM** (100% free-tier eligible, persistent 24/7 background processes for WhatsApp WebSockets and audio synthesis).

---

## Architecture Overview

```
                        ┌───────────────────────────────┐
                        │   User / Web Browser          │
                        └──────────────┬────────────────┘
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 │                                           │
                 ▼                                           ▼
      ┌────────────────────┐                       ┌───────────────────┐
      │   Vercel (Free)    │                       │  GCP e2-micro VM  │
      │                    │                       │  (Always Free)    │
      │ • React 19 + Vite  │                       │                   │
      │ • Global Edge CDN  │                       │ • Nginx (Port 80) │
      │ • Fast static SPA  │                       │ • FastAPI Backend │
      │                    │                       │ • WhatsApp Worker │
      └─────────┬──────────┘                       │ • Redis Cache     │
                │                                  └─────────┬─────────┘
                │ API Requests (REST / WebSocket)            │
                └────────────────────────────────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │ Google Cloud Firestore Database   │
                     │ (starwaves-cec20)                 │
                     └───────────────────────────────────┘
```

---

## Part 1: Launch Google Cloud e2-micro VM (Always Free Tier)

Google Cloud offers **1 e2-micro VM per month for free** forever (in US regions `us-central1`, `us-east1`, or `us-west1` with a 30 GB standard disk).

### Step 1.1: Create the VM Instance

You can create it via **Google Cloud Console (GUI)** or via the **Google Cloud Cloud Shell / CLI**:

#### Method A: Using Google Cloud Console (Browser)
1. Go to [Google Cloud Console: Compute Engine VM Instances](https://console.cloud.google.com/compute/instances).
2. Select your project **`starwaves-cec20`**.
3. Click **Create Instance**.
4. Configure the settings:
   - **Name**: `starwaves-vm`
   - **Region**: `us-central1` (Iowa) or `us-east1` (South Carolina) *(Required for Free Tier)*
   - **Zone**: Any (e.g. `us-central1-a`)
   - **Machine Configuration**:
     - Series: `E2`
     - Machine type: **`e2-micro`** (2 vCPU, 1 GB memory) *(Free tier eligible)*
   - **Boot disk**:
     - Operating system: **Debian** or **Ubuntu** (e.g. Ubuntu 24.04 LTS or Debian 12)
     - Boot disk type: **Standard persistent disk** *(Free tier eligible)*
     - Size: **30 GB** *(Maximum free tier allowance)*
   - **Firewall**:
     - Check: **Allow HTTP traffic**
     - Check: **Allow HTTPS traffic**
5. Click **Create**.

#### Method B: Using Google Cloud Shell / gcloud CLI
Run this single command:
```bash
gcloud compute instances create starwaves-vm \
  --project=starwaves-cec20 \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=http-server,https-server
```

---

### Step 1.2: Connect via SSH & Setup the Environment

1. In the Google Cloud Console VM list, click the **SSH** button next to `starwaves-vm`.
2. Once the terminal opens, run the following setup commands:

```bash
# 1. Update system & install Docker + Git
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git curl

# 2. Add current user to docker group (so docker runs without sudo)
sudo usermod -aG docker $USER
newgrp docker

# 3. Create a 1.5 GB swap file (essential for 1GB RAM e2-micro instances)
sudo fallocate -l 1536M /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap is active:
free -h
```

---

### Step 1.3: Clone the Repository & Configure Environment

```bash
# Clone your StarWaves repository
git clone https://github.com/thiruppugazhs/StarWaves.git
cd StarWaves

# Create the server environment file
nano server/.env
```

Paste your production configuration into `server/.env` (press `Ctrl+O` then `Enter` to save, `Ctrl+X` to exit):

```env
APP_NAME=StarWaves API
APP_ENV=production
API_V1_PREFIX=/api/v1
CORS_ORIGINS=https://starwaves.vercel.app,https://*.vercel.app,http://localhost:5173
FRONTEND_URL=https://starwaves.vercel.app

# Firebase Cloud Firestore
FIREBASE_PROJECT_ID=starwaves-cec20
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@starwaves-cec20.iam.gserviceaccount.com
FIRESTORE_DATABASE_ID=(default)
GOOGLE_APPLICATION_CREDENTIALS=firebase-service-account.json

# Auth Key (replace with any random 32+ character string)
AUTH_SECRET_KEY=starwaves-prod-secret-93821094810293841029384

# StarWaves Built-in AI (Google Gemini 2.5 Flash)
DEFAULT_AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

# ElevenLabs Speech
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

Also create `server/firebase-service-account.json` on the VM:
```bash
nano server/firebase-service-account.json
```
*(Paste your service account JSON contents here and save).*

---

### Step 1.4: Start Backend, WhatsApp Worker & Nginx

Run Docker Compose using the backend overlay:
```bash
docker compose -f docker-compose.yml -f docker-compose.backend.yml up --build -d
```

Check the status of your containers:
```bash
docker compose -f docker-compose.yml -f docker-compose.backend.yml ps
```

Test your backend health:
```bash
curl http://localhost/health
# Should return: {"status":"ok","service":"StarWaves API","environment":"production"}
```

Note your VM's **External IP address** from Google Cloud Console (e.g. `34.xxx.xxx.xxx`).
Your backend API is now accessible at:
`http://<YOUR_VM_EXTERNAL_IP>/api/v1`

---

## Part 2: Deploy Frontend on Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New…** &rarr; **Project**.
2. Select your repository: **`thiruppugazhs/StarWaves`**.
3. In **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`website`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:
   - `VITE_APP_NAME` = `StarWaves`
   - `VITE_API_URL` = `http://<YOUR_VM_EXTERNAL_IP>/api/v1` (or your domain with HTTPS)
5. Click **Deploy**.
6. Once deployed, copy your Vercel URL (e.g. `https://starwaves.vercel.app`).
7. Update `CORS_ORIGINS` in your VM `server/.env` to include your Vercel URL, and reload:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.backend.yml restart server
   ```

---

## Part 3 (Optional): Free Custom Domain & HTTPS with Certbot

If you have a domain (or free subdomain from DuckDNS / Cloudflare):
1. Point your DNS A record to your VM External IP:
   `api.yourdomain.com` &rarr; `<YOUR_VM_EXTERNAL_IP>`
2. Install Certbot on your VM:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```
3. Update `VITE_API_URL` on Vercel to `https://api.yourdomain.com/api/v1`.
