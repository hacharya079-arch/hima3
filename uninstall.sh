#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - Enterprise-Grade Automated Uninstaller
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
echo -e "Date:      $(date)"
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
echo -e "${RED}delete all generated HLS/DASH playlists/segments, backups, and clear deployment configurations.${NC}"
read -p "Are you absolutely sure you want to uninstall StreamPulse? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo -e "${BLUE}Uninstallation canceled by user.${NC}"
  exit 0
fi
echo ""

# 3. STOP AND REMOVE SYSTEMD DAEMON SERVICE
echo -e "${BLUE}[1/8] Removing StreamPulse systemd daemon service...${NC}"
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
echo -e "${BLUE}[2/8] Restoring Nginx configurations...${NC}"

# Find the latest nginx backup to restore
LATEST_BACKUP=$(ls -td /etc/nginx/nginx.conf.bak.* 2>/dev/null | head -n 1 || true)

if [ -f "$LATEST_BACKUP" ]; then
  echo -e "  - Restoring Nginx main configuration from backup: $LATEST_BACKUP..."
  cp -f "$LATEST_BACKUP" /etc/nginx/nginx.conf
else
  # Check for original general backup
  if [ -f "/etc/nginx/nginx.conf.bak" ]; then
    echo -e "  - Restoring Nginx main configuration from backup: /etc/nginx/nginx.conf.bak..."
    cp -f /etc/nginx/nginx.conf.bak /etc/nginx/nginx.conf
  else
    echo -e "  - No Nginx main configuration backup found. Keeping current main config."
  fi
fi

# Clean StreamPulse specific site config files
if [ -f "/etc/nginx/sites-enabled/streampulse" ]; then
  echo -e "  - Removing virtual site symlink from sites-enabled..."
  rm -f /etc/nginx/sites-enabled/streampulse
fi

if [ -f "/etc/nginx/sites-available/streampulse" ]; then
  echo -e "  - Deleting site available configuration..."
  rm -f /etc/nginx/sites-available/streampulse
fi

# Re-enable default Nginx site if it exists in available
if [ -f "/etc/nginx/sites-available/default" ] && [ ! -f "/etc/nginx/sites-enabled/default" ]; then
  echo -e "  - Re-linking default Nginx virtual host..."
  ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
fi

# Test and reload Nginx
echo -e "  - Validating and restarting Nginx..."
if nginx -t &>/dev/null; then
  systemctl restart nginx || true
else
  echo -e "  - ${YELLOW}Warning:${NC} Nginx syntax errors encountered after cleanup. Reload skipped."
fi

# Clean up transcode script
if [ -f "/usr/local/bin/transcode.sh" ]; then
  echo -e "  - Removing transcoding launcher /usr/local/bin/transcode.sh..."
  rm -f /usr/local/bin/transcode.sh
fi
echo -e "${GREEN}[✔] Nginx server and transcode dependencies cleaned.${NC}\n"

# 5. PURGE HLS PLAYLISTS & VIDEOS
echo -e "${BLUE}[3/8] Purging live HLS & DASH caches & video chunks...${NC}"
if [ -d "/var/www/hls" ]; then
  echo -e "  - Deleting media directory /var/www/hls..."
  rm -rf /var/www/hls
fi
echo -e "${GREEN}[✔] Live streaming video caches deleted.${NC}\n"

# 6. FAIL2BAN CLEANUP
echo -e "${BLUE}[4/8] Cleaning up Fail2Ban jail protections...${NC}"
if [ -f "/etc/fail2ban/jail.local" ]; then
  echo -e "  - Removing custom StreamPulse jail.local rules..."
  rm -f /etc/fail2ban/jail.local
  systemctl restart fail2ban || true
fi
echo -e "${GREEN}[✔] Fail2Ban reset successfully.${NC}\n"

# 7. LOG ROTATION & BACKUP CRON REMOVAL
echo -e "${BLUE}[5/8] Cleaning up log rotation policies and background timers...${NC}"
if [ -f "/etc/logrotate.d/streampulse" ]; then
  echo -e "  - Deleting log rotation file..."
  rm -f /etc/logrotate.d/streampulse
fi

if [ -f "/etc/cron.daily/streampulse-backup" ]; then
  echo -e "  - Removing daily background backup script..."
  rm -f /etc/cron.daily/streampulse-backup
fi

read -p "Do you want to permanently delete all automated backups under /var/backups/streampulse? (y/N): " backup_confirm
if [[ "$backup_confirm" =~ ^[Yy]$ ]]; then
  echo -e "  - Removing backups directory..."
  rm -rf /var/backups/streampulse
fi

read -p "Do you want to permanently delete all system logs under /var/log/streampulse? (y/N): " logs_confirm
if [[ "$logs_confirm" =~ ^[Yy]$ ]]; then
  echo -e "  - Removing logs directory..."
  rm -rf /var/log/streampulse
fi
echo -e "${GREEN}[✔] Logging and system timers cleared.${NC}\n"

# 8. FIREWALL (UFW) CLEANUP
echo -e "${BLUE}[6/8] Cleaning firewall rules...${NC}"
if command -v ufw &>/dev/null; then
  echo -e "  - Deleting StreamPulse port rule allowances..."
  ufw delete allow 80/tcp || true
  ufw delete allow 443/tcp || true
  ufw delete allow 1935/tcp || true
  echo -e "${GREEN}[✔] Firewall rules cleaned up.${NC}\n"
fi

# 9. POSTGRESQL DATABASE REMOVAL
echo -e "${BLUE}[7/8] Inspecting PostgreSQL Database...${NC}"
DB_RAND_USER="streampulse_admin"
DB_RAND_NAME="streampulse"

if [ -f ".env" ]; then
  DB_RAND_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | xargs || true)
  DB_RAND_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2 | xargs || true)
fi

DB_RAND_USER=${DB_RAND_USER:-"streampulse_admin"}
DB_RAND_NAME=${DB_RAND_NAME:-"streampulse"}

read -p "Do you want to permanently drop the database '$DB_RAND_NAME' and user role '$DB_RAND_USER'? (y/N): " db_confirm
if [[ "$db_confirm" =~ ^[Yy]$ ]]; then
  echo -e "  - Dropping database '$DB_RAND_NAME'..."
  sudo -u postgres dropdb --if-exists "$DB_RAND_NAME" || true
  echo -e "  - Dropping database user '$DB_RAND_USER'..."
  sudo -u postgres psql -c "DROP USER IF EXISTS $DB_RAND_USER;" || true
  echo -e "${GREEN}[✔] Database resources successfully purged.${NC}\n"
else
  echo -e "  - Database resources left intact.${NC}\n"
fi

# 10. REPOSITORY CLEANUP
echo -e "${BLUE}[8/8] Cleaning build folders and environment secrets...${NC}"
read -p "Do you want to remove node_modules, generated build output (dist), and .env file? (y/N): " clean_confirm
if [[ "$clean_confirm" =~ ^[Yy]$ ]]; then
  echo -e "  - Removing node_modules, dist, and .env..."
  rm -rf node_modules dist .env
  echo -e "${GREEN}[✔] Repository assets cleaned.${NC}\n"
else
  echo -e "  - Repository assets left intact.${NC}\n"
fi

echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD}   🏁  StreamPulse Uninstallation Completed Successfully!                     ${NC}"
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "All services and system components have been cleanly stopped and removed."
echo -e "==============================================================================\n"
