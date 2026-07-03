#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - Production Automated Installer
# Supported OS: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Terminal colors for professional formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0;37m' # No Color
BOLD='\033[1m'

# Display beautiful header banner
clear
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "${CYAN}${BOLD}      ⚡ StreamPulse RTMP VPS Manager - Production Installer ⚡                 ${NC}"
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "Architect: Senior DevOps & Streaming Infrastructure Engineer"
echo -e "Date: $(date)"
echo -e "${CYAN}==============================================================================${NC}\n"

# 1. ROOT PRIVILEGE CHECK
echo -e "[*] Validating root privileges..."
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[- ] Error: This installer must be executed with root privileges.${NC}" >&2
  echo -e "${YELLOW}Please run with: sudo ./install.sh${NC}" >&2
  exit 1
fi
echo -e "${GREEN}[✔] Running as root user.${NC}\n"

# 2. OS DETECTION & COMPATIBILITY CHECK
echo -e "[*] Detecting operating system and version..."
if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [ "$ID" != "ubuntu" ]; then
    echo -e "${RED}[- ] Error: StreamPulse is only officially certified on Ubuntu Linux.${NC}" >&2
    echo -e "${YELLOW}Detected OS: $NAME ($VERSION)${NC}" >&2
    exit 1
  fi
  echo -e "${GREEN}[✔] Detected compatible OS: $PRETTY_NAME${NC}\n"
else
  echo -e "${RED}[- ] Error: Cannot read /etc/os-release. Unable to determine OS compatibility.${NC}" >&2
  exit 1
fi

# 3. INTERACTIVE CONFIRMATION
echo -e "${YELLOW}This script will automatically install Nginx, Nginx-RTMP, FFmpeg, Node.js,${NC}"
echo -e "${YELLOW}PostgreSQL, Docker, and configure them for production use.${NC}"
read -p "Do you want to proceed with the installation? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo -e "${BLUE}Installation canceled by user.${NC}"
  exit 0
fi
echo ""

# 4. UPDATE SYSTEM PACKAGE LIST
echo -e "${BLUE}[1/11] Updating system package list...${NC}"
apt-get update -y
echo -e "${GREEN}[✔] Package lists updated.${NC}\n"

# 5. INSTALL UTILITIES (Git, Curl, Wget, Build-Essential, OpenSSL)
echo -e "${BLUE}[2/11] Installing core baseline system utilities...${NC}"
ESSENTIAL_PACKAGES=(git curl wget build-essential openssl gnupg2 ca-certificates)
for pkg in "${ESSENTIAL_PACKAGES[@]}"; do
  if dpkg -s "$pkg" &>/dev/null; then
    echo -e "  - ${GREEN}$pkg${NC} is already installed. Skipping."
  else
    echo -e "  - Installing ${YELLOW}$pkg${NC}..."
    apt-get install -y "$pkg"
  fi
done
echo -e "${GREEN}[✔] Core baseline utilities configured.${NC}\n"

# 6. INSTALL NODE.JS & NPM (Node 20 LTS)
echo -e "${BLUE}[3/11] Inspecting Node.js and npm state...${NC}"
if ! command -v node &>/dev/null; then
  echo -e "  - Node.js is missing. Setting up NodeSource Node.js 20.x repository..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  echo -e "  - Installing Node.js..."
  apt-get install -y nodejs
else
  echo -e "  - ${GREEN}Node.js${NC} is already installed ($(node -v)). Skipping."
fi
echo -e "${GREEN}[✔] Node.js and npm are ready.${NC}\n"

# 7. INSTALL DOCKER & DOCKER COMPOSE
echo -e "${BLUE}[4/11] Inspecting Docker and Docker Compose state...${NC}"
if ! command -v docker &>/dev/null; then
  echo -e "  - Installing Docker Engine & Compose plugin..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo -e "  - ${GREEN}Docker${NC} is already installed ($(docker --version)). Skipping."
fi
echo -e "${GREEN}[✔] Docker and Docker Compose environment verified.${NC}\n"

# 8. INSTALL POSTGRESQL (Host-based DB)
echo -e "${BLUE}[5/11] Inspecting PostgreSQL state...${NC}"
if ! dpkg -s postgresql &>/dev/null; then
  echo -e "  - Installing PostgreSQL server and contrib utilities..."
  apt-get install -y postgresql postgresql-contrib
else
  echo -e "  - ${GREEN}PostgreSQL${NC} is already installed. Skipping installation."
fi

echo -e "  - Starting and enabling PostgreSQL service..."
systemctl start postgresql
systemctl enable postgresql
echo -e "${GREEN}[✔] PostgreSQL service is active.${NC}\n"

# 9. CONFIGURE POSTGRESQL USER & DATABASE
echo -e "${BLUE}[6/11] Configuring StreamPulse database, user credentials, and tables...${NC}"
# Setup DB Role
echo -e "  - Ensuring database role 'streampulse_admin' exists..."
DB_ROLE_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='streampulse_admin'")
if [ "$DB_ROLE_EXISTS" != "1" ]; then
  sudo -u postgres psql -c "CREATE USER streampulse_admin WITH PASSWORD 'streampulse_secure_password' SUPERUSER;"
  echo -e "    - Role 'streampulse_admin' created."
else
  echo -e "    - Role 'streampulse_admin' already exists."
fi

# Setup Database
echo -e "  - Ensuring database 'streampulse' exists..."
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='streampulse'")
if [ "$DB_EXISTS" != "1" ]; then
  sudo -u postgres psql -c "CREATE DATABASE streampulse OWNER streampulse_admin;"
  echo -e "    - Database 'streampulse' created."
else
  echo -e "    - Database 'streampulse' already exists."
fi

# Seeding Table schemas from schema.sql
if [ -f "./vps-deployment/schema.sql" ]; then
  echo -e "  - Initializing tables using vps-deployment/schema.sql..."
  PGPASSWORD=streampulse_secure_password psql -h 127.0.0.1 -U streampulse_admin -d streampulse -f ./vps-deployment/schema.sql >/dev/null
  echo -e "    - Database schema populated successfully."
else
  echo -e "    - ${YELLOW}Warning:${NC} ./vps-deployment/schema.sql schema file not found. Skipping SQL seeding."
fi
echo -e "${GREEN}[✔] PostgreSQL database initialized successfully.${NC}\n"

# 10. GENERATE PRODUCTION ENV FILE
echo -e "${BLUE}[7/11] Inspecting environment configurations (.env)...${NC}"
if [ ! -f ".env" ]; then
  echo -e "  - Creating fresh .env file based on .env.example..."
  cp .env.example .env
  
  # Inject fresh random JWT secret
  RANDOM_JWT=$(openssl rand -hex 24)
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=${RANDOM_JWT}/g" .env
  
  echo -e "    - Created .env file and generated custom JWT Secret key."
else
  echo -e "  - ${GREEN}.env${NC} file already exists. Skipping rewrite to prevent overwriting keys."
fi
echo -e "${GREEN}[✔] Environment configurations are secured.${NC}\n"

# 11. INSTALL APP DEPENDENCIES & BUILD APPLET
echo -e "${BLUE}[8/11] Building the full stack StreamPulse Node/React system...${NC}"
echo -e "  - Running npm package installation (safe production mode)..."
npm install --no-audit --no-fund
echo -e "  - Compiling frontend Vite SPA assets & bundling server.ts via esbuild..."
npm run build
echo -e "${GREEN}[✔] Production code assets successfully built inside dist/ directory.${NC}\n"

# 12. INSTALL & CONFIGURE NGINX + RTMP MODULE + FFMPEG
echo -e "${BLUE}[9/11] Installing and configuring Nginx, RTMP Module, and FFmpeg...${NC}"
# Install Nginx + RTMP module if missing
if ! dpkg -s nginx &>/dev/null || ! dpkg -s libnginx-mod-rtmp &>/dev/null; then
  echo -e "  - Installing Nginx and RTMP ingestion module..."
  apt-get install -y nginx libnginx-mod-rtmp
else
  echo -e "  - ${GREEN}Nginx and Nginx RTMP module${NC} are already installed."
fi

# Install FFmpeg
if ! command -v ffmpeg &>/dev/null; then
  echo -e "  - Installing FFmpeg transcode binary..."
  apt-get install -y ffmpeg
else
  echo -e "  - ${GREEN}FFmpeg${NC} is already installed."
fi

# Set up transcode script
echo -e "  - Setting up global transcoding launcher /usr/local/bin/transcode.sh..."
cp ./vps-deployment/transcode.sh /usr/local/bin/transcode.sh
chmod +x /usr/local/bin/transcode.sh

# Ensure HLS and Transcode logs directories exist
echo -e "  - Making HLS directories and granting Nginx permissions..."
mkdir -p /var/www/hls
chown -R www-data:www-data /var/www/hls
chmod -R 775 /var/www/hls

# Backing up default Nginx configurations
if [ -f "/etc/nginx/nginx.conf" ] && [ ! -f "/etc/nginx/nginx.conf.bak" ]; then
  echo -e "  - Backing up original /etc/nginx/nginx.conf to nginx.conf.bak..."
  cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
fi

# Injecting clean unified HTTP/RTMP Nginx configuration
echo -e "  - Generating unified /etc/nginx/nginx.conf with RTMP dynamic transcoder..."
cat << 'EOF' > /etc/nginx/nginx.conf
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 1024;
}

# Real-Time Messaging Protocol (RTMP) Configuration
rtmp {
    server {
        listen 1935;
        chunk_size 4096;

        # Standard Multi-Bitrate Ingestion Application
        application live {
            live on;
            record off;
            # Push RTMP stream to transcode.sh to trigger background FFmpeg profiles
            exec_push /usr/local/bin/transcode.sh $name;
        }

        # Raw bypass app
        application raw {
            live on;
            record off;
            hls on;
            hls_path /var/www/hls/raw;
            hls_fragment 3;
            hls_playlist_length 60;
        }
    }
}

# HTTP Web Server & Proxy Configuration
http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;
    gzip_disable "msie6";

    server {
        listen 80;
        server_name _; # Respond to any domain name or IP Address

        # StreamPulse Application Dashboard Proxy
        location / {
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Static HLS Playlists & ts fragment Delivery (CORS Enabled)
        location /hls/ {
            alias /var/www/hls/;
            
            add_header Access-Control-Allow-Origin * always;
            add_header Access-Control-Expose-Headers Content-Length,Content-Range always;
            add_header Access-Control-Allow-Methods 'GET, HEAD, OPTIONS' always;
            add_header Access-Control-Allow-Headers 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;

            if ($request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' '*';
                add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS';
                add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
                add_header 'Access-Control-Max-Age' 1728000;
                add_header 'Content-Type' 'text/plain; charset=utf-8';
                add_header 'Content-Length' 0;
                return 204;
            }

            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }

            expires -1; # Disable HLS file caching to ensure low playback delay
        }
    }
}
EOF

# Restarting and enabling Nginx service
echo -e "  - Activating Nginx configurations..."
systemctl daemon-reload
systemctl restart nginx
systemctl enable nginx
echo -e "${GREEN}[✔] Nginx server and RTMP module fully active.${NC}\n"

# 13. REGISTER SYSTEMD SERVICE FOR APPLICATION
echo -e "${BLUE}[10/11] Registering StreamPulse as a systemd service...${NC}"
APP_DIR=$(pwd)
cat << EOF > /etc/systemd/system/streampulse.service
[Unit]
Description=StreamPulse RTMP VPS Manager Service
After=network.target postgresql.service nginx.service

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

echo -e "  - Starting StreamPulse service daemon..."
systemctl daemon-reload
systemctl enable streampulse
systemctl restart streampulse
echo -e "${GREEN}[✔] StreamPulse systemd service registered and booted.${NC}\n"

# 14. VERIFY EVERYTHING IS RUNNING
echo -e "${BLUE}[11/11] Performing live systems verification checks...${NC}"
sleep 3 # Allow a brief moment for services to bind ports

CHECKS_PASSED=true

# Check PostgreSQL
if systemctl is-active --quiet postgresql; then
  echo -e "  - PostgreSQL Service Status: ${GREEN}[ ACTIVE ]${NC}"
else
  echo -e "  - PostgreSQL Service Status: ${RED}[ FAILED ]${NC}"
  CHECKS_PASSED=false
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
  echo -e "  - Nginx RTMP Web Status:     ${GREEN}[ ACTIVE ]${NC}"
else
  echo -e "  - Nginx RTMP Web Status:     ${RED}[ FAILED ]${NC}"
  CHECKS_PASSED=false
fi

# Check StreamPulse Application
if systemctl is-active --quiet streampulse; then
  echo -e "  - StreamPulse App Daemon:    ${GREEN}[ ACTIVE ]${NC}"
else
  echo -e "  - StreamPulse App Daemon:    ${RED}[ FAILED ]${NC}"
  CHECKS_PASSED=false
fi

# Check RTMP Port 1935 Ingestion
if ss -tuln | grep -q ":1935"; then
  echo -e "  - RTMP Ingest Port 1935:     ${GREEN}[ OPEN / LISTENING ]${NC}"
else
  echo -e "  - RTMP Ingest Port 1935:     ${RED}[ CLOSED ]${NC}"
  CHECKS_PASSED=false
fi

# Check HTTP Port 80 Web Panel
if ss -tuln | grep -q ":80"; then
  echo -e "  - Web Panel HTTP Port 80:    ${GREEN}[ OPEN / LISTENING ]${NC}"
else
  echo -e "  - Web Panel HTTP Port 80:    ${RED}[ CLOSED ]${NC}"
  CHECKS_PASSED=false
fi

echo ""

if [ "$CHECKS_PASSED" = true ]; then
  echo -e "${GREEN}${BOLD}==============================================================================${NC}"
  echo -e "${GREEN}${BOLD}   🏁  StreamPulse Installation Completed Successfully! (PASS)               ${NC}"
  echo -e "${GREEN}${BOLD}==============================================================================${NC}"
  echo -e "\nYour video streaming platform is fully online and production-ready."
  echo -e "You can access the admin dashboard by visiting: ${CYAN}http://<YOUR_VPS_IP>${NC}"
  echo -e "RTMP stream ingests can be pushed to:         ${CYAN}rtmp://<YOUR_VPS_IP>/live${NC}"
  echo -e "\n${BOLD}Default Admin Credentials:${NC}"
  echo -e "  - Username: ${CYAN}admin${NC}"
  echo -e "  - Password: ${CYAN}admin123${NC}"
  echo -e "\n${YELLOW}To check logs at any time, run: journalctl -u streampulse -f${NC}"
  echo -e "==============================================================================\n"
else
  echo -e "${RED}${BOLD}==============================================================================${NC}"
  echo -e "${RED}${BOLD}   ❌  StreamPulse Installation completed with errors. (FAIL)                 ${NC}"
  echo -e "${RED}${BOLD}==============================================================================${NC}"
  echo -e "Please check systemctl logs using: journalctl -xe"
  echo -e "==============================================================================\n"
  exit 1
fi
