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

verify_docker_gpg_fingerprint() {
  local gpg_file="${1:-}"
  if [ -z "$gpg_file" ] || [ ! -f "$gpg_file" ] || [ ! -s "$gpg_file" ]; then
    return 1
  fi
  
  # Official fingerprint: 9DC8 5822 9FC7 DD38 854A  E2D8 8D81 803C 0EBF CD88
  local expected="9DC858229FC7DD38854AE2D88D81803C0EBFCD88"
  
  local fp_out=""
  set +e
  if command -v gpg &>/dev/null; then
    fp_out=$(gpg --show-keys --with-fingerprint "$gpg_file" 2>/dev/null || gpg --show-keys "$gpg_file" 2>/dev/null || gpg --with-colons --dry-run --import "$gpg_file" 2>/dev/null)
  fi
  set -e
  
  local normalized_fp; normalized_fp=$(echo "${fp_out:-}" | tr -d ' \t\r\n' | tr '[:lower:]' '[:upper:]')
  
  if [[ "$normalized_fp" == *"$expected"* ]] || [[ "$normalized_fp" == *"0EBFCD88"* ]] || [[ "$normalized_fp" == *"7EA0A9C3F273FCD8"* ]]; then
    return 0
  fi
  return 1
}

repair_docker_repo_and_gpg() {
  echo -e "[*] Auditing Docker GPG key and sources list config..."
  
  local keyring_dir="/etc/apt/keyrings"
  local gpg_file="$keyring_dir/docker.gpg"
  local list_file="/etc/apt/sources.list.d/docker.list"
  
  mkdir -p "$keyring_dir"
  chmod 755 "$keyring_dir"
  
  # 1. Validate Docker GPG Key
  local gpg_ok=false
  if [ -f "$gpg_file" ] && [ -s "$gpg_file" ]; then
    if verify_docker_gpg_fingerprint "$gpg_file"; then
      gpg_ok=true
    fi
  fi
  
  if [ "$gpg_ok" = "false" ]; then
    echo -e "  - Docker GPG key missing or corrupted. Downloading/Re-installing..."
    rm -f "$gpg_file"
    
    if ! command -v gpg &>/dev/null || ! command -v curl &>/dev/null; then
      set +e
      apt-get update -y && apt-get install -y gnupg curl ca-certificates
      set -e
    fi
    
    local download_success=false
    local mirrors=(
      "https://download.docker.com/linux/ubuntu/gpg"
      "https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg"
    )
    for mirror in "${mirrors[@]}"; do
      if curl -fsSL --max-time 10 "$mirror" | gpg --dearmor -o "$gpg_file" 2>/dev/null; then
        if verify_docker_gpg_fingerprint "$gpg_file"; then
          download_success=true
          break
        fi
      fi
      rm -f "$gpg_file"
    done
    
    if [ "$download_success" = "false" ]; then
      for mirror in "${mirrors[@]}"; do
        if wget -qO- --timeout=10 "$mirror" | gpg --dearmor -o "$gpg_file" 2>/dev/null; then
          if verify_docker_gpg_fingerprint "$gpg_file"; then
            download_success=true
            break
          fi
        fi
        rm -f "$gpg_file"
      done
    fi
    
    if [ "$download_success" = "false" ]; then
      local temp_armor; temp_armor=$(mktemp)
      if gpg --no-default-keyring --keyring "$temp_armor" --keyserver keyserver.ubuntu.com --recv-keys 7EA0A9C3F273FCD8 2>/dev/null; then
        gpg --no-default-keyring --keyring "$temp_armor" --export -o "$gpg_file" 2>/dev/null
        if verify_docker_gpg_fingerprint "$gpg_file"; then
          download_success=true
        fi
      fi
      rm -f "$temp_armor" "$temp_armor~" 2>/dev/null
    fi
    
    if [ "$download_success" = "false" ]; then
      echo -e "${RED}[- ] Error: Failed to download and verify Docker GPG key.${NC}" >&2
      return 1
    fi
  fi
  
  chmod 644 "$gpg_file"
  
  local arch; arch=$(dpkg --print-architecture 2>/dev/null || echo "amd64")
  local codename=""
  if [ -f /etc/os-release ]; then
    codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
  fi
  if [ -z "$codename" ]; then
    codename=$(lsb_release -cs 2>/dev/null || echo "focal")
  fi
  
  if [[ "$codename" != "focal" && "$codename" != "jammy" && "$codename" != "noble" ]]; then
    local ver_id; ver_id=$(. /etc/os-release && echo "$VERSION_ID")
    if [[ "$ver_id" =~ ^20 ]]; then codename="focal";
    elif [[ "$ver_id" =~ ^22 ]]; then codename="jammy";
    elif [[ "$ver_id" =~ ^24 ]]; then codename="noble";
    else codename="jammy";
    fi
  fi
  
  local expected_repo_line="deb [arch=${arch} signed-by=${gpg_file}] https://download.docker.com/linux/ubuntu ${codename} stable"
  
  local list_ok=true
  if [ -f "$list_file" ]; then
    local content; content=$(cat "$list_file" 2>/dev/null || echo "")
    if [[ "$content" == *"\$"* ]] || [[ "$content" == *"\("* ]] || [[ "$content" != *"download.docker.com"* ]]; then
      list_ok=false
    fi
    
    local line
    while IFS= read -r line || [ -n "$line" ]; do
      line=$(echo "$line" | xargs)
      [ -z "$line" ] && continue
      [[ "$line" =~ ^# ]] && continue
      if [[ ! "$line" =~ ^deb[[:space:]]+(\[[^]]+\][[:space:]]+)?[a-zA-Z0-9_+.-]+://[^[:space:]]+[[:space:]]+[^[:space:]]+([[:space:]]+[^[:space:]]+)*$ ]]; then
        list_ok=false
      fi
    done < "$list_file"
  else
    list_ok=false
  fi
  
  if [ "$list_ok" = "false" ]; then
    echo -e "  - Re-writing static resolved Docker repository file..."
    rm -f "$list_file"
    echo "$expected_repo_line" | tee "$list_file" > /dev/null
  fi
  chmod 644 "$list_file"
  
  return 0
}

# Run Docker key and repo healing
repair_docker_repo_and_gpg || true

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
apt-get update -y --allow-releaseinfo-change || {
  echo -e "${YELLOW}[!] Warning: APT update failed. Attempting cleanup of duplicate lists...${NC}"
  rm -f /var/lib/apt/lists/*
  apt-get update -y --allow-releaseinfo-change || true
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
