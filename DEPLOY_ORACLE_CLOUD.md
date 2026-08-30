# StarWaves Deployment Guide: Oracle Cloud (OCI Always Free) + Vercel

Oracle Cloud Infrastructure (OCI) offers the most generous **Always Free** tier in the cloud industry:
- **Ampere A1 ARM Instance**: Up to **4 Cores (OCPUs)** and **24 GB of RAM** (100% free forever).
- **200 GB Block Storage** (free).
- Plenty of memory to run the FastAPI Backend, Go WhatsApp Worker, Redis, and Nginx without ever worrying about RAM limits!

---

## Deployment Architecture

```
                    ┌───────────────────────────────┐
                    │   User / Web Browser          │
                    └──────────────┬────────────────┘
                                   │
             ┌─────────────────────┴─────────────────────┐
             │                                           │
             ▼                                           ▼
  ┌────────────────────┐                       ┌───────────────────┐
  │   Vercel (Free)    │                       │  Oracle Cloud VM  │
  │                    │                       │  (Always Free)    │
  │ • React 19 + Vite  │                       │  (Up to 24GB RAM) │
  │ • Global Edge CDN  │                       │                   │
  │ • Static SPA       │                       │ • Nginx (Port 80) │
  │                    │                       │ • FastAPI Backend │
  └─────────┬──────────┘                       │ • WhatsApp Worker │
            │                                  │ • Redis Cache     │
            │ API Requests (REST / WebSocket)  └─────────┬─────────┘
            └────────────────────────────────────────────┘
                                   │
                                   ▼
                 ┌───────────────────────────────────┐
                 │ Google Cloud Firestore Database   │
                 │ (starwaves-cec20)                 │
                 └───────────────────────────────────┘
```

---

## Step 1: Create Oracle Cloud VM Instance (Always Free)

1. Log in to [Oracle Cloud Console](https://cloud.oracle.com/).
2. In the navigation menu (top-left ☰), go to **Compute** &rarr; **Instances**.
3. Click **Create instance**.
4. Configure the instance:
   - **Name**: `starwaves-server`
   - **Compartment**: Keep default.
   - **Placement**: Keep default availability domain.
   - **Image and shape**:
     - Click **Edit**:
     - **Image**: Select **Ubuntu 24.04** (or **Ubuntu 22.04 Minimal / Standard**).
     - **Shape**: Click **Change shape**:
       - Select **Ampere** (Arm-based processor) &rarr; **VM.Standard.A1.Flex** *(Always Free Eligible)*.
       - Allocate **2 to 4 OCPUs** and **12 to 24 GB RAM** (e.g. 2 OCPUs, 12 GB RAM is more than enough).
       - *(Alternatively, choose AMD VM.Standard.E2.1.Micro if Ampere capacity is full in your region).*
   - **Networking**:
     - Keep **Create new virtual cloud network (VCN)**.
     - Ensure **Assign a public IPv4 address** is set to **Yes**.
   - **Add SSH keys**:
     - Choose **Generate a key pair for me** and click **Save private key** (saves a `.key` / `.pem` file to your computer) OR paste your existing public SSH key.
   - **Boot volume**:
     - Default 50 GB (up to 200 GB is free).
5. Click **Create**.
6. Wait 1–2 minutes until the instance state changes to **Running**.
7. Note your instance's **Public IP Address** (e.g. `140.xxx.xxx.xxx` or `129.xxx.xxx.xxx`).

---

## Step 2: Open Oracle Cloud Ingress Firewall (Crucial!)

Oracle Cloud has a network firewall (Security List) that blocks incoming ports 80 and 443 by default. You must open them:

1. On the instance details page, under **Instance information**, click on your **Virtual cloud network** link (e.g. `vcn-xxxxxxxx`).
2. Under **Resources** on the left, click **Security Lists**.
3. Click the **Default Security List for vcn-xxxxxxxx**.
4. Click **Add Ingress Rules**:
   - **Source Type**: `CIDR`
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `TCP`
   - **Destination Port Range**: `80,443,8000,3001`
   - **Description**: `Allow HTTP, HTTPS, FastAPI, and WhatsApp Webhooks`
5. Click **Add Ingress Rules**.

---

## Step 3: Connect to your Oracle Cloud Instance via SSH

Open your local terminal (PowerShell, Command Prompt, or Git Bash):

```bash
# Set permissions on your downloaded SSH key (if on Linux/Mac/WSL):
chmod 400 ~/Downloads/ssh-key-*.key

# Connect to your VM (Ubuntu default username is 'ubuntu'):
ssh -i "C:\path\to\your\downloaded-private-key.key" ubuntu@<YOUR_ORACLE_PUBLIC_IP>
```

---

## Step 4: Configure Ubuntu Host Firewall & Install Docker

Once inside the Oracle Cloud Ubuntu terminal:

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Allow ports in Ubuntu host firewall (Oracle Linux/Ubuntu images have internal iptables rules)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8000 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT
sudo apt install -y iptables-persistent
sudo netfilter-persistent save

# 3. Install Docker and Docker Compose Plugin
sudo apt install -y docker.io docker-compose-plugin git curl
sudo usermod -aG docker $USER
newgrp docker

# Verify docker is running:
docker --version
docker compose version
```

---

## Step 5: Clone Repository & Set Environment Variables

```bash
# 1. Clone your repository
git clone https://github.com/thiruppugazhs/StarWaves.git
cd StarWaves

# 2. Create server environment file
nano server/.env
```

Paste your configuration into `server/.env` (press `Ctrl+O` then `Enter` to save, `Ctrl+X` to exit):

```env
APP_NAME=StarWaves API
APP_ENV=production
API_V1_PREFIX=/api/v1
CORS_ORIGINS=https://*.vercel.app,http://localhost:5173
FRONTEND_URL=https://starwaves.vercel.app

# Firebase Cloud Firestore
FIREBASE_PROJECT_ID=starwaves-cec20
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@starwaves-cec20.iam.gserviceaccount.com
FIRESTORE_DATABASE_ID=(default)
GOOGLE_APPLICATION_CREDENTIALS=firebase-service-account.json

# Auth Secret Key (Replace with any random 32+ character string)
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

Next, create `server/firebase-service-account.json` on the VM:
```bash
nano server/firebase-service-account.json
```
Paste your Firebase service account JSON credentials here and save (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## Step 6: Start Backend, WhatsApp Worker & Nginx

Run Docker Compose to build and start the containers:

```bash
docker compose -f docker-compose.yml -f docker-compose.backend.yml up --build -d
```

Check the status of running containers:
```bash
docker compose -f docker-compose.yml -f docker-compose.backend.yml ps
```

Verify that the health check responds:
```bash
curl http://localhost/health
```
*(Should return: `{"status":"ok","service":"StarWaves API","environment":"production"}`).*

You can also test it from your local browser:
`http://<YOUR_ORACLE_PUBLIC_IP>/health`

---

## Step 7: Deploy Frontend on Vercel

1. Open [Vercel](https://vercel.com) &rarr; Click **Add New…** &rarr; **Project**.
2. Select your repository: **`thiruppugazhs/StarWaves`**.
3. Configure Project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`website`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:
   - `VITE_APP_NAME` = `StarWaves`
   - `VITE_API_URL` = `http://<YOUR_ORACLE_PUBLIC_IP>/api/v1`
5. Click **Deploy**.
6. Once deployed, copy your assigned Vercel URL (e.g. `https://starwaves-xxxx.vercel.app`).
7. Back on your Oracle VM, update `CORS_ORIGINS` in `server/.env` to include your Vercel URL, and reload:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.backend.yml restart server
   ```

---

## Step 8 (Optional): Free SSL Certificate (HTTPS) with Certbot

If you attach a domain or free subdomain (DuckDNS, Cloudflare, Namecheap, etc.):
1. Point your domain A record to `<YOUR_ORACLE_PUBLIC_IP>`.
2. On your VM, run:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```
3. Update `VITE_API_URL` on Vercel to `https://api.yourdomain.com/api/v1`.
