# StarWaves Deployment Guide: Oracle Cloud (OCI Always Free) + Vercel

Oracle Cloud Infrastructure (OCI) offers the most generous **Always Free** tier in cloud computing:
- **Compute**: Ampere A1 ARM (`VM.Standard.A1.Flex`) with up to **4 OCPUs and 24 GB RAM** (100% Free Forever).
- **Storage**: Up to **200 GB** free block volume storage.
- **Networking**: **10 TB** outbound bandwidth per month free.
- **Frontend (`website/`)**: Hosted on **Vercel** with instant global CDN and zero configuration.

---

## Architecture Overview

```
                        ┌───────────────────────────────┐
                        │       User / Browser          │
                        └──────────────┬────────────────┘
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 │                                           │
                 ▼                                           ▼
      ┌────────────────────┐                   ┌───────────────────────────┐
      │   Vercel (Free)    │                   │   Oracle Cloud VM         │
      │                    │                   │   (4 OCPU, 24GB RAM Free) │
      │ • React 19 + Vite  │                   │                           │
      │ • Global Edge CDN  │                   │ • Nginx Reverse Proxy     │
      │ • Fast static SPA  │                   │ • FastAPI Backend (8000)  │
      │                    │                   │ • WhatsApp Worker (3001)  │
      └─────────┬──────────┘                   │ • Redis Cache (6379)      │
                │                              └─────────────┬─────────────┘
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

## Part 1: Create Your Always Free VM on Oracle Cloud

### Step 1.1: Launch the VM Instance
1. Log in to your [Oracle Cloud Console](https://cloud.oracle.com).
2. Navigate to **Compute** &rarr; **Instances** (or search "Instances" in the top bar).
3. Click **Create Instance**.
4. Configure the instance:
   - **Name**: `starwaves-server`
   - **Compartment**: (Leave default root compartment)
   - **Placement**: (Leave default availability domain)
   - **Image and shape**:
     - Click **Change image**: Select **Canonical Ubuntu** &rarr; **Ubuntu 24.04** (or Ubuntu 22.04 Minimal aarch64).
     - Click **Change shape**:
       - Select **Ampere** (ARM Processor).
       - Select **VM.Standard.A1.Flex** (*Always Free Eligible* badge).
       - Allocate: **2 OCPUs** and **12 GB RAM** (or up to 4 OCPUs and 24 GB RAM).
   - **Networking**:
     - Virtual cloud network: Create new VCN (default).
     - Subnet: Create new public subnet (default).
     - Assign a public IPv4 address: **Yes**.
   - **Add SSH keys**:
     - Select **Generate a key pair for me** and click **Save private key** (save `ssh-key-*.key` to your computer).
     - Or paste your existing public SSH key.
   - **Boot volume**:
     - Check **Specify a custom boot volume size**: Enter **50 GB** to **100 GB** (free up to 200 GB).
5. Click **Create**. The instance will provision and turn green (**Running**) in about 60 seconds.
6. Copy your **Public IP Address** (e.g. `129.xxx.xxx.xxx`).

---

### Step 1.2: Open Ports 80 and 443 in Oracle Cloud Security List (Crucial!)
*By default, Oracle Cloud blocks all incoming traffic except SSH (port 22). You MUST open ports 80 and 443:*

1. In the instance details page, under **Instance Information**, click on your **Virtual Cloud Network** link (e.g. `vcn-...`).
2. On the VCN page, click on **Security Lists** on the left menu.
3. Click on the **Default Security List for vcn-...**.
4. Click **Add Ingress Rules**:
   - **Source Type**: `CIDR`
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `TCP`
   - **Destination Port Range**: `80,443`
   - **Description**: `HTTP and HTTPS for StarWaves`
5. Click **Add Ingress Rules**.

---

## Part 2: Connect via SSH & Configure the VM

### Step 2.1: SSH into your Instance
On your local computer (PowerShell, Terminal, or Git Bash):
```bash
# If using the downloaded private key (chmod 400 on Mac/Linux or use SSH in Windows):
ssh -i /path/to/your-private-key.key ubuntu@<YOUR_ORACLE_PUBLIC_IP>
```

### Step 2.2: Open Ubuntu OS Firewall
Oracle's Ubuntu image includes restrictive internal `iptables` rules that reject ports 80 and 443. Run this to allow web traffic:

```bash
# Allow HTTP and HTTPS in OS firewall
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### Step 2.3: Install Docker & Git
```bash
# Update and install Docker + Git
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git curl

# Add ubuntu user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

---

## Part 3: Deploy StarWaves on the VM

### Step 3.1: Clone the Repository
```bash
git clone https://github.com/thiruppugazhs/StarWaves.git
cd StarWaves
```

### Step 3.2: Configure `server/.env`
```bash
nano server/.env
```
Paste your production settings:
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

# Auth Key (any random string)
AUTH_SECRET_KEY=starwaves-prod-secret-928172948192841029

# Gemini AI (Built-in)
DEFAULT_AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

# ElevenLabs TTS
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```
*(Press `Ctrl+O` then `Enter` to save, `Ctrl+X` to exit)*

### Step 3.3: Add Firebase Service Account Key
```bash
nano server/firebase-service-account.json
```
*(Paste your `starwaves-cec20` service account JSON contents here and save).*

---

### Step 3.4: Launch the Entire Backend Stack
Run Docker Compose with the backend-only overlay:
```bash
docker compose -f docker-compose.yml -f docker-compose.backend.yml up --build -d
```

Check the status of all containers:
```bash
docker compose -f docker-compose.yml -f docker-compose.backend.yml ps
```

Verify backend health:
```bash
curl http://localhost/health
# Response: {"status":"ok","service":"StarWaves API","environment":"production"}
```

Your backend API is now online at:
`http://<YOUR_ORACLE_PUBLIC_IP>/api/v1`

---

## Part 4: Deploy Frontend on Vercel

1. Open [Vercel](https://vercel.com) &rarr; **Add New…** &rarr; **Project**.
2. Select your repository: **`thiruppugazhs/StarWaves`**.
3. In **Project Configuration**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`website`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:
   - `VITE_APP_NAME` = `StarWaves`
   - `VITE_API_URL` = `http://<YOUR_ORACLE_PUBLIC_IP>/api/v1` (or your domain with HTTPS)
5. Click **Deploy**.
6. Once deployed, copy your Vercel URL (e.g. `https://starwaves-xxxx.vercel.app`).
7. Update `CORS_ORIGINS` in your Oracle VM `server/.env` to include your Vercel URL, and reload:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.backend.yml restart server
   ```

---

## Part 5 (Recommended): Free SSL / HTTPS with Certbot

If you attach a custom domain or free subdomain (e.g. `api.yourdomain.com` pointing to `<YOUR_ORACLE_PUBLIC_IP>`):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```
Then update `VITE_API_URL` on Vercel to `https://api.yourdomain.com/api/v1`!
