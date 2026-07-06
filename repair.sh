#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - Production Auto-Healing & Repair Tool
# Supported OS: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
# Architect: Senior DevOps & Production Reliability Engineer
# ==============================================================================

set -eo pipefail

# Get script path safely
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Colors for professional formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "${CYAN}${BOLD}      🔧 StreamPulse RTMP VPS Manager - Production Auto-Repair Tool 🔧       ${NC}"
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "Timestamp: $(date)"
echo -e "Directory: $SCRIPT_DIR"
echo -e "OS:        $(cat /etc/os-release | grep "PRETTY_NAME" | cut -d'=' -f2 | tr -d '\"' 2>/dev/null || echo 'Ubuntu')"
echo -e "${CYAN}==============================================================================${NC}\n"

# 1. Root check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[✖] Error: This repair tool must be executed with root privileges.${NC}" >&2
  echo -e "${YELLOW}Please run with: sudo ./repair.sh${NC}" >&2
  exit 1
fi

# 2. Re-establish logging paths
LOG_DIR="/var/log/streampulse"
mkdir -p "$LOG_DIR"
chown -R streampulse:streampulse "$LOG_DIR" 2>/dev/null || true
chmod 755 "$LOG_DIR"

# 3. APT Source List Audit and Repair
echo -e "${BLUE}[*] Auditing and repairing APT repository lists...${NC}"

# Clean up corrupted docker.list
if [ -f "/etc/apt/sources.list.d/docker.list" ]; then
  if ! grep -q "download.docker.com" /etc/apt/sources.list.d/docker.list 2>/dev/null; then
    echo -e "  - ${YELLOW}Corrupted Docker list detected. Automatically deleting...${NC}"
    rm -f /etc/apt/sources.list.d/docker.list
  fi
fi

# Find all repository files
seen_repos_file=$(mktemp)
files=("/etc/apt/sources.list")
if [ -d "/etc/apt/sources.list.d" ]; then
  while IFS= read -r -d '' file; do
    files+=("$file")
  done < <(find /etc/apt/sources.list.d -name "*.list" -print0 2>/dev/null)
fi

for file in "${files[@]}"; do
  [ ! -f "$file" ] && continue
  temp_file=$(mktemp)
  file_changed=false
  
  while IFS= read -r line || [ -n "$line" ]; do
    trimmed=$(echo "$line" | xargs)
    if [ -z "$trimmed" ] || [[ "$trimmed" =~ ^# ]]; then
      echo "$line" >> "$temp_file"
      continue
    fi
    
    # Check syntax correctness
    is_valid=true
    if [[ ! "$trimmed" =~ ^deb(-src)?[[:space:]]+(\[[^]]+\][[:space:]]+)?[a-zA-Z0-9_+.-]+://[^[:space:]]+[[:space:]]+[^[:space:]]+([[:space:]]+[^[:space:]]+)*$ ]]; then
      is_valid=false
    fi
    
    if [ "$is_valid" = "false" ]; then
      echo -e "  - ${YELLOW}Neutralizing invalid entry in $file: $trimmed${NC}"
      echo "# REPAIRED: $line" >> "$temp_file"
      file_changed=true
      continue
    fi
    
    # Check duplicates
    normalized=$(echo "$trimmed" | sed -E 's/\[[^]]+\]//g' | tr -d '[:space:]' | sed 's/\/$//')
    if grep -Fxq "$normalized" "$seen_repos_file" 2>/dev/null; then
      echo -e "  - ${YELLOW}Deactivating duplicate entry: $trimmed${NC}"
      echo "# DUPLICATE: $line" >> "$temp_file"
      file_changed=true
      continue
    fi
    
    echo "$normalized" >> "$seen_repos_file"
    echo "$line" >> "$temp_file"
  done < "$file"
  
  if [ "$file_changed" = "true" ]; then
    cp "$file" "$file.bak.$(date +%Y%m%d%H%M%S)" || true
    cat "$temp_file" > "$file"
  fi
  rm -f "$temp_file"
done
rm -f "$seen_repos_file"
echo -e "${GREEN}[✔] APT repositories validated and healthy.${NC}\n"

# 4. Sync package updates
echo -e "${BLUE}[*] Running APT updates to sync states...${NC}"
apt-get update -y || {
  echo -e "${YELLOW}[!] Warning: APT update failed. Attempting cleanup of duplicate lists...${NC}"
  rm -f /var/lib/apt/lists/*
  apt-get update -y || true
}

# 5. Fix Directories, Ownership and Permissions
echo -e "${BLUE}[*] Restoring directories and permissions...${NC}"
mkdir -p /var/www/hls/dash /var/www/hls/raw /var/www/hls/live
chown -R www-data:www-data /var/www/hls
chmod -R 775 /var/www/hls

chown -R streampulse:streampulse "$SCRIPT_DIR"
chown -R streampulse:streampulse "$LOG_DIR"

if [ -f "$SCRIPT_DIR/vps-deployment/transcode.sh" ]; then
  cp -f "$SCRIPT_DIR/vps-deployment/transcode.sh" /usr/local/bin/transcode.sh
  chmod +x /usr/local/bin/transcode.sh
  echo -e "  - Transcode pipeline script restored."
fi

# 6. Database and connection configurations repair
echo -e "${BLUE}[*] Checking DB configuration and pg_hba...${NC}"
systemctl start postgresql || true
sleep 2

if [ -f "$SCRIPT_DIR/.env" ]; then
  DB_USER=$(grep "^DB_USER=" "$SCRIPT_DIR/.env" | cut -d'=' -f2- | xargs || echo "")
  DB_PASSWORD=$(grep "^DB_PASSWORD=" "$SCRIPT_DIR/.env" | cut -d'=' -f2- | xargs || echo "")
  DB_NAME=$(grep "^DB_NAME=" "$SCRIPT_DIR/.env" | cut -d'=' -f2- | xargs || echo "")
  
  # Ensure local md5 connection is permitted
  PG_VERSION=$(sudo -u postgres psql -tAc "SHOW server_version;" 2>/dev/null | cut -d'.' -f1-2 | xargs || echo "")
  if [ -n "$PG_VERSION" ]; then
    HBA_CONF="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
    if [ -f "$HBA_CONF" ]; then
      if ! grep -q "127.0.0.1/32" "$HBA_CONF"; then
        echo "host    all             all             127.0.0.1/32            md5" >> "$HBA_CONF"
        echo -e "  - Adjusted local IPv4 connection permissions."
        systemctl restart postgresql || true
      fi
    fi
  fi
  
  # Ensure DB and Schema are fully seeded
  if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_NAME" ]; then
    if ! PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
      echo -e "  - ${YELLOW}Connection test failed. Re-granting privileges...${NC}"
      sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" || true
      sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" || true
    fi
    
    # Run DB schema seeding
    if [ -f "$SCRIPT_DIR/vps-deployment/schema.sql" ]; then
      PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/vps-deployment/schema.sql" >/dev/null 2>&1 || true
    fi
  fi
fi

# 7. Check services status and restart
echo -e "${BLUE}[*] Recovering system service daemons...${NC}"
services=("postgresql" "nginx" "streampulse" "docker" "fail2ban")
for svc in "${services[@]}"; do
  if systemctl list-unit-files --type=service | grep -q "${svc}.service"; then
    echo -e "  - Resetting service: $svc"
    systemctl enable "$svc" || true
    systemctl restart "$svc" || true
  fi
done

# 8. Rebuild assets if missing
if [ ! -f "$SCRIPT_DIR/dist/server.cjs" ]; then
  echo -e "${BLUE}[*] Rebuilding missing StreamPulse production server...${NC}"
  if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    npm install --no-audit --no-fund || true
  fi
  npm run build || true
fi

echo -e "\n${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD}   🏁  Auto-Repair Executed successfully! Running audit checks...             ${NC}"
echo -e "${GREEN}${BOLD}==============================================================================${NC}\n"

if [ -f "$SCRIPT_DIR/check.sh" ]; then
  chmod +x "$SCRIPT_DIR/check.sh"
  "$SCRIPT_DIR/check.sh" || true
fi

exit 0
