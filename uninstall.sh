#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - High-Performance Platform Uninstaller
# Supported OS: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
# ==============================================================================

# Exit immediately if a command fails in an unexpected way
set -uo pipefail

# Get the absolute path of the directory containing this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Terminal colors for professional formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0;37m' # No Color
BOLD='\033[1m'

# Formatting helpers
print_header() {
  echo -e "\n${RED}${BOLD}==============================================================================${NC}"
  echo -e "${RED}${BOLD}   ⚠️  StreamPulse Platform Uninstallation & Clean-up Utility                  ${NC}"
  echo -e "${RED}${BOLD}==============================================================================${NC}"
  echo -e "Timestamp: $(date)"
  echo -e "OS:        $(cat /etc/os-release | grep "PRETTY_NAME" | cut -d'=' -f2 | tr -d '\"' 2>/dev/null || echo 'Ubuntu')"
  echo -e "${RED}==============================================================================${NC}\n"
}

# 1. Root privilege validation
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[✖] Error: This uninstaller must be executed with root privileges.${NC}" >&2
  echo -e "${YELLOW}Please run with: sudo ./uninstall.sh${NC}" >&2
  exit 1
fi

print_header

# Parse command line options for non-interactive execution
NON_INTERACTIVE=false
PURGE_DB=false

# Support environment variable override or command-line arguments
if [ "${NON_INTERACTIVE:-false}" = "true" ]; then
  NON_INTERACTIVE=true
  PURGE_DB=true
fi

for arg in "$@"; do
  case $arg in
    --yes|--non-interactive|-y)
      NON_INTERACTIVE=true
      PURGE_DB=true
      ;;
  esac
done

if [ "$NON_INTERACTIVE" = "true" ]; then
  echo -e "${GREEN}[✔] Non-interactive mode activated. Proceeding with full StreamPulse decommission...${NC}\n"
else
  # Interactive prompt for confirmation
  echo -e "${YELLOW}${BOLD}WARNING: This utility will completely decommission and remove StreamPulse services!${NC}"
  echo -e "This will stop streaming, delete live video playlists, and optionally drop databases."
  read -p "Are you absolutely sure you want to proceed? (y/N): " confirm_uninstall
  if [[ ! "$confirm_uninstall" =~ ^[Yy]$ ]]; then
    echo -e "\n${GREEN}[✔] Uninstallation canceled. StreamPulse remains active.${NC}\n"
    exit 0
  fi

  # Ask about database deletion
  read -p "Do you also want to delete the PostgreSQL database and admin user role? (y/N): " confirm_db
  if [[ "$confirm_db" =~ ^[Yy]$ ]]; then
    PURGE_DB=true
  fi
fi

echo -e "\n${BLUE}[*] Decommissioning StreamPulse background services...${NC}"

# 1. Stop and Disable Systemd Daemon Service
if systemctl list-units --full -all | grep -Fq "streampulse.service"; then
  echo -e "  - Stopping streampulse systemd service..."
  systemctl stop streampulse || true
  echo -e "  - Disabling streampulse systemd service..."
  systemctl disable streampulse || true
  echo -e "  - Removing streampulse service file..."
  rm -f /etc/systemd/system/streampulse.service
  systemctl daemon-reload
  echo -e "  [${GREEN}✔${NC}] Systemd service successfully decommissioned."
else
  echo -e "  - Systemd service 'streampulse' was not active. Skipping."
fi

# 2. Revert Nginx configurations and disable virtual host
echo -e "\n${BLUE}[*] Reverting Nginx configuration and removing virtual host...${NC}"
if [ -f "/etc/nginx/sites-enabled/streampulse" ]; then
  echo -e "  - Disabling virtual host..."
  rm -f /etc/nginx/sites-enabled/streampulse
fi
if [ -f "/etc/nginx/sites-available/streampulse" ]; then
  echo -e "  - Removing virtual host config file..."
  rm -f /etc/nginx/sites-available/streampulse
fi

# Check if there is an Nginx backup config to restore
NGINX_BACKUPS=$(ls /etc/nginx/nginx.conf.bak.* 2>/dev/null || true)
if [ -n "$NGINX_BACKUPS" ]; then
  LATEST_BACKUP=$(ls -t /etc/nginx/nginx.conf.bak.* | head -n 1)
  echo -e "  - Restoring Nginx core backup: ${CYAN}$LATEST_BACKUP${NC}"
  cp -f "$LATEST_BACKUP" /etc/nginx/nginx.conf
else
  # If no backup, at least attempt to remove the RTMP block from nginx.conf
  if grep -q "rtmp {" /etc/nginx/nginx.conf; then
    echo -e "  - RTMP block found in Nginx configuration. Restoring default if possible."
    # We can advise user to reinstall nginx-light or we can leave it. To be safe, we let nginx know.
  fi
fi

# Re-enable default site if it exists in sites-available
if [ -f "/etc/nginx/sites-available/default" ] && [ ! -f "/etc/nginx/sites-enabled/default" ]; then
  echo -e "  - Re-enabling Nginx default template virtual host..."
  ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
fi

# Validate Nginx syntax and restart
echo -e "  - Validating Nginx configuration syntax..."
if nginx -t &>/dev/null; then
  systemctl restart nginx || true
  echo -e "  [${GREEN}✔${NC}] Nginx configuration successfully restored and restarted."
else
  echo -e "  [${YELLOW}⚠️${NC}] Nginx config contains errors. Please check manually with: nginx -t"
fi

# 3. Delete Transcoder Launch Script and Live Playlists
echo -e "\n${BLUE}[*] Deleting live HLS/DASH media files and streaming scripts...${NC}"
if [ -f "/usr/local/bin/transcode.sh" ]; then
  echo -e "  - Removing transcoder launcher script..."
  rm -f /usr/local/bin/transcode.sh
fi

if [ -d "/var/www/hls" ]; then
  echo -e "  - Purging HLS live stream segments folder..."
  rm -rf /var/www/hls
  echo -e "  [${GREEN}✔${NC}] HLS media paths deleted."
fi

# Resolve production directory if installed, otherwise use current directory
ACTIVE_DIR="/opt/streampulse"
if [ ! -d "$ACTIVE_DIR" ]; then
  ACTIVE_DIR="$SCRIPT_DIR"
fi

# 4. PostgreSQL Purge (Optional)
if [ "$PURGE_DB" = true ]; then
  echo -e "\n${BLUE}[*] Purging database schemas and admin roles from PostgreSQL...${NC}"
  
  # Read credentials from local .env if available, stripping quotes
  DB_USER=""
  DB_NAME=""
  if [ -f "$ACTIVE_DIR/.env" ]; then
    DB_USER=$(grep "^DB_USER=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    DB_NAME=$(grep "^DB_NAME=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  fi
  
  DB_USER=${DB_USER:-"streampulse_admin"}
  DB_NAME=${DB_NAME:-"streampulse"}
  
  echo -e "  - Dropping database: ${CYAN}$DB_NAME${NC}"
  if sudo -u postgres dropdb --if-exists "$DB_NAME" 2>/dev/null; then
    echo -e "  - Dropping database user role: ${CYAN}$DB_USER${NC}"
    sudo -u postgres psql -c "DROP USER IF EXISTS ${DB_USER};" 2>/dev/null || true
    echo -e "  [${GREEN}✔${NC}] Database and admin role cleaned up successfully."
  else
    echo -e "  [${YELLOW}⚠️${NC}] Unable to drop database. Ensure database service is active and try dropping manually."
  fi
else
  echo -e "\n${YELLOW}[*] Skipping PostgreSQL DB purging. Database content has been preserved.${NC}"
fi

# 5. Clean logs and built assets
echo -e "\n${BLUE}[*] Deleting logs and temporary system directories...${NC}"
if [ -d "/var/log/streampulse" ]; then
  echo -e "  - Removing logs directory..."
  rm -rf /var/log/streampulse
fi

# Check for cron backup script
if [ -f "/etc/cron.daily/streampulse-backup" ]; then
  echo -e "  - Removing automated daily backup cron task..."
  rm -f /etc/cron.daily/streampulse-backup
fi

# Rebuild frontend dist files cleanup
if [ -d "$SCRIPT_DIR/dist" ]; then
  echo -e "  - Cleaning compiled frontend build assets (dist)..."
  rm -rf "$SCRIPT_DIR/dist"
fi

# Clean production application directory if exists
if [ -d "/opt/streampulse" ]; then
  echo -e "  - Removing production application directory /opt/streampulse..."
  rm -rf /opt/streampulse
fi

# 6. Remove dedicated Linux user streampulse if it exists
echo -e "\n${BLUE}[*] Checking for dedicated streampulse Linux user...${NC}"
if id "streampulse" &>/dev/null; then
  echo -e "  - Removing streampulse Linux user..."
  userdel -r streampulse || userdel streampulse || true
  echo -e "  [${GREEN}✔${NC}] Linux user 'streampulse' successfully removed."
fi

echo -e "\n${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD}   🏁  StreamPulse Uninstallation Complete!                                   ${NC}"
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "StreamPulse services have been successfully decommissioned and cleaned up."
echo -e "You can safely delete the local workspace directory now."
echo -e "==============================================================================\n"
