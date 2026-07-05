#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - High-Performance Production Automated Installer
# Supported OS: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
# Architect: Senior DevOps, Security, Streaming Infrastructure & DB Architect
# ==============================================================================

# Exit immediately if any command fails (will handle traps and healing on error)
set -e

# Get the absolute path of the directory containing this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Setup logging directories and files
LOG_DIR="/var/log/streampulse"
mkdir -p "$LOG_DIR"
INSTALL_LOG="$LOG_DIR/install.log"
ERROR_LOG="$LOG_DIR/error.log"

# Backup existing logs instead of wiping them on upgrades to preserve history
if [ -f "$INSTALL_LOG" ]; then
  mv "$INSTALL_LOG" "$INSTALL_LOG.old" 2>/dev/null || true
fi
if [ -f "$ERROR_LOG" ]; then
  mv "$ERROR_LOG" "$ERROR_LOG.old" 2>/dev/null || true
fi

# Initialize fresh logs
cat /dev/null > "$INSTALL_LOG"
cat /dev/null > "$ERROR_LOG"

# Terminal colors for professional formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0;37m' # No Color
BOLD='\033[1m'

# Redirect stdout to install log and stderr to both error log and console
exec > >(tee -a "$INSTALL_LOG")
exec 2> >(tee -a "$ERROR_LOG" >&2)

# Display beautiful header banner
clear
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "${CYAN}${BOLD}      ⚡ StreamPulse RTMP VPS Manager - Self-Healing Enterprise Installer ⚡     ${NC}"
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "Architect: Senior DevOps, Security, Streaming Infrastructure, & Full Stack Architect"
echo -e "Logging:   $INSTALL_LOG & $ERROR_LOG"
echo -e "Date:      $(date)"
echo -e "OS Targets: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS"
echo -e "${CYAN}==============================================================================${NC}\n"

# Define rollback array to register cleanup tasks on failure
declare -a ROLLBACK_ACTIONS

# Rollback function triggered on failure (with self-healing fallback)
cleanup_on_failure() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo -e "\n${RED}${BOLD}==============================================================================${NC}"
    echo -e "${RED}${BOLD}   ❌  INSTALLATION ENCOUNTERED AN ERROR! ATTEMPTING SELF-HEALING REPAIR...  ${NC}"
    echo -e "${RED}${BOLD}==============================================================================${NC}"
    echo -e "Review detailed error logs at: ${YELLOW}$ERROR_LOG${NC}\n"
    
    # Run self-healing and repair first before performing standard rollback
    auto_repair_infrastructure
    
    if perform_health_check; then
      echo -e "\n${GREEN}[✔] Self-healing routine recovered the system! Overriding installation failure.${NC}"
      trap - EXIT
      print_installation_success
      exit 0
    fi
    
    echo -e "${RED}Self-healing was unable to restore all services. Executing rollback procedures...${NC}"
    for ((i=${#ROLLBACK_ACTIONS[@]}-1; i>=0; i--)); do
      echo -e "${YELLOW}[Rollback] Running: ${ROLLBACK_ACTIONS[i]}${NC}"
      eval "${ROLLBACK_ACTIONS[i]}" || echo -e "${RED}Rollback action failed to execute cleanly.${NC}"
    done
    
    echo -e "\n${RED}Rollback complete. System returned to safe state. Please resolve issues and retry.${NC}"
    exit $exit_code
  fi
}

trap cleanup_on_failure EXIT

# Register a rollback action
register_rollback() {
  ROLLBACK_ACTIONS+=("$1")
}

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
  
  # Supported major versions
  if [[ "$VERSION_ID" != "20.04" && "$VERSION_ID" != "22.04" && "$VERSION_ID" != "24.04" ]]; then
    echo -e "${YELLOW}[!] Warning: Detected Ubuntu version $VERSION_ID is not officially verified.${NC}"
    echo -e "Only versions 20.04, 22.04, and 24.04 are LTS-certified for StreamPulse."
    if [ -t 0 ]; then
      read -t 10 -p "Do you wish to continue anyway? (y/N): " force_os || force_os="y"
    else
      force_os="y"
    fi
    if [[ ! "$force_os" =~ ^[Yy]$ ]]; then
      exit 1
    fi
  else
    echo -e "${GREEN}[✔] Detected compatible OS: $PRETTY_NAME${NC}\n"
  fi
else
  echo -e "${RED}[- ] Error: Cannot read /etc/os-release. Unable to determine OS compatibility.${NC}" >&2
  exit 1
fi

# 3. PRODUCTION DEPLOYMENT PATH SETUP
echo -e "[*] Preparing enterprise-grade production directory..."
DEPLOY_DIR="/opt/streampulse"
if [ "$SCRIPT_DIR" != "$DEPLOY_DIR" ]; then
  echo -e "  - Deploying codebase to $DEPLOY_DIR..."
  mkdir -p "$DEPLOY_DIR"
  cp -r "$SCRIPT_DIR"/. "$DEPLOY_DIR"/
  cd "$DEPLOY_DIR"
  SCRIPT_DIR="$DEPLOY_DIR"
fi
echo -e "${GREEN}[✔] Production directory set to $DEPLOY_DIR.${NC}\n"

# Ensure dedicated system user and group streampulse exists
echo -e "[*] Ensuring streampulse system user and group exist..."
if ! getent group streampulse &>/dev/null; then
  groupadd -r streampulse
fi

if ! id "streampulse" &>/dev/null; then
  echo -e "  - Creating system user 'streampulse'..."
  useradd -r -g streampulse -m -s /usr/sbin/nologin streampulse
  register_rollback "echo 'Removing created user streampulse...'; userdel -r streampulse || userdel streampulse || true"
else
  echo -e "  - System user 'streampulse' already exists."
fi

# Add streampulse to www-data group so they can share HLS segment paths seamlessly
usermod -a -G www-data streampulse || true
echo -e "${GREEN}[✔] System user streampulse verified.${NC}\n"

# CPU Architecture detection
echo -e "[*] Detecting hardware architecture..."
ARCH=$(uname -m)
OS_ARCH="amd64"
if [[ "$ARCH" == "x86_64" ]]; then
  OS_ARCH="amd64"
  echo -e "${GREEN}[✔] Detected Architecture: x86_64 (amd64)${NC}\n"
elif [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
  OS_ARCH="arm64"
  echo -e "${GREEN}[✔] Detected Architecture: ARM64 (arm64)${NC}\n"
else
  echo -e "${YELLOW}[!] Warning: Unsupported or untested architecture: $ARCH. Defaults to amd64 config.${NC}\n"
fi

# Check available system RAM
echo -e "[*] Validating available system memory..."
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ -n "$TOTAL_RAM_MB" ]; then
  echo -e "  - Total RAM: ${TOTAL_RAM_MB} MB"
  if [ "$TOTAL_RAM_MB" -lt 950 ]; then
    echo -e "${YELLOW}[!] Warning: System memory is less than 1GB. FFmpeg transcode operations may face memory constraints.${NC}"
    if [ -t 0 ]; then
      read -t 10 -p "Do you want to continue anyway? (y/N): " confirm_ram || confirm_ram="y"
    else
      confirm_ram="y"
    fi
    if [[ ! "$confirm_ram" =~ ^[Yy]$ ]]; then
      exit 1
    fi
  else
    echo -e "${GREEN}[✔] System memory meets requirements (>= 1GB).${NC}\n"
  fi
else
  echo -e "${YELLOW}[!] Warning: Unable to check available system memory. Continuing...${NC}\n"
fi

# Check available disk space
echo -e "[*] Checking available disk space..."
AVAILABLE_DISK_MB=$(df -m . | awk 'NR==2 {print $4}')
if [ -n "$AVAILABLE_DISK_MB" ]; then
  echo -e "  - Free space in current directory: ${AVAILABLE_DISK_MB} MB"
  if [ "$AVAILABLE_DISK_MB" -lt 1500 ]; then
    echo -e "${RED}[- ] Error: Insufficient disk space. At least 1.5GB of free space is required (Available: ${AVAILABLE_DISK_MB} MB).${NC}" >&2
    exit 1
  else
    echo -e "${GREEN}[✔] Disk space is sufficient.${NC}\n"
  fi
else
  echo -e "${YELLOW}[!] Warning: Unable to check free disk space. Continuing...${NC}\n"
fi

# Existing installation detection (Upgrade vs Fresh Install)
echo -e "[*] Detecting existing StreamPulse installation..."
UPGRADE_MODE=false
if [ -f "$SCRIPT_DIR/.env" ] || systemctl list-units --full -all | grep -Fq "streampulse.service" || [ -d "/var/www/hls" ]; then
  UPGRADE_MODE=true
  echo -e "  - ${GREEN}An existing installation was detected.${NC}"
  echo -e "  - System will run in ${BOLD}UPGRADE / RE-INSTALL MODE${NC}."
  echo -e "  - PostgreSQL user database, HLS/DASH media files, and logs will be PRESERVED."
else
  echo -e "  - No existing installation found. Proceeding with fresh install."
fi
echo ""

# Helper to check if a port is listening
check_port_listening() {
  local port="$1"
  if command -v ss &>/dev/null; then
    ss -tuln | grep -q -E ":$port\s" && return 0
  elif command -v netstat &>/dev/null; then
    netstat -tuln | grep -q -E ":$port\s" && return 0
  else
    local hex_port=$(printf '%04X' "$port" 2>/dev/null || echo "")
    if [ -n "$hex_port" ] && [ -f "/proc/net/tcp" ]; then
      grep -q -i ":$hex_port" /proc/net/tcp 2>/dev/null && return 0
    fi
  fi
  return 1
}

# Port conflict detection
echo -e "[*] Detecting port conflicts..."
PORTS_TO_CHECK=(80 1935 3000)
for port in "${PORTS_TO_CHECK[@]}"; do
  if check_port_listening "$port"; then
    PID_USING_PORT=""
    if command -v lsof &>/dev/null; then
      PID_USING_PORT=$(lsof -t -i:$port 2>/dev/null | head -n 1)
    elif command -v fuser &>/dev/null; then
      PID_USING_PORT=$(fuser $port/tcp 2>/dev/null | awk '{print $1}')
    fi
    
    PROCESS_NAME=""
    if [ -n "$PID_USING_PORT" ]; then
      PROCESS_NAME=$(ps -p "$PID_USING_PORT" -o comm= 2>/dev/null)
    fi
    
    # If the process is Nginx, node, or npm, it's expected during an upgrade/re-install
    if [[ "$PROCESS_NAME" == "nginx" || "$PROCESS_NAME" == "node" || "$PROCESS_NAME" == "npm" ]]; then
      echo -e "  - Port $port is in use by: ${YELLOW}$PROCESS_NAME${NC} (Expected on upgrade/restart)"
    else
      echo -e "${YELLOW}[!] Warning: Port $port is bound by an external process: ${RED}${PROCESS_NAME:-Unknown} (PID: ${PID_USING_PORT:-Unknown})${NC}"
      if [ -t 0 ]; then
        read -t 10 -p "Do you want to continue anyway? (y/N): " confirm_port || confirm_port="y"
      else
        confirm_port="y"
      fi
      if [[ ! "$confirm_port" =~ ^[Yy]$ ]]; then
        exit 1
      fi
    fi
  else
    echo -e "  - Port $port is free."
  fi
done
echo -e "${GREEN}[✔] Port validation completed.${NC}\n"

# 4. FILE INTEGRITY VALIDATION
echo -e "[*] Validating integrity of repository files before configuration..."
REQUIRED_FILES=("$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/package.json" "$SCRIPT_DIR/server.ts" "$SCRIPT_DIR/vps-deployment/schema.sql" "$SCRIPT_DIR/vps-deployment/transcode.sh" "$SCRIPT_DIR/vps-deployment/nginx.conf" "$SCRIPT_DIR/vps-deployment/nginx-rtmp.conf")
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}[- ] Error: Required installer file '$file' is missing!${NC}" >&2
    exit 1
  fi
done
echo -e "${GREEN}[✔] All repository source files verified and present.${NC}\n"

# 5. CONFIGURATION PROMPTING (Non-interactive safe)
echo -e "${YELLOW}--- SSL & Domain Configuration ---${NC}"
echo -e "To configure secure HTTPS, please provide your fully qualified domain name."
echo -e "Leave empty if you only want to bind to the system IP address without SSL."
if [ -t 0 ]; then
  read -t 15 -p "Enter Domain Name (e.g., stream.example.com) [optional, times out in 15s]: " DOMAIN_NAME || DOMAIN_NAME=""
else
  DOMAIN_NAME=""
fi
DOMAIN_NAME=$(echo "$DOMAIN_NAME" | xargs)

CERTBOT_EMAIL=""
if [ -n "$DOMAIN_NAME" ]; then
  if [ -t 0 ]; then
    read -t 15 -p "Enter Email Address for Let's Encrypt renewal warnings: " CERTBOT_EMAIL || CERTBOT_EMAIL="admin@$DOMAIN_NAME"
  else
    CERTBOT_EMAIL="admin@$DOMAIN_NAME"
  fi
  CERTBOT_EMAIL=$(echo "$CERTBOT_EMAIL" | xargs)
fi
echo ""

# Command retry wrapper helper function
retry_command() {
  local max_attempts="$1"
  local delay="$2"
  local description="$3"
  shift 3
  local attempt=1
  while [ $attempt -le $max_attempts ]; do
    echo -e "  - [Attempt $attempt/$max_attempts] $description..."
    if eval "$@"; then
      return 0
    fi
    echo -e "${YELLOW}  - Warning: $description failed. Retrying in $delay seconds...${NC}"
    sleep "$delay"
    attempt=$((attempt+1))
  done
  return 1
}

# 6. UPDATE SYSTEM PACKAGE LIST
echo -e "${BLUE}[1/13] Syncing system package repositories...${NC}"
retry_command 3 5 "apt-get update" apt-get update -y
echo -e "${GREEN}[✔] Package lists updated.${NC}\n"

# Helper for package installation
is_package_installed() {
  dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "ok installed"
}

install_package_with_retry() {
  local pkg="$1"
  if is_package_installed "$pkg"; then
    echo -e "  - ${GREEN}$pkg${NC} is already installed."
    return 0
  fi
  
  retry_command 3 4 "Installing $pkg via apt" apt-get install -y "$pkg"
}

# 7. INSTALL UTILITIES
echo -e "${BLUE}[2/13] Configuring baseline utilities and security components...${NC}"
ESSENTIAL_PACKAGES=(git curl wget build-essential openssl gnupg2 ca-certificates ufw fail2ban logrotate)
for pkg in "${ESSENTIAL_PACKAGES[@]}"; do
  install_package_with_retry "$pkg"
done
echo -e "${GREEN}[✔] Essential packages verified.${NC}\n"

# Verify OpenSSL availability
if ! command -v openssl &>/dev/null; then
  echo -e "${RED}[- ] Error: OpenSSL is missing and could not be installed!${NC}" >&2
  exit 1
fi

# 8. INSTALL NODE.JS & NPM (Node 20 LTS)
echo -e "${BLUE}[3/13] Validating Node.js runtime presence...${NC}"
NODE_READY=false
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -ge 18 ]; then
    NODE_READY=true
    echo -e "  - ${GREEN}Node.js${NC} version meets prerequisites ($(node -v)). Skipping repository setup."
  fi
fi

if [ "$NODE_READY" = false ]; then
  echo -e "  - Setting up NodeSource Node.js 20.x repository..."
  retry_command 3 5 "Setting up NodeSource GPG & repository" \
    "mkdir -p /etc/apt/keyrings && \
     rm -f /etc/apt/keyrings/nodesource.gpg && \
     curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
     echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main' | tee /etc/apt/sources.list.d/nodesource.list && \
     apt-get update -y"
  
  install_package_with_retry "nodejs"
fi

# Verify npm version
if ! command -v npm &>/dev/null; then
  echo -e "  - npm is missing. Installing npm..."
  install_package_with_retry "npm"
else
  echo -e "  - ${GREEN}npm${NC} is verified ($(npm -v))."
fi
echo -e "${GREEN}[✔] Node.js and npm runtime environment validated.${NC}\n"

# 9. INSTALL DOCKER & DOCKER COMPOSE
echo -e "${BLUE}[4/13] Checking Docker Engine state...${NC}"
if ! command -v docker &>/dev/null; then
  echo -e "  - Docker not found. Adding GPG keys and Docker repository..."
  retry_command 3 5 "Adding Docker GPG & repository" \
    "install -m 0755 -d /etc/apt/keyrings && \
     curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes && \
     chmod a+r /etc/apt/keyrings/docker.gpg && \
     echo 'deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \"\$VERSION_CODENAME\") stable' | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
     apt-get update -y"
  
  install_package_with_retry "docker-ce"
  install_package_with_retry "docker-ce-cli"
  install_package_with_retry "containerd.io"
  install_package_with_retry "docker-buildx-plugin"
  install_package_with_retry "docker-compose-plugin"
else
  echo -e "  - ${GREEN}Docker${NC} is already installed ($(docker --version)). Skipping."
fi

# Verify Docker Daemon
systemctl start docker || true
systemctl enable docker || true
if docker info &>/dev/null; then
  echo -e "  - ${GREEN}Docker Daemon${NC} is responsive and running."
else
  echo -e "${YELLOW}[!] Warning: Docker daemon is unresponsive. Containers may fail to run.${NC}"
fi

# Verify Docker Compose Plugin
if docker compose version &>/dev/null; then
  echo -e "  - ${GREEN}Docker Compose plugin${NC} is active: $(docker compose version | head -n 1)"
elif command -v docker-compose &>/dev/null; then
  echo -e "  - ${GREEN}Standalone docker-compose${NC} is active: $(docker-compose --version | head -n 1)"
else
  echo -e "  - Installing Docker Compose plugin..."
  install_package_with_retry "docker-compose-plugin"
fi
echo -e "${GREEN}[✔] Docker environment verified successfully.${NC}\n"

# 10. INSTALL POSTGRESQL
echo -e "${BLUE}[5/13] Configuring host-level PostgreSQL database...${NC}"
install_package_with_retry "postgresql"
install_package_with_retry "postgresql-contrib"

echo -e "  - Activating PostgreSQL database service..."
systemctl start postgresql || true
systemctl enable postgresql || true
echo -e "${GREEN}[✔] PostgreSQL service is fully operational.${NC}\n"

# 11. GENERATE SECURE CREDENTIALS & PRODUCTION ENV
echo -e "${BLUE}[6/13] Creating secure environment variables and credentials...${NC}"

get_or_generate_env_var() {
  local var_name="$1"
  local bytes_len="$2"
  
  if [ -f "$SCRIPT_DIR/.env" ] && grep -q "^${var_name}=" "$SCRIPT_DIR/.env"; then
    local existing_val=$(grep "^${var_name}=" "$SCRIPT_DIR/.env" | cut -d'=' -f2- | xargs)
    if [ -n "$existing_val" ]; then
      echo "$existing_val"
      return
    fi
  fi
  openssl rand -hex "$bytes_len"
}

if [ -f "$SCRIPT_DIR/.env" ]; then
  echo -e "  - Existing .env file found. Preserving current configuration..."
  BACKUP_ENV="$SCRIPT_DIR/.env.bak.$(date +%Y%m%d%H%M%S)"
  cp "$SCRIPT_DIR/.env" "$BACKUP_ENV"
  echo -e "  - Existing configuration backed up to ${CYAN}$BACKUP_ENV${NC}"
  register_rollback "echo 'Restoring original .env configuration...'; cp -f $BACKUP_ENV $SCRIPT_DIR/.env"
  
  DB_RAND_USER=$(get_or_generate_env_var "DB_USER" 0)
  if [ -z "$DB_RAND_USER" ]; then DB_RAND_USER="streampulse_admin"; fi
  
  DB_RAND_PASS=$(get_or_generate_env_var "DB_PASSWORD" 18)
  DB_RAND_NAME=$(get_or_generate_env_var "DB_NAME" 0)
  if [ -z "$DB_RAND_NAME" ]; then DB_RAND_NAME="streampulse"; fi
  
  DB_RAND_HOST=$(get_or_generate_env_var "DB_HOST" 0)
  if [ -z "$DB_RAND_HOST" ]; then DB_RAND_HOST="127.0.0.1"; fi
  
  RAND_JWT_SECRET=$(get_or_generate_env_var "JWT_SECRET" 32)
  RAND_SESSION_SECRET=$(get_or_generate_env_var "SESSION_SECRET" 32)
  
  sed -i "s|^DB_USER=.*|DB_USER=${DB_RAND_USER}|g" "$SCRIPT_DIR/.env" || echo "DB_USER=${DB_RAND_USER}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_RAND_PASS}|g" "$SCRIPT_DIR/.env" || echo "DB_PASSWORD=${DB_RAND_PASS}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^DB_NAME=.*|DB_NAME=${DB_RAND_NAME}|g" "$SCRIPT_DIR/.env" || echo "DB_NAME=${DB_RAND_NAME}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^DB_HOST=.*|DB_HOST=${DB_RAND_HOST}|g" "$SCRIPT_DIR/.env" || echo "DB_HOST=${DB_RAND_HOST}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${RAND_JWT_SECRET}|g" "$SCRIPT_DIR/.env" || echo "JWT_SECRET=${RAND_JWT_SECRET}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=${RAND_SESSION_SECRET}|g" "$SCRIPT_DIR/.env" || echo "SESSION_SECRET=${RAND_SESSION_SECRET}" >> "$SCRIPT_DIR/.env"
else
  echo -e "  - Creating new secure production environment .env file..."
  if [ -f "$SCRIPT_DIR/.env.example" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
  else
    cat << 'EOF' > "$SCRIPT_DIR/.env"
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=streampulse_admin
DB_PASSWORD=
DB_NAME=streampulse
JWT_SECRET=
SESSION_SECRET=
PORT=3000
EOF
  fi
  chmod 600 "$SCRIPT_DIR/.env"
  
  DB_RAND_USER="streampulse_admin"
  DB_RAND_PASS=$(openssl rand -hex 18)
  DB_RAND_NAME="streampulse"
  DB_RAND_HOST="127.0.0.1"
  RAND_JWT_SECRET=$(openssl rand -hex 32)
  RAND_SESSION_SECRET=$(openssl rand -hex 32)
  
  sed -i "s|^DB_USER=.*|DB_USER=${DB_RAND_USER}|g" "$SCRIPT_DIR/.env" || echo "DB_USER=${DB_RAND_USER}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_RAND_PASS}|g" "$SCRIPT_DIR/.env" || echo "DB_PASSWORD=${DB_RAND_PASS}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^DB_NAME=.*|DB_NAME=${DB_RAND_NAME}|g" "$SCRIPT_DIR/.env" || echo "DB_NAME=${DB_RAND_NAME}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^DB_HOST=.*|DB_HOST=${DB_RAND_HOST}|g" "$SCRIPT_DIR/.env" || echo "DB_HOST=${DB_RAND_HOST}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${RAND_JWT_SECRET}|g" "$SCRIPT_DIR/.env" || echo "JWT_SECRET=${RAND_JWT_SECRET}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=${RAND_SESSION_SECRET}|g" "$SCRIPT_DIR/.env" || echo "SESSION_SECRET=${RAND_SESSION_SECRET}" >> "$SCRIPT_DIR/.env"
fi

# Validate .env contents
echo -e "  - Validating required environment variables..."
for var in DB_USER DB_PASSWORD DB_NAME DB_HOST JWT_SECRET SESSION_SECRET; do
  val=$(grep "^${var}=" "$SCRIPT_DIR/.env" | cut -d'=' -f2- | xargs || echo "")
  if [ -z "$val" ]; then
    echo -e "${RED}[- ] Error: Required configuration variable $var is missing or empty in .env!${NC}" >&2
    exit 1
  fi
done
echo -e "${GREEN}[✔] Environmental secrets secured and validated.${NC}\n"

# 12. CONFIGURE DATABASE SCHEMAS & GRANTS
echo -e "${BLUE}[7/13] Configuring database schema and user privilege scopes...${NC}"

# Ensure PostgreSQL service is active
systemctl start postgresql || true

# Setup User Role
USER_CHECK=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_RAND_USER}'" 2>/dev/null || echo "")
if [ "$USER_CHECK" != "1" ]; then
  sudo -u postgres psql -c "CREATE USER ${DB_RAND_USER} WITH PASSWORD '${DB_RAND_PASS}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;"
  echo -e "    - User role '${DB_RAND_USER}' created."
else
  sudo -u postgres psql -c "ALTER USER ${DB_RAND_USER} WITH PASSWORD '${DB_RAND_PASS}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;"
  echo -e "    - User role '${DB_RAND_USER}' password updated and privileges verified."
fi

# Setup Database
DB_CHECK=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_RAND_NAME}'" 2>/dev/null || echo "")
if [ "$DB_CHECK" != "1" ]; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_RAND_NAME} OWNER ${DB_RAND_USER};"
  echo -e "    - Database '${DB_RAND_NAME}' created with owner ${DB_RAND_USER}."
else
  sudo -u postgres psql -c "ALTER DATABASE ${DB_RAND_NAME} OWNER TO ${DB_RAND_USER};"
  echo -e "    - Database '${DB_RAND_NAME}' already exists. Ownership verified."
fi

# Grants
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_RAND_NAME} TO ${DB_RAND_USER};"
sudo -u postgres psql -d "${DB_RAND_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_RAND_USER};"

# Seeding database schemas from vps-deployment/schema.sql
echo -e "  - Importing database schema from vps-deployment/schema.sql..."
if PGPASSWORD="$DB_RAND_PASS" psql -h 127.0.0.1 -U "$DB_RAND_USER" -d "$DB_RAND_NAME" -f "$SCRIPT_DIR/vps-deployment/schema.sql" &>>"$INSTALL_LOG"; then
  echo -e "${GREEN}[✔] Database fully seeded and optimized.${NC}\n"
else
  echo -e "${YELLOW}[!] Warning: Standard schema seeding failed. Attempting user connection verification...${NC}"
fi

# Verify database connection
DB_CONN_SUCCESS=false
for i in {1..5}; do
  if PGPASSWORD="$DB_RAND_PASS" psql -h 127.0.0.1 -U "$DB_RAND_USER" -d "$DB_RAND_NAME" -c "SELECT 1;" &>/dev/null; then
    DB_CONN_SUCCESS=true
    break
  fi
  sleep 1
done

if [ "$DB_CONN_SUCCESS" = "false" ]; then
  echo -e "  - Adjusting PostgreSQL pg_hba.conf to allow local connections..."
  PG_VERSION=$(sudo -u postgres psql -tAc "SHOW server_version;" | cut -d'.' -f1-2 | xargs)
  HBA_CONF="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
  if [ -f "$HBA_CONF" ]; then
    cp "$HBA_CONF" "$HBA_CONF.bak.$(date +%Y%m%d%H%M%S)"
    echo "host    all             all             127.0.0.1/32            md5" >> "$HBA_CONF"
    systemctl restart postgresql
    
    # Re-verify
    if PGPASSWORD="$DB_RAND_PASS" psql -h 127.0.0.1 -U "$DB_RAND_USER" -d "$DB_RAND_NAME" -c "SELECT 1;" &>/dev/null; then
      DB_CONN_SUCCESS=true
    fi
  fi
fi

if [ "$DB_CONN_SUCCESS" = "false" ]; then
  echo -e "${RED}[- ] Error: Unable to authenticate to PostgreSQL database with generated credentials.${NC}" >&2
  exit 1
else
  echo -e "  - ${GREEN}Successfully authenticated to database.${NC}\n"
fi

# 13. RUN DEPENDENCY ENGINE AND BUILD APPLET
echo -e "${BLUE}[8/13] Compiling and bundling full-stack application...${NC}"
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo -e "  - Node modules missing. Running npm production dependencies installation..."
  retry_command 3 5 "npm install" npm install --no-audit --no-fund
else
  echo -e "  - Node modules already present."
fi

if [ ! -f "$SCRIPT_DIR/dist/server.cjs" ]; then
  echo -e "  - Build target 'dist/server.cjs' is missing. Initiating automatic project build..."
  if ! npm run build; then
    echo -e "${RED}[- ] Error: Application build or compilation failed!${NC}" >&2
    exit 1
  fi
else
  echo -e "  - Production build file 'dist/server.cjs' already exists."
fi
echo -e "${GREEN}[✔] StreamPulse application build verified.${NC}\n"

# 14. CONFIGURE NGINX, RTMP, HLS, DASH, AND TRANSCODER
echo -e "${BLUE}[9/13] Constructing real-time video pipeline (Nginx, RTMP, FFmpeg)...${NC}"

install_package_with_retry "nginx"
install_package_with_retry "libnginx-mod-rtmp"
install_package_with_retry "ffmpeg"

# Verify FFmpeg support
if ffmpeg -codecs 2>&1 | grep -q "libx264"; then
  echo -e "  - ${GREEN}FFmpeg has active support for libx264 codec.${NC}"
else
  echo -e "${YELLOW}[!] Warning: FFmpeg does not explicitly verify libx264 codec support.${NC}"
fi

# Configure Transcode Script
echo -e "  - Configuring stream profile transcoder launch script..."
cp -f "$SCRIPT_DIR/vps-deployment/transcode.sh" /usr/local/bin/transcode.sh
chmod +x /usr/local/bin/transcode.sh

# Directory structure setup for HLS & DASH
echo -e "  - Generating live playlist directory tree..."
mkdir -p /var/www/hls
mkdir -p /var/www/hls/dash
chown -R www-data:www-data /var/www/hls
chmod -R 775 /var/www/hls

# Back up main nginx.conf before making modifications
if [ -f "/etc/nginx/nginx.conf" ]; then
  cp /etc/nginx/nginx.conf "/etc/nginx/nginx.conf.bak.$(date +%Y%m%d%H%M%S)"
fi

# Append RTMP block to nginx.conf if not already present
if ! grep -q "rtmp {" /etc/nginx/nginx.conf; then
  echo -e "  - Injecting RTMP configurations into /etc/nginx/nginx.conf..."
  cat << 'EOF' >> /etc/nginx/nginx.conf

# Real-Time Messaging Protocol (RTMP) Configuration
rtmp {
    server {
        listen 1935;
        chunk_size 4096;

        # Standard Multi-Bitrate Ingestion Application
        application live {
            live on;
            record off;
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
EOF
fi

# Configure StreamPulse HTTP Virtual Host in sites-available
if [ -f "/etc/nginx/sites-available/streampulse" ]; then
  cp /etc/nginx/sites-available/streampulse "/etc/nginx/sites-available/streampulse.bak.$(date +%Y%m%d%H%M%S)"
fi

echo -e "  - Creating Virtual Host site file /etc/nginx/sites-available/streampulse..."
cat << 'EOF' > /etc/nginx/sites-available/streampulse
server {
    listen 80;
    listen [::]:80;
    server_name _; # Overridden if SSL domain is supplied

    # StreamPulse Application Dashboard Proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static HLS & DASH Playlist fragments (CORS Enabled)
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
            application/dash+xml mpd;
            video/iso.segment m4s;
        }

        expires -1;
    }
}
EOF

# Enable StreamPulse virtual host and disable Nginx default site
echo -e "  - Enabling virtual host config..."
ln -sf /etc/nginx/sites-available/streampulse /etc/nginx/sites-enabled/streampulse
rm -f /etc/nginx/sites-enabled/default

# Validate Nginx configuration syntax before reload
echo -e "  - Verifying Nginx configuration syntax..."
if nginx -t; then
  systemctl daemon-reload
  systemctl restart nginx
  echo -e "${GREEN}[✔] Nginx server and video RTMP module are now online.${NC}\n"
else
  echo -e "${RED}[- ] Error: Nginx configuration validation failed! Reverting sites configuration...${NC}" >&2
  rm -f /etc/nginx/sites-enabled/streampulse
  if [ -f "/etc/nginx/sites-available/streampulse.bak" ]; then
    cp -f "/etc/nginx/sites-available/streampulse.bak" /etc/nginx/sites-available/streampulse
    ln -sf /etc/nginx/sites-available/streampulse /etc/nginx/sites-enabled/streampulse
    systemctl restart nginx || true
  fi
  exit 1
fi

# 15. FIREWALL (UFW) AUTOMATIC CONFIGURATION
echo -e "${BLUE}[10/13] Hardening Host OS Firewall with UFW...${NC}"
if command -v ufw &>/dev/null; then
  echo -e "  - Resetting UFW to secure standard rules..."
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  
  echo -e "  - Enabling traffic ports for streaming operations..."
  ufw allow ssh/tcp comment 'SSH Port'
  ufw allow 80/tcp comment 'HTTP Dashboard'
  ufw allow 443/tcp comment 'HTTPS Dashboard'
  ufw allow 1935/tcp comment 'RTMP Video Ingest'
  
  echo -e "  - Committing firewall changes..."
  ufw --force enable
  echo -e "${GREEN}[✔] UFW active and locking down unauthorized ports.${NC}\n"
else
  echo -e "${YELLOW}[!] Warning: UFW package not installed. Firewall configuration bypassed.${NC}\n"
fi

# 16. AUTOMATIC SYSTEM DESTRUCTIVE BRUTE-FORCE SECURITY (FAIL2BAN)
echo -e "${BLUE}[11/13] Hardening security protections with Fail2Ban jails...${NC}"
if systemctl is-active --quiet fail2ban || systemctl start fail2ban; then
  echo -e "  - Writing Fail2Ban basic protection jail file..."
  cat << 'EOF' > /etc/fail2ban/jail.local
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh

[nginx-http-auth]
enabled = true
port = http,https
logpath = %(nginx_error_log)s
EOF
  systemctl restart fail2ban
  echo -e "${GREEN}[✔] Fail2Ban shielding sshd and nginx.${NC}\n"
fi

# Log Rotation Configuration for StreamPulse logs
echo -e "[*] Configuring log rotation policy..."
cat << 'EOF' > /etc/logrotate.d/streampulse
/var/log/streampulse/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 streampulse streampulse
}
EOF
echo -e "${GREEN}[✔] Log rotation policy established.${NC}\n"

# Configure Automated Backups Cron Job
echo -e "[*] Scheduling automatic daily backups..."
cat << EOF > /etc/cron.daily/streampulse-backup
#!/bin/bash
BACKUP_DIR="/var/backups/streampulse"
mkdir -p "\$BACKUP_DIR"
DATE=\$(date +%F_%H%M%S)

if [ -f "$SCRIPT_DIR/.env" ]; then
  DB_USER=\$(grep "^DB_USER=" "$SCRIPT_DIR/.env" | cut -d'=' -f2 | xargs | sed -e 's/^"//' -e 's/"\$//' -e "s/^'//" -e "s/'\$//")
  DB_PASSWORD=\$(grep "^DB_PASSWORD=" "$SCRIPT_DIR/.env" | cut -d'=' -f2 | xargs | sed -e 's/^"//' -e 's/"\$//' -e "s/^'//" -e "s/'\$//")
  DB_NAME=\$(grep "^DB_NAME=" "$SCRIPT_DIR/.env" | cut -d'=' -f2 | xargs | sed -e 's/^"//' -e 's/"\$//' -e "s/^'//" -e "s/'\$//")
  
  if [[ -n "\$DB_USER" && -n "\$DB_PASSWORD" && -n "\$DB_NAME" ]]; then
    PGPASSWORD="\$DB_PASSWORD" pg_dump -h 127.0.0.1 -U "\$DB_USER" -d "\$DB_NAME" -F c -b -f "\$BACKUP_DIR/db_\${DB_NAME}_\${DATE}.backup" >/dev/null 2>&1
  fi
fi

# Back up core config files
tar -czf "\$BACKUP_DIR/config_\${DATE}.tar.gz" -C /etc nginx/sites-available/streampulse nginx/nginx.conf fail2ban/jail.local systemd/system/streampulse.service >/dev/null 2>&1

# Prune old backups (>14 days)
find "\$BACKUP_DIR" -type f -mtime +14 -delete
EOF
chmod +x /etc/cron.daily/streampulse-backup
echo -e "${GREEN}[✔] Automated daily backup task scheduled.${NC}\n"

# 17. LET'S ENCRYPT SSL CERTIFICATE AUTOMATION (CERTBOT)
echo -e "${BLUE}[12/13] Inspecting SSL automation requirements...${NC}"
if [ -n "$DOMAIN_NAME" ]; then
  echo -e "  - Domain configured: ${CYAN}$DOMAIN_NAME${NC}"
  install_package_with_retry "certbot"
  install_package_with_retry "python3-certbot-nginx"
  
  echo -e "  - Executing automated production Let's Encrypt SSL certificate issue..."
  if certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos --email "$CERTBOT_EMAIL" --redirect; then
    echo -e "${GREEN}[✔] SSL Cert issued and Nginx reconfigured for HTTPS redirect.${NC}\n"
  else
    echo -e "${RED}[- ] Let's Encrypt was unable to issue an SSL cert for '$DOMAIN_NAME'.${NC}" >&2
    echo -e "${YELLOW}Please verify that your domain's A-record points to the server IP and retry Certbot manually.${NC}\n"
  fi
else
  echo -e "  - No domain name configuration requested. SSL certificate issue bypassed."
  echo -e "  - Dashboard will be served under HTTP.${NC}\n"
fi

# 18. SYSTEMD BACKGROUND DAEMON REGISTRATION
echo -e "${BLUE}[13/13] Registering StreamPulse as a background systemd service daemon...${NC}"

# Configure secure ownership of workspace and log directory before registering the service
echo -e "  - Configuring directory ownership and permissions for streampulse..."
chown -R streampulse:streampulse "$SCRIPT_DIR"
chown -R streampulse:streampulse /var/log/streampulse

NODE_BIN_PATH=$(command -v node || which node || echo "/usr/bin/node")

# Generate the systemd service automatically if missing
if [ ! -f "/etc/systemd/system/streampulse.service" ]; then
  echo -e "  - Generating missing systemd service file..."
  cat << EOF > /etc/systemd/system/streampulse.service
[Unit]
Description=StreamPulse RTMP VPS Manager Service
After=network.target postgresql.service nginx.service

[Service]
Type=simple
User=streampulse
Group=streampulse
WorkingDirectory=$SCRIPT_DIR
ExecStart=$NODE_BIN_PATH dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

# Resource limits and Systemd security options
LimitNOFILE=65535
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
fi

# Load and start StreamPulse app service
systemctl daemon-reload
systemctl enable streampulse
systemctl restart streampulse
echo -e "${GREEN}[✔] Systemd service streampulse configured and started.${NC}\n"

# Helper for robust system checks
perform_health_check() {
  local all_passed=true
  
  echo -e "\n${BOLD}--- Executing StreamPulse Infrastructure Verification ---${NC}"
  
  # 1. PostgreSQL Service and Port
  if systemctl is-active --quiet postgresql 2>/dev/null; then
    echo -e "  [✔] PostgreSQL Service: ${GREEN}Active${NC}"
  else
    echo -e "  [❌] PostgreSQL Service: ${RED}Stopped/Not Installed${NC}"
    all_passed=false
  fi
  if check_port_listening 5432; then
    echo -e "  [✔] PostgreSQL Port 5432: ${GREEN}Listening${NC}"
  else
    echo -e "  [❌] PostgreSQL Port 5432: ${RED}Not Listening${NC}"
    all_passed=false
  fi
  
  # 2. Nginx Service and Ports
  if systemctl is-active --quiet nginx 2>/dev/null; then
    echo -e "  [✔] Nginx Service: ${GREEN}Active${NC}"
  else
    echo -e "  [❌] Nginx Service: ${RED}Stopped/Not Installed${NC}"
    all_passed=false
  fi
  if check_port_listening 80; then
    echo -e "  [✔] HTTP Port 80: ${GREEN}Listening${NC}"
  else
    echo -e "  [❌] HTTP Port 80: ${RED}Not Listening${NC}"
    all_passed=false
  fi
  if check_port_listening 1935; then
    echo -e "  [✔] RTMP Port 1935: ${GREEN}Listening${NC}"
  else
    echo -e "  [❌] RTMP Port 1935: ${RED}Not Listening${NC}"
    all_passed=false
  fi
  
  # 3. StreamPulse Service and Port
  if systemctl is-active --quiet streampulse 2>/dev/null; then
    echo -e "  [✔] StreamPulse Service: ${GREEN}Active${NC}"
  else
    echo -e "  [❌] StreamPulse Service: ${RED}Stopped/Not Installed${NC}"
    all_passed=false
  fi
  if check_port_listening 3000; then
    echo -e "  [✔] StreamPulse Port 3000: ${GREEN}Listening${NC}"
  else
    echo -e "  [❌] StreamPulse Port 3000: ${RED}Not Listening${NC}"
    all_passed=false
  fi
  
  # 4. Docker & Fail2ban Service
  if systemctl is-active --quiet docker 2>/dev/null; then
    echo -e "  [✔] Docker Service: ${GREEN}Active${NC}"
  else
    echo -e "  [❌] Docker Service: ${RED}Stopped/Not Installed${NC}"
    all_passed=false
  fi
  if systemctl is-active --quiet fail2ban 2>/dev/null; then
    echo -e "  [✔] Fail2ban Service: ${GREEN}Active${NC}"
  else
    echo -e "  [❌] Fail2ban Service: ${RED}Stopped/Not Installed${NC}"
    all_passed=false
  fi
  
  if [ "$all_passed" = true ]; then
    return 0
  else
    return 1
  fi
}

# Auto-repair logic to resolve infrastructure anomalies
auto_repair_infrastructure() {
  echo -e "\n${YELLOW}${BOLD}[!] Health Check Failed. Attempting Automated Repair and Healing...${NC}"
  
  # 1. Healing PostgreSQL / Port 5432
  if ! systemctl is-active --quiet postgresql 2>/dev/null || ! check_port_listening 5432; then
    echo -e "  - [Heal] PostgreSQL or Port 5432 is down. Attempting start..."
    systemctl restart postgresql &>>"$INSTALL_LOG" || true
    sleep 3
    if ! check_port_listening 5432; then
      echo -e "  - [Heal] PostgreSQL port still not open. Reconfiguring pg_hba.conf..."
      local pg_version=$(sudo -u postgres psql -tAc "SHOW server_version;" 2>/dev/null | cut -d'.' -f1-2 | xargs || echo "")
      if [ -n "$pg_version" ] && [ -f "/etc/postgresql/${pg_version}/main/pg_hba.conf" ]; then
        if ! grep -q "127.0.0.1/32" "/etc/postgresql/${pg_version}/main/pg_hba.conf"; then
          echo "host    all             all             127.0.0.1/32            md5" >> "/etc/postgresql/${pg_version}/main/pg_hba.conf"
        fi
      fi
      systemctl restart postgresql &>>"$INSTALL_LOG" || true
      sleep 3
    fi
  fi
  
  # 2. Healing Nginx / Ports 80, 1935
  if ! systemctl is-active --quiet nginx 2>/dev/null || ! check_port_listening 80 || ! check_port_listening 1935; then
    echo -e "  - [Heal] Nginx or Ports 80/1935 are down. Checking Nginx configurations..."
    if ! nginx -t &>>"$INSTALL_LOG"; then
      echo -e "  - [Heal] Nginx config error detected! Resetting default sites..."
      rm -f /etc/nginx/sites-enabled/default
      ln -sf /etc/nginx/sites-available/streampulse /etc/nginx/sites-enabled/streampulse
    fi
    systemctl restart nginx &>>"$INSTALL_LOG" || true
    sleep 3
  fi
  
  # 3. Healing StreamPulse / Port 3000
  if ! systemctl is-active --quiet streampulse 2>/dev/null || ! check_port_listening 3000; then
    echo -e "  - [Heal] StreamPulse service or Port 3000 is down. Initiating codebase healing..."
    
    if [ ! -f "$SCRIPT_DIR/dist/server.cjs" ]; then
      echo -e "  - [Heal] Build output 'dist/server.cjs' is missing! Rebuilding applet..."
      npm run build &>>"$INSTALL_LOG" || true
    fi
    
    if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
      echo -e "  - [Heal] 'node_modules' is missing! Running npm install..."
      npm install --no-audit --no-fund &>>"$INSTALL_LOG" || true
    fi
    
    echo -e "  - [Heal] Restarting systemd service 'streampulse'..."
    systemctl daemon-reload &>>"$INSTALL_LOG" || true
    systemctl enable streampulse &>>"$INSTALL_LOG" || true
    systemctl restart streampulse &>>"$INSTALL_LOG" || true
    sleep 5
    
    if ! check_port_listening 3000; then
      echo -e "${YELLOW}  - [Heal] StreamPulse service failed to bind to port 3000. System logs:${NC}"
      journalctl -u streampulse -n 15 --no-pager || true
    fi
  fi
  
  # 4. Healing Docker & Fail2ban
  if ! systemctl is-active --quiet docker 2>/dev/null; then
    echo -e "  - [Heal] Docker is inactive. Restarting Docker..."
    systemctl restart docker &>>"$INSTALL_LOG" || true
  fi
  if ! systemctl is-active --quiet fail2ban 2>/dev/null; then
    echo -e "  - [Heal] Fail2ban is inactive. Restarting Fail2ban..."
    systemctl restart fail2ban &>>"$INSTALL_LOG" || true
  fi
}

print_installation_success() {
  echo -e "${GREEN}${BOLD}==============================================================================${NC}"
  echo -e "${GREEN}${BOLD}   🏁  StreamPulse installed successfully                                    ${NC}"
  echo -e "${GREEN}${BOLD}==============================================================================${NC}"
  echo -e "\nYour video streaming platform is fully online, secured, and ready for production."
  echo -e "You can access the admin dashboard by visiting: ${CYAN}http://${DOMAIN_NAME:-<YOUR_VPS_IP>}${NC}"
  echo -e "RTMP stream ingests can be pushed to:         ${CYAN}rtmp://${DOMAIN_NAME:-<YOUR_VPS_IP>}/live${NC}"
  echo -e "\n${BOLD}Database Credentials:${NC}"
  echo -e "  - Host:      ${CYAN}127.0.0.1${NC}"
  echo -e "  - User:      ${CYAN}${DB_RAND_USER}${NC}"
  echo -e "  - Password:  ${CYAN}[SECURED IN .env]${NC}"
  echo -e "  - Database:  ${CYAN}${DB_RAND_NAME}${NC}"
  echo -e "\n${BOLD}Default Admin Credentials:${NC}"
  echo -e "  - Username:  ${CYAN}admin${NC}"
  echo -e "  - Password:  ${CYAN}admin123${NC}"
  echo -e "\n${YELLOW}To view live application logs, execute: journalctl -u streampulse -f${NC}"
  echo -e "==============================================================================\n"
}

# 19. FINAL HEALTH CHECKS AND DIAGNOSTIC SUITE RUNNER
echo -e "${BLUE}[*] Launching comprehensive platform diagnostic test validation...${NC}"

# Execute diagnostic health checks
if perform_health_check; then
  # Disable trap rollback as everything is healthy
  trap - EXIT
  print_installation_success
else
  # Attempt auto repair
  auto_repair_infrastructure
  
  if perform_health_check; then
    trap - EXIT
    print_installation_success
  else
    echo -e "${RED}[- ] Error: Critical infrastructure components are still unhealthy after self-healing.${NC}" >&2
    exit 1
  fi
fi

# Run check.sh diagnostic check to double verify and generate a report
if [ -f "$SCRIPT_DIR/check.sh" ]; then
  echo -e "${CYAN}Running the audit suite to verify service state consistency...${NC}"
  chmod +x "$SCRIPT_DIR/check.sh"
  "$SCRIPT_DIR"/check.sh || true
fi

exit 0
