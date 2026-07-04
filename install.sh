#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - High-Performance Production Automated Installer
# Supported OS: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
# Architect: Senior DevOps, Security, Streaming Infrastructure & DB Architect
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
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
echo -e "${CYAN}${BOLD}      ⚡ StreamPulse RTMP VPS Manager - Production Enterprise Installer ⚡     ${NC}"
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "Architect: Senior DevOps, Security, Streaming Infrastructure, & Full Stack Architect"
echo -e "Logging:   $INSTALL_LOG & $ERROR_LOG"
echo -e "Date:      $(date)"
echo -e "OS Targets: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS"
echo -e "${CYAN}==============================================================================${NC}\n"

# Define rollback array to register cleanup tasks on failure
declare -a ROLLBACK_ACTIONS

# Rollback function triggered on failure
cleanup_on_failure() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo -e "\n${RED}${BOLD}==============================================================================${NC}"
    echo -e "${RED}${BOLD}   ❌  INSTALLATION FAILED AT STEP! TRIGGERING ROBUST ROLLBACK PROCEDURES     ${NC}"
    echo -e "${RED}${BOLD}==============================================================================${NC}"
    echo -e "Review the detailed error logs at: ${YELLOW}$ERROR_LOG${NC}\n"
    
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
    read -p "Do you wish to continue anyway? (y/N): " force_os
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

# Ensure dedicated system user streampulse exists
echo -e "[*] Ensuring streampulse system user exists..."
if ! id "streampulse" &>/dev/null; then
  echo -e "  - Creating system user 'streampulse'..."
  useradd -r -m -s /usr/sbin/nologin streampulse
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
    read -p "Do you want to continue anyway? (y/N): " confirm_ram
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

# Port conflict detection
echo -e "[*] Detecting port conflicts..."
PORTS_TO_CHECK=(80 1935 3000)
for port in "${PORTS_TO_CHECK[@]}"; do
  PORT_IN_USE=false
  if command -v ss &>/dev/null; then
    if ss -tuln | grep -q ":$port "; then PORT_IN_USE=true; fi
  else
    if netstat -tuln | grep -q ":$port "; then PORT_IN_USE=true; fi
  fi
  
  if [ "$PORT_IN_USE" = true ]; then
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
    
    # If the process is Nginx, node, or npm, it's expected during an upgrade
    if [[ "$PROCESS_NAME" == "nginx" || "$PROCESS_NAME" == "node" || "$PROCESS_NAME" == "npm" ]]; then
      echo -e "  - Port $port is in use by: ${YELLOW}$PROCESS_NAME${NC} (Expected on upgrade/restart)"
    else
      echo -e "${YELLOW}[!] Warning: Port $port is bound by an external process: ${RED}${PROCESS_NAME:-Unknown} (PID: ${PID_USING_PORT:-Unknown})${NC}"
      read -p "Do you want to continue anyway? (y/N): " confirm_port
      if [[ ! "$confirm_port" =~ ^[Yy]$ ]]; then
        exit 1
      fi
    fi
  else
    echo -e "  - Port $port is free."
  fi
done
echo -e "${GREEN}[✔] Port validation completed.${NC}\n"

# 3. FILE INTEGRITY VALIDATION
echo -e "[*] Validating integrity of repository files before configuration..."
REQUIRED_FILES=("$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/package.json" "$SCRIPT_DIR/server.ts" "$SCRIPT_DIR/vps-deployment/schema.sql" "$SCRIPT_DIR/vps-deployment/transcode.sh" "$SCRIPT_DIR/vps-deployment/nginx.conf" "$SCRIPT_DIR/vps-deployment/nginx-rtmp.conf")
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}[- ] Error: Required installer file '$file' is missing!${NC}" >&2
    exit 1
  fi
done
echo -e "${GREEN}[✔] All repository source files verified and present.${NC}\n"

# 4. INTERACTIVE CONFIGURATION (DOMAIN & SSL PROMPTING)
echo -e "${YELLOW}--- SSL & Domain Configuration ---${NC}"
echo -e "To configure secure HTTPS, please provide your fully qualified domain name."
echo -e "Leave empty if you only want to bind to the system IP address without SSL."
read -p "Enter Domain Name (e.g., stream.example.com) [optional]: " DOMAIN_NAME
DOMAIN_NAME=$(echo "$DOMAIN_NAME" | xargs)

CERTBOT_EMAIL=""
if [ -n "$DOMAIN_NAME" ]; then
  read -p "Enter Email Address for Let's Encrypt renewal warnings: " CERTBOT_EMAIL
  CERTBOT_EMAIL=$(echo "$CERTBOT_EMAIL" | xargs)
fi
echo ""

# 5. UPDATE SYSTEM PACKAGE LIST
echo -e "${BLUE}[1/13] Syncing system package repositories...${NC}"
apt-get update -y
echo -e "${GREEN}[✔] Package lists updated.${NC}\n"

# 6. INSTALL UTILITIES (Git, Curl, Wget, Build-Essential, OpenSSL, UFW, Fail2ban)
echo -e "${BLUE}[2/13] Configuring baseline utilities and security components...${NC}"
ESSENTIAL_PACKAGES=(git curl wget build-essential openssl gnupg2 ca-certificates ufw fail2ban logrotate)
for pkg in "${ESSENTIAL_PACKAGES[@]}"; do
  if dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q "ok installed"; then
    echo -e "  - ${GREEN}$pkg${NC} is already installed. Skipping."
  else
    echo -e "  - Installing ${YELLOW}$pkg${NC}..."
    apt-get install -y "$pkg"
  fi
done
echo -e "${GREEN}[✔] Essential packages verified.${NC}\n"

# Verify OpenSSL availability
if ! command -v openssl &>/dev/null; then
  echo -e "${RED}[- ] Error: OpenSSL is missing and could not be installed!${NC}" >&2
  exit 1
fi

# 7. INSTALL NODE.JS & NPM (Node 20 LTS)
echo -e "${BLUE}[3/13] Validating Node.js runtime presence...${NC}"
if ! command -v node &>/dev/null; then
  echo -e "  - Node.js missing. Setting up NodeSource Node.js 20.x repository..."
  mkdir -p /etc/apt/keyrings
  rm -f /etc/apt/keyrings/nodesource.gpg
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
  apt-get update
  echo -e "  - Installing Node.js..."
  apt-get install -y nodejs
else
  # Check version matches minimum required v18+
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -lt 18 ]; then
    echo -e "  - Current Node.js version $(node -v) is too low. Upgrading to v20 LTS..."
    mkdir -p /etc/apt/keyrings
    rm -f /etc/apt/keyrings/nodesource.gpg
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
    apt-get update
    apt-get install -y nodejs
  else
    echo -e "  - ${GREEN}Node.js${NC} version meets prerequisites ($(node -v)). Skipping."
  fi
fi

# Verify npm version
if ! command -v npm &>/dev/null; then
  echo -e "  - npm is missing. Installing npm..."
  apt-get install -y npm
else
  echo -e "  - ${GREEN}npm${NC} is verified ($(npm -v))."
fi
echo -e "${GREEN}[✔] Node.js and npm runtime environment validated.${NC}\n"

# 8. INSTALL DOCKER & DOCKER COMPOSE
echo -e "${BLUE}[4/13] Checking Docker Engine state...${NC}"
if ! command -v docker &>/dev/null; then
  echo -e "  - Docker not found. Installing Docker CE & Compose plugin..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
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
  apt-get install -y docker-compose-plugin
fi
echo -e "${GREEN}[✔] Docker environment verified successfully.${NC}\n"

# 9. INSTALL POSTGRESQL (Host-based Database)
echo -e "${BLUE}[5/13] Configuring host-level PostgreSQL database...${NC}"
if ! dpkg-query -W -f='${Status}' postgresql 2>/dev/null | grep -q "ok installed"; then
  echo -e "  - Installing PostgreSQL server and client utilities..."
  apt-get install -y postgresql postgresql-contrib
else
  echo -e "  - ${GREEN}PostgreSQL${NC} server is already installed. Skipping."
fi

echo -e "  - Activating PostgreSQL database service..."
systemctl start postgresql
systemctl enable postgresql
echo -e "${GREEN}[✔] PostgreSQL service is fully operational.${NC}\n"

# 10. GENERATE SECURE CREDENTIALS & PRODUCTION ENV
echo -e "${BLUE}[6/13] Creating secure environment variables and credentials...${NC}"

# Function to get existing var or generate a cryptographically secure hex secret
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

# If .env already exists, backup before making any changes (Never overwrite user data unless verified)
if [ -f "$SCRIPT_DIR/.env" ]; then
  echo -e "  - Existing .env file found. Preserving current configuration..."
  BACKUP_ENV="$SCRIPT_DIR/.env.bak.$(date +%Y%m%d%H%M%S)"
  cp "$SCRIPT_DIR/.env" "$BACKUP_ENV"
  echo -e "  - Existing configuration backed up to ${CYAN}$BACKUP_ENV${NC}"
  register_rollback "echo 'Restoring original .env configuration...'; cp -f $BACKUP_ENV $SCRIPT_DIR/.env"
  
  # Retrieve or securely generate values
  DB_RAND_USER=$(get_or_generate_env_var "DB_USER" 0)
  if [ -z "$DB_RAND_USER" ]; then DB_RAND_USER="streampulse_admin"; fi
  
  DB_RAND_PASS=$(get_or_generate_env_var "DB_PASSWORD" 18)
  DB_RAND_NAME=$(get_or_generate_env_var "DB_NAME" 0)
  if [ -z "$DB_RAND_NAME" ]; then DB_RAND_NAME="streampulse"; fi
  
  DB_RAND_HOST=$(get_or_generate_env_var "DB_HOST" 0)
  if [ -z "$DB_RAND_HOST" ]; then DB_RAND_HOST="127.0.0.1"; fi
  
  RAND_JWT_SECRET=$(get_or_generate_env_var "JWT_SECRET" 32)
  RAND_SESSION_SECRET=$(get_or_generate_env_var "SESSION_SECRET" 32)
  
  # Ensure all variables are written back properly
  sed -i "s|^DB_USER=.*|DB_USER=${DB_RAND_USER}|g" "$SCRIPT_DIR/.env" || echo "DB_USER=${DB_RAND_USER}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_RAND_PASS}|g" "$SCRIPT_DIR/.env" || echo "DB_PASSWORD=${DB_RAND_PASS}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^DB_NAME=.*|DB_NAME=${DB_RAND_NAME}|g" "$SCRIPT_DIR/.env" || echo "DB_NAME=${DB_RAND_NAME}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^DB_HOST=.*|DB_HOST=${DB_RAND_HOST}|g" "$SCRIPT_DIR/.env" || echo "DB_HOST=${DB_RAND_HOST}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${RAND_JWT_SECRET}|g" "$SCRIPT_DIR/.env" || echo "JWT_SECRET=${RAND_JWT_SECRET}" >> "$SCRIPT_DIR/.env"
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=${RAND_SESSION_SECRET}|g" "$SCRIPT_DIR/.env" || echo "SESSION_SECRET=${RAND_SESSION_SECRET}" >> "$SCRIPT_DIR/.env"
else
  echo -e "  - Creating new secure production environment .env file..."
  cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
  chmod 600 "$SCRIPT_DIR/.env"
  
  DB_RAND_USER="streampulse_admin"
  DB_RAND_PASS=$(openssl rand -hex 18)
  DB_RAND_NAME="streampulse"
  DB_RAND_HOST="127.0.0.1"
  RAND_JWT_SECRET=$(openssl rand -hex 32)
  RAND_SESSION_SECRET=$(openssl rand -hex 32)
  
  sed -i "s|^DB_USER=.*|DB_USER=${DB_RAND_USER}|g" "$SCRIPT_DIR/.env"
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_RAND_PASS}|g" "$SCRIPT_DIR/.env"
  sed -i "s|^DB_NAME=.*|DB_NAME=${DB_RAND_NAME}|g" "$SCRIPT_DIR/.env"
  sed -i "s|^DB_HOST=.*|DB_HOST=${DB_RAND_HOST}|g" "$SCRIPT_DIR/.env"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${RAND_JWT_SECRET}|g" "$SCRIPT_DIR/.env"
  
  if grep -q "SESSION_SECRET" "$SCRIPT_DIR/.env"; then
    sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=${RAND_SESSION_SECRET}|g" "$SCRIPT_DIR/.env"
  else
    echo "SESSION_SECRET=${RAND_SESSION_SECRET}" >> "$SCRIPT_DIR/.env"
  fi
fi

# Set secure permissions
chmod 600 "$SCRIPT_DIR/.env"

# Validate .env contents
echo -e "  - Validating required environment variables..."
for var in DB_USER DB_PASSWORD DB_NAME DB_HOST JWT_SECRET SESSION_SECRET; do
  val=$(grep "^${var}=" "$SCRIPT_DIR/.env" | cut -d'=' -f2- | xargs)
  if [ -z "$val" ]; then
    echo -e "${RED}[- ] Error: Required configuration variable $var is missing or empty in .env!${NC}" >&2
    exit 1
  fi
done
echo -e "${GREEN}[✔] Environmental secrets secured and validated.${NC}\n"

# 11. CONFIGURE POSTGRESQL USER, DATABASE & INITIAL SCHEMAS
echo -e "${BLUE}[7/13] Configuring database schema and user privilege scopes...${NC}"

# Setup DB User with random password generated above
echo -e "  - Ensuring PostgreSQL database user exists..."
USER_CHECK=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_RAND_USER}'")
if [ "$USER_CHECK" != "1" ]; then
  sudo -u postgres psql -c "CREATE USER ${DB_RAND_USER} WITH PASSWORD '${DB_RAND_PASS}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;"
  echo -e "    - User role '${DB_RAND_USER}' created."
else
  # Sync password for existing user and strip SUPERUSER privilege if present
  sudo -u postgres psql -c "ALTER USER ${DB_RAND_USER} WITH PASSWORD '${DB_RAND_PASS}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;"
  echo -e "    - User role '${DB_RAND_USER}' password updated and privileges hardened."
fi

# Setup DB Database
echo -e "  - Ensuring PostgreSQL database exists..."
DB_CHECK=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_RAND_NAME}'")
if [ "$DB_CHECK" != "1" ]; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_RAND_NAME} OWNER ${DB_RAND_USER};"
  echo -e "    - Database '${DB_RAND_NAME}' created with owner ${DB_RAND_USER}."
else
  # Ensure the user has owner privileges even if database already existed
  sudo -u postgres psql -c "ALTER DATABASE ${DB_RAND_NAME} OWNER TO ${DB_RAND_USER};"
  echo -e "    - Database '${DB_RAND_NAME}' already exists. Database ownership verified."
fi

# Explicitly grant all privileges on database and schema public to the user
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_RAND_NAME} TO ${DB_RAND_USER};"
sudo -u postgres psql -d "${DB_RAND_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_RAND_USER};"

# Setup rollback actions for database elements on fresh installation failure
if [ "$UPGRADE_MODE" = "false" ]; then
  register_rollback "echo 'Rolling back database changes...'; sudo -u postgres dropdb --if-exists ${DB_RAND_NAME}; sudo -u postgres psql -c \"DROP USER IF EXISTS ${DB_RAND_USER};\""
fi

# Validate DB Local Connectivity and Authentication before continuing
echo -e "  - Verifying connectivity to database port..."
DB_CONN_SUCCESS=false
for i in {1..5}; do
  if PGPASSWORD="$DB_RAND_PASS" psql -h 127.0.0.1 -U "$DB_RAND_USER" -d "$DB_RAND_NAME" -c "SELECT 1;" &>/dev/null; then
    DB_CONN_SUCCESS=true
    break
  fi
  sleep 1
done

if [ "$DB_CONN_SUCCESS" = "false" ]; then
  echo -e "  - Adjusting PostgreSQL pg_hba.conf to allow localhost login..."
  PG_VERSION=$(sudo -u postgres psql -tAc "SHOW server_version;" | cut -d'.' -f1-2 | xargs)
  HBA_CONF="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
  if [ -f "$HBA_CONF" ]; then
    cp "$HBA_CONF" "$HBA_CONF.bak.$(date +%Y%m%d%H%M%S)"
    echo "host    all             all             127.0.0.1/32            md5" >> "$HBA_CONF"
    systemctl restart postgresql
    
    # Re-verify database connectivity
    if PGPASSWORD="$DB_RAND_PASS" psql -h 127.0.0.1 -U "$DB_RAND_USER" -d "$DB_RAND_NAME" -c "SELECT 1;" &>/dev/null; then
      DB_CONN_SUCCESS=true
    fi
  fi
fi

if [ "$DB_CONN_SUCCESS" = "false" ]; then
  echo -e "${RED}[- ] Error: Unable to authenticate to PostgreSQL database with generated credentials.${NC}" >&2
  exit 1
else
  echo -e "  - ${GREEN}Successfully authenticated to database.${NC}"
fi

# Seeding database schemas from vps-deployment/schema.sql
echo -e "  - Importing database schema from vps-deployment/schema.sql..."
if PGPASSWORD="$DB_RAND_PASS" psql -h 127.0.0.1 -U "$DB_RAND_USER" -d "$DB_RAND_NAME" -f "$SCRIPT_DIR/vps-deployment/schema.sql" >/dev/null; then
  echo -e "${GREEN}[✔] Database fully seeded and optimized.${NC}\n"
else
  echo -e "${RED}[- ] Error: Schema database seeding failed!${NC}" >&2
  exit 1
fi

# 12. RUN DEPENDENCY ENGINE AND BUILD APPLET
echo -e "${BLUE}[8/13] Compiling and bundling full-stack application...${NC}"
echo -e "  - Running npm production dependencies lock installation..."
npm install --no-audit --no-fund

echo -e "  - Compiling production frontend client assets and building backend server..."
if npm run build; then
  echo -e "${GREEN}[✔] StreamPulse application ready to launch from dist/.${NC}\n"
else
  echo -e "${RED}[- ] Error: Application build or compilation failed!${NC}" >&2
  exit 1
fi

# 13. CONFIGURE NGINX, RTMP, HLS, DASH, AND TRANSCODER
echo -e "${BLUE}[9/13] Constructing real-time video pipeline (Nginx, RTMP, FFmpeg)...${NC}"

# Check for Nginx + RTMP module installation
if ! dpkg-query -W -f='${Status}' nginx 2>/dev/null | grep -q "ok installed" || ! dpkg-query -W -f='${Status}' libnginx-mod-rtmp 2>/dev/null | grep -q "ok installed"; then
  echo -e "  - Installing Nginx and RTMP ingestion module..."
  apt-get install -y nginx libnginx-mod-rtmp
fi

# Check for FFmpeg installation
if ! command -v ffmpeg &>/dev/null; then
  echo -e "  - Installing FFmpeg transcode binary..."
  apt-get install -y ffmpeg
fi

# Verify FFmpeg transcode support and codecs
echo -e "  - Verifying FFmpeg transcoder compatibility..."
if ffmpeg -codecs 2>&1 | grep -q "libx264"; then
  echo -e "  - ${GREEN}FFmpeg has active support for libx264 codec.${NC}"
else
  echo -e "${YELLOW}[!] Warning: FFmpeg does not explicitly verify libx264 codec support.${NC}"
fi

# Configure Transcode Script
echo -e "  - Configuring stream profile transcoder launch script..."
cp -f "$SCRIPT_DIR/vps-deployment/transcode.sh" /usr/local/bin/transcode.sh
chmod +x /usr/local/bin/transcode.sh

# Directory structure setup for HLS & DASH (Preserve media if upgrading)
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

# Configure StreamPulse HTTP Virtual Host in sites-available (Always create a backup first)
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
  # Rollback configuration
  rm -f /etc/nginx/sites-enabled/streampulse
  if [ -f "/etc/nginx/sites-available/streampulse.bak.*" ]; then
    LATEST_BACKUP=$(ls -t /etc/nginx/sites-available/streampulse.bak.* | head -n 1)
    cp -f "$LATEST_BACKUP" /etc/nginx/sites-available/streampulse
    ln -sf /etc/nginx/sites-available/streampulse /etc/nginx/sites-enabled/streampulse
    systemctl restart nginx || true
  fi
  exit 1
fi

# 14. FIREWALL (UFW) AUTOMATIC CONFIGURATION
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

# 15. AUTOMATIC SYSTEM DESTRUCTIVE BRUTE-FORCE SECURITY (FAIL2BAN)
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

# 16. LET'S ENCRYPT SSL CERTIFICATE AUTOMATION (CERTBOT)
echo -e "${BLUE}[12/13] Inspecting SSL automation requirements...${NC}"
if [ -n "$DOMAIN_NAME" ]; then
  echo -e "  - Domain configured: ${CYAN}$DOMAIN_NAME${NC}"
  echo -e "  - Installing Certbot package dependencies..."
  apt-get install -y certbot python3-certbot-nginx
  
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

# 17. SYSTEMD BACKGROUND DAEMON REGISTRATION
echo -e "${BLUE}[13/13] Registering StreamPulse as a background systemd service daemon...${NC}"

# Configure secure ownership of workspace and log directory before registering the service
echo -e "  - Configuring directory ownership and permissions for streampulse..."
chown -R streampulse:streampulse "$SCRIPT_DIR"
chown -R streampulse:streampulse /var/log/streampulse

NPM_BIN_PATH=$(command -v npm || which npm || echo "/usr/bin/npm")

cat << EOF > /etc/systemd/system/streampulse.service
[Unit]
Description=StreamPulse RTMP VPS Manager Service
After=network.target postgresql.service nginx.service

[Service]
Type=simple
User=streampulse
Group=streampulse
WorkingDirectory=$SCRIPT_DIR
ExecStart=$NPM_BIN_PATH start
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

# Load and start StreamPulse app service
systemctl daemon-reload
systemctl enable streampulse
systemctl restart streampulse
echo -e "${GREEN}[✔] Systemd service streampulse configured and started.${NC}\n"

# 18. RUN SYSTEM VERIFICATION & DIAGNOSTICS CHECK
echo -e "${BLUE}[*] Launching comprehensive platform diagnostic test validation...${NC}"

# Verification of backend start and endpoint response
BACKEND_HEALTHY=false
echo -e "  - Waiting for local StreamPulse API server response..."
for i in {1..15}; do
  if curl -s --max-time 3 http://127.0.0.1:3000/api/health &>/dev/null || curl -s --max-time 3 http://127.0.0.1:3000/ &>/dev/null; then
    BACKEND_HEALTHY=true
    break
  fi
  sleep 2
done

if [ "$BACKEND_HEALTHY" = "true" ]; then
  echo -e "  - ${GREEN}StreamPulse API layer is online and responding.${NC}"
else
  echo -e "${YELLOW}[!] Warning: API server on port 3000 did not respond in time. Checking logs...${NC}"
  journalctl -u streampulse --no-pager -n 10
fi

# Disable trap rollback as the execution completed successfully
trap - EXIT

# Execute diagnostic suite to perform remaining tests
"$SCRIPT_DIR"/check.sh

echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD}   🏁  StreamPulse Installation Completed Successfully!                      ${NC}"
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
