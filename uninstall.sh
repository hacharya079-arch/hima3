#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - Production Uninstaller
# Safe, clean removal of application resources, services, and configurations.
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Terminal colors for professional formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0;37m' # No Color
BOLD='\033[1m'

# Display beautiful header banner
clear
echo -e "${RED}${BOLD}==============================================================================${NC}"
echo -e "${RED}${BOLD}      ⚡ StreamPulse RTMP VPS Manager - Production Uninstaller ⚡               ${NC}"
echo -e "${RED}${BOLD}==============================================================================${NC}"
echo -e "Architect: Senior DevOps & Streaming Infrastructure Engineer"
echo -e "Date: $(date)"
echo -e "${RED}==============================================================================${NC}\n"

# 1. ROOT PRIVILEGE CHECK
echo -e "[*] Validating root privileges..."
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[- ] Error: This uninstaller must be executed with root privileges.${NC}" >&2
  echo -e "${YELLOW}Please run with: sudo ./uninstall.sh${NC}" >&2
  exit 1
fi
echo -e "${GREEN}[✔] Running as root user.${NC}\n"

# 2. INTERACTIVE CONFIRMATION (DESTRUCTIVE WARNING)
echo -e "${RED}${BOLD}⚠️  WARNING: This will permanently stop and delete the StreamPulse system service,${NC}"
echo -e "${RED}delete all generated HLS playlists/segments, and clear deployment configurations.${NC}"
read -p "Are you absolutely sure you want to uninstall StreamPulse? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo -e "${BLUE}Uninstallation canceled by user.${NC}"
  exit 0
fi
echo ""

# 3. STOP AND REMOVE SYSTEMD DAEMON SERVICE
echo -e "${BLUE}[1/5] Removing StreamPulse systemd daemon service...${NC}"
if systemctl list-units --full -all | grep -Fq 'streampulse.service'; then
  echo -e "  - Stopping streampulse service..."
  systemctl stop streampulse || true
  echo -e "  - Disabling streampulse service..."
  systemctl disable streampulse || true
fi

if [ -f "/etc/systemd/system/streampulse.service" ]; then
  echo -e "  - Deleting streampulse service unit file..."
  rm -f /etc/systemd/system/streampulse.service
fi

echo -e "  - Reloading systemd daemon config..."
systemctl daemon-reload
echo -e "${GREEN}[✔] Systemd service unregistered.${NC}\n"

# 4. REMOVE NGINX CONFIGURATION & TRANSCODE SCRIPTS
echo -e "${BLUE}[2/5] Cleaning Nginx and RTMP Transcoding configs...${NC}"
if [ -f "/etc/nginx/nginx.conf.bak" ]; then
  echo -e "  - Restoring Nginx backup config from nginx.conf.bak..."
  mv /etc/nginx/nginx.conf.bak /etc/nginx/nginx.conf
  echo -e "  - Restarting Nginx to load original state..."
  systemctl restart nginx || true
else
  echo -e "  - Removing stream-pulse configs (Nginx default configuration retained)..."
fi

if [ -f "/usr/local/bin/transcode.sh" ]; then
  echo -e "  - Removing transcode script from /usr/local/bin..."
  rm -f /usr/local/bin/transcode.sh
fi
echo -e "${GREEN}[✔] Nginx and transcoding modules cleaned.${NC}\n"

# 5. PURGE HLS PLAYLISTS & VIDEOS
echo -e "${BLUE}[3/5] Purging live HLS caches & static video chunks...${NC}"
if [ -d "/var/www/hls" ]; then
  echo -e "  - Deleting HLS directory /var/www/hls..."
  rm -rf /var/www/hls
fi
echo -e "${GREEN}[✔] Live streaming video directory deleted.${NC}\n"

# 6. OPTIONAL DATABASE REMOVAL
echo -e "${BLUE}[4/5] Inspecting PostgreSQL Database...${NC}"
read -p "Do you want to permanently drop the 'streampulse' database and 'streampulse_admin' user? (y/N): " db_confirm
if [[ "$db_confirm" =~ ^[Yy]$ ]]; then
  echo -e "  - Dropping database 'streampulse'..."
  sudo -u postgres dropdb --if-exists streampulse || true
  echo -e "  - Dropping user 'streampulse_admin'..."
  sudo -u postgres psql -c "DROP USER IF EXISTS streampulse_admin;" || true
  echo -e "${GREEN}[✔] Database resources purged successfully.${NC}\n"
else
  echo -e "  - Database resources left intact.${NC}\n"
fi

# 7. CLEAN BUILD FILES & DEPENDENCIES
echo -e "${BLUE}[5/5] Cleaning build files...${NC}"
read -p "Do you want to remove node_modules and built bundle folders? (y/N): " clean_confirm
if [[ "$clean_confirm" =~ ^[Yy]$ ]]; then
  echo -e "  - Removing node_modules and dist..."
  rm -rf node_modules dist .env
  echo -e "${GREEN}[✔] Repository assets cleaned.${NC}\n"
else
  echo -e "  - Repository assets left intact.${NC}\n"
fi

echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD}   🏁  StreamPulse Uninstallation Completed Successfully!                     ${NC}"
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "All services and components have been cleanly stopped and removed."
echo -e "==============================================================================\n"
