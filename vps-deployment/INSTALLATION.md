# StreamPulse: Complete VPS Production Deployment Guide

This document provides step-by-step instructions for deploying the **StreamPulse RTMP VPS Manager** on a production-grade Linux Server.

---

## 1. Production Requirements

For stable operation of 100 concurrent streams and up to 10,000 viewers, we recommend the following server sizing specifications:

### Hardware Specifications

| Multi-Bitrate Streams | Concurrent Viewers | CPU Cores | RAM | Storage Type | Bandwidth/Port |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1-5 Streams** | 100-500 | 4 Cores | 8 GB | SSD | 1 Gbps |
| **10-30 Streams** | 1,000-3,000 | 16 Cores | 32 GB | NVMe SSD | 10 Gbps |
| **50-100 Streams** | 5,000-10,000 | 32 Cores | 64 GB | NVMe SSD | 10 Gbps + CDN |

*Note: Live transcoding is heavily CPU-bound. If available, use a VPS with GPU acceleration (NVIDIA NVENC support) to drastically offload transcoding workloads.*

---

## 2. Domain & DNS Setup Guide

1. **Purchase a Domain Name** from standard registrars (e.g., Namecheap, Cloudflare Registrar, GoDaddy).
2. **Configure DNS Records**:
   - Access your DNS Manager / Domain Control Panel.
   - Add an **A Record** pointing to your VPS Public IP Address:
     - **Type**: `A`
     - **Name**: `streampulse` (or `@` for root domain)
     - **Value**: `YOUR_VPS_PUBLIC_IP`
     - **TTL**: `Auto` or `3600`
3. **Cloudflare Proxy Settings (If using Cloudflare)**:
   - For RTMP (port 1935) to work directly, set the DNS entry to **DNS Only** (grey cloud). Cloudflare CDN proxies only HTTP (80/443) traffic, unless using Cloudflare Spectrum.

---

## 3. Ubuntu 24.04 LTS Installation & VPS Setup Guide

Follow these SSH steps to configure your clean Ubuntu VPS:

### Step 3.1: System Updates & Baseline Security
Connect to your server via SSH:
```bash
ssh root@YOUR_VPS_PUBLIC_IP
```

Perform updates and install standard utilities:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw fail2ban htop unzip
```

### Step 3.2: Configure Firewall (UFW)
Open critical ports for SSH, Web, and RTMP ingestion:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS Secure
sudo ufw allow 1935/tcp    # RTMP Ingest
sudo ufw allow 5432/tcp    # Postgres Direct (Optional, secure this)
sudo ufw --force enable
```

### Step 3.3: Configure Fail2Ban Protection
Prevent brute-force authentication attacks on SSH:
```bash
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Step 3.4: One-Click Native Systemd Installer (Option A)
If you prefer running StreamPulse natively directly on the host VPS (to maximize CPU/GPU utilization for FFmpeg transcoding and utilize a dedicated system-level unprivileged user):

1. **Clone the repository and enter the directory**:
   ```bash
   git clone <your-repository-url>
   cd streampulse-vps-manager
   ```

2. **Make the scripts executable**:
   ```bash
   chmod +x install.sh check.sh uninstall.sh
   ```

3. **Launch the automatic installer**:
   ```bash
   sudo ./install.sh
   ```
   This will completely automate:
   - NodeSource Node.js 20.x GPG key signature & repository configuration.
   - Dedicated unprivileged system user (`streampulse`) creation & file permission setup.
   - Secure PostgreSQL system role configuration (`NOSUPERUSER`) and schema initialization.
   - Nginx core installation + RTMP stream profile ingestion module integration.
   - Systemd background service daemon registration.
   - Certbot automatic Let's Encrypt SSL certificate generation.
   - UFW firewall & Fail2Ban jail activation.

### Step 3.5: Health & Security Audits
To inspect your local services, hardware limits, log permissions, database credentials, and jail configurations at any point:
```bash
sudo ./check.sh
```

### Step 3.6: Native Decommission & Uninstall
To cleanly wipe or revert the native StreamPulse setup from your host server, support interactive prompt or non-interactive mode (`--yes` or `NON_INTERACTIVE=true`):
```bash
sudo ./uninstall.sh
```
Or for non-interactive automated teardowns:
```bash
sudo ./uninstall.sh --yes
```

---

## 4. Docker & Docker Compose Setup (Option B)

Deploying via Docker is the highly recommended approach as it bundles Nginx, RTMP Module, FFmpeg, Node.js, and PostgreSQL into a secure microservice net.

### Step 4.1: Install Docker Engine
```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

# Install Docker packages:
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Step 4.2: Verify Docker Installation
```bash
sudo docker --version
sudo docker compose version
```

---

## 5. SSL & HTTPS Setup using Let's Encrypt

1. Install certbot standalone tool on your host VPS:
   ```bash
   sudo apt install -y certbot
   ```
2. Request a standalone Let's Encrypt SSL Certificate:
   ```bash
   sudo certbot certonly --standalone -d streampulse.yourdomain.com --agree-tos -m admin@yourdomain.com
   ```
3. Copy/Mount these certificate paths inside your `docker-compose.yml` volumes as configured:
   - Certificate Fullchain: `/etc/letsencrypt/live/streampulse.yourdomain.com/fullchain.pem`
   - Private Key: `/etc/letsencrypt/live/streampulse.yourdomain.com/privkey.pem`

---

## 6. One-Click Docker Deploy

With Docker and certificates ready, fetch the codebase and launch:

```bash
# Clone your StreamPulse repository
git clone https://github.com/your-username/streampulse-vps-manager.git
cd streampulse-vps-manager/vps-deployment

# Update domains in nginx.conf and docker-compose.yml
# Substitute: streampulse.yourdomain.com with your real domain

# Startup the infrastructure using Docker Compose
sudo docker compose up -d --build
```

Verify that all three services are fully running:
```bash
sudo docker compose ps
```

Your system is now online! Access the dashboard via `https://streampulse.yourdomain.com`.

---

## 7. Backup & Recovery Strategy

### Automated Backups
Create a daily cron job file at `/etc/cron.daily/streampulse-backup`:
```bash
#!/bin/bash
BACKUP_DIR="/backups/streampulse"
DATE=$(date +%Y-%m-%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 1. Dump PostgreSQL Database
docker exec streampulse_db pg_dump -U streampulse_admin streampulse > $BACKUP_DIR/db_backup_$DATE.sql

# 2. Compress Stream Key configurations
tar -czf $BACKUP_DIR/config_backup_$DATE.tar.gz /var/lib/docker/volumes/vps-deployment_hls_storage/_data

# 3. Clean backups older than 14 days
find $BACKUP_DIR -type f -mtime +14 -delete
```
Make the backup script executable:
```bash
sudo chmod +x /etc/cron.daily/streampulse-backup
```

### Recovery Procedure
If your server suffers a hardware failure, deploy a fresh Ubuntu VPS and run:
```bash
# 1. Re-install Docker and run Docker Compose up -d
# 2. Restore PostgreSQL Database dump:
cat db_backup_YYYY-MM-DD.sql | docker exec -i streampulse_db psql -U streampulse_admin -d streampulse

# 3. Extract stream configs:
tar -xzf config_backup_YYYY-MM-DD.tar.gz -C /var/lib/docker/volumes/vps-deployment_hls_storage/_data
```
The manager will boot with historical data restored!
