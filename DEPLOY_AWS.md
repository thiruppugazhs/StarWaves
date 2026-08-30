# StarWaves Deployment Guide: AWS Cloud + Vercel

This guide covers deploying the **StarWaves Backend & WhatsApp Worker** on **Amazon Web Services (AWS)**, paired with the **Frontend on Vercel**.

---

## Architecture

```
                    ┌───────────────────────────────┐
                    │   User / Web Browser          │
                    └──────────────┬────────────────┘
                                   │
             ┌─────────────────────┴─────────────────────┐
             │                                           │
             ▼                                           ▼
  ┌────────────────────┐                       ┌───────────────────┐
  │   Vercel (Free)    │                       │     AWS EC2       │
  │                    │                       │ (Free Tier / VM)  │
  │ • React 19 + Vite  │                       │                   │
  │ • Global Edge CDN  │                       │ • Nginx (Port 80) │
  │ • Instant routing  │                       │ • FastAPI Backend │
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

## Option 1: AWS EC2 (Free Tier Eligible)

AWS offers **750 hours/month free for 12 months** on `t2.micro` (or `t3.micro` in regions where t2 is unavailable).

### Step 1.1: Launch an EC2 Instance
1. Log in to the [AWS Management Console](https://console.aws.amazon.com/ec2).
2. Ensure you are in your preferred region (e.g. `us-east-1` N. Virginia, `ap-south-1` Mumbai, etc.).
3. Click **Launch instance**.
4. Configure the settings:
   - **Name**: `starwaves-server`
   - **Application and OS Images (AMI)**: **Ubuntu 24.04 LTS** (or Debian 12) *(Free Tier eligible)*
   - **Instance type**: **`t2.micro`** (or `t3.micro`) *(Free Tier eligible - 1 vCPU, 1 GiB RAM)*
   - **Key pair (login)**: Select an existing key pair or click **Create new key pair** (download the `.pem` file to your computer).
   - **Network settings**:
     - Check: **Allow SSH traffic from anywhere** (or your IP)
     - Check: **Allow HTTP traffic from the internet** (Port 80)
     - Check: **Allow HTTPS traffic from the internet** (Port 443)
   - **Configure storage**: **30 GiB** gp3 standard disk *(Free tier allows up to 30 GiB storage)*
5. Click **Launch instance**.

---

### Step 1.2: Connect to Your EC2 Instance via SSH

Open your local terminal or PowerShell:
```bash
# Set permissions for your downloaded key (Linux/macOS)
chmod 400 your-key.pem

# SSH into your EC2 instance (replace with your EC2 Public IPv4 DNS or IP)
ssh -i "your-key.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
```
*(Or in AWS Console, select your instance and click **Connect** &rarr; **EC2 Instance Connect** to open a terminal directly in your web browser with 1 click).*

---

### Step 1.3: Install Docker & Configure 1.5 GB Swap

On micro instances with 1 GB RAM, creating a swap file is crucial for memory stability during Docker builds:

```bash
# 1. Update system & install Docker, Docker Compose, Git
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git curl

# 2. Add ubuntu user to docker group (run docker without sudo)
sudo usermod -aG docker $USER
newgrp docker

# 3. Create a 1.5 GB swap file
sudo fallocate -l 1536M /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap is active:
free -h
```

---

### Step 1.4: Clone Repo & Configure Environment

```bash
# Clone repository
git clone https://github.com/thiruppugazhs/StarWaves.git
cd StarWaves

# Create server/.env
nano server/.env
```

Paste the following into `server/.env`:

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

# Auth Secret Key
AUTH_SECRET_KEY=starwaves-prod-aws-secret-key-928410293840192834

# StarWaves Built-in AI (Google Gemini 2.5 Flash)
DEFAULT_AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

# ElevenLabs Speech
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```
*(Press `Ctrl+O` then `Enter` to save, `Ctrl+X` to exit)*

Now create the Firebase credentials file:
```bash
nano server/firebase-service-account.json
```
*(Paste your Firebase Service Account JSON credentials for `starwaves-cec20` here, save and exit).*

---

### Step 1.5: Start Backend, WhatsApp Worker & Nginx

Run Docker Compose using the backend overlay:
```bash
docker compose -f docker-compose.yml -f docker-compose.backend.yml up --build -d
```

Verify that all containers are up and running:
```bash
docker compose -f docker-compose.yml -f docker-compose.backend.yml ps
```

Test the health check on the instance:
```bash
curl http://localhost/health
```
*(Response: `{"status":"ok","service":"StarWaves API","environment":"production"}`)*

Your backend API is now live and accessible from anywhere at:
`http://<YOUR_EC2_PUBLIC_IP>/api/v1`

---

## Option 2: AWS Lightsail (Alternative Simplest VPS)

If you prefer an all-in-one VPS with fixed pricing and 1-click web SSH:
1. Open [AWS Lightsail Console](https://lightsail.aws.amazon.com).
2. Click **Create instance**.
3. Select platform: **Linux/Unix** &rarr; OS Only: **Ubuntu 24.04 LTS**.
4. Choose the plan: **$3.50/month or $5/month** (Free for the first 3 months for new accounts).
5. In **Networking**, open ports **80** (HTTP) and **443** (HTTPS).
6. Click the orange terminal icon in the browser to SSH in, and run the exact same commands from **Step 1.3 to 1.5** above.

---

## Step 2: Deploy Frontend on Vercel

1. Open [Vercel](https://vercel.com) &rarr; **Add New…** &rarr; **Project**.
2. Select your repository: **`thiruppugazhs/StarWaves`**.
3. Set **Root Directory** to: **`website`**.
4. Framework Preset: **`Vite`**.
5. Under **Environment Variables**, add:
   - `VITE_APP_NAME` = `StarWaves`
   - `VITE_API_URL` = `http://<YOUR_EC2_PUBLIC_IP>/api/v1` (or your domain with HTTPS)
6. Click **Deploy**.
7. Once deployed, add your Vercel URL to `CORS_ORIGINS` in your EC2 `server/.env`, and reload:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.backend.yml restart server
   ```

---

## Step 3: Free Custom Domain & HTTPS with Certbot (Let's Encrypt)

When connecting a Vercel frontend (which runs on HTTPS) to your EC2 backend in production, browsers require the backend to also use HTTPS:

1. Create a DNS **A record** with your domain registrar (e.g. Namecheap, GoDaddy, Cloudflare):
   - Host: `api`
   - Points to: `<YOUR_EC2_PUBLIC_IP>`
   *(e.g. `api.yourdomain.com` &rarr; EC2 Public IP)*

2. On your EC2 instance, install Certbot and configure SSL with 1 command:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```
3. Update `VITE_API_URL` in Vercel to `https://api.yourdomain.com/api/v1` and redeploy.
