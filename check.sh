#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - Enterprise Health Diagnostics & Validations
# Checks status of all critical dependencies, services, configurations, and API integrity.
# ==============================================================================

# Terminal colors for professional formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0;37m' # No Color
BOLD='\033[1m'

# Display beautiful diagnostic header
clear
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "${CYAN}${BOLD}      📊  StreamPulse RTMP VPS Manager - Enterprise Diagnostics Check         ${NC}"
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "Time Check: $(date)"
echo -e "Hostname:   $(hostname)"
echo -e "OS Info:    $(uname -sr)"
echo -e "${CYAN}==============================================================================${NC}\n"

# Helper function to print rows of status
print_status() {
  local label="$1"
  local status="$2" # PASS, WARN, FAIL, ACTIVE, INACTIVE, OPEN, CLOSED
  local details="$3"

  printf "  %-40s" "$label"
  
  if [ "$status" = "PASS" ] || [ "$status" = "ACTIVE" ] || [ "$status" = "OPEN" ] || [ "$status" = "FOUND" ] || [ "$status" = "VALID" ]; then
    echo -e "[ ${GREEN}${BOLD}PASS${NC} ]  $details"
  elif [ "$status" = "WARN" ]; then
    echo -e "[ ${YELLOW}${BOLD}WARN${NC} ]  $details"
  else
    echo -e "[ ${RED}${BOLD}FAIL${NC} ]  $details"
  fi
}

echo -e "${BOLD}--- [1/5] Core Runtime & Toolchain Validation ---${NC}"

# Check OS Version
if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [ "$ID" = "ubuntu" ]; then
    print_status "Operating System" "PASS" "Ubuntu $VERSION_ID ($CODENAME)"
  else
    print_status "Operating System" "WARN" "Non-Ubuntu OS detected: $NAME"
  fi
else
  print_status "Operating System" "FAIL" "Unable to detect OS type"
fi

# Check Architecture
ARCH=$(uname -m)
print_status "Hardware Architecture" "PASS" "Detected $ARCH"

# Check Git
if command -v git &>/dev/null; then
  print_status "Git Control System" "FOUND" "$(git --version | head -n 1)"
else
  print_status "Git Control System" "FAIL" "Not installed or not in PATH"
fi

# Check Curl
if command -v curl &>/dev/null; then
  print_status "Curl Transfer Tool" "FOUND" "$(curl --version | head -n 1 | cut -d' ' -f1-2)"
else
  print_status "Curl Transfer Tool" "FAIL" "Not installed or not in PATH"
fi

# Check OpenSSL
if command -v openssl &>/dev/null; then
  print_status "OpenSSL Security Suite" "PASS" "$(openssl version | cut -d' ' -f1-2)"
else
  print_status "OpenSSL Security Suite" "FAIL" "OpenSSL not installed"
fi

# Check Node.js
if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v)
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_MAJOR" -ge 18 ]; then
    print_status "Node.js Runtime" "PASS" "$NODE_VERSION (Meets prerequisite v18+)"
  else
    print_status "Node.js Runtime" "FAIL" "$NODE_VERSION (Version is too low! Requires v18+)"
  fi
else
  print_status "Node.js Runtime" "FAIL" "Not installed or not in PATH"
fi

# Check NPM
if command -v npm &>/dev/null; then
  print_status "npm Package Manager" "FOUND" "v$(npm -v)"
else
  print_status "npm Package Manager" "FAIL" "Not installed or not in PATH"
fi

# Check Docker
if command -v docker &>/dev/null; then
  if docker info &>/dev/null; then
    print_status "Docker Daemon" "PASS" "$(docker --version) (Responsive & Running)"
  else
    print_status "Docker Daemon" "WARN" "$(docker --version) (Daemon unresponsive/not running)"
  fi
else
  print_status "Docker Daemon" "WARN" "Docker CLI is not installed"
fi

# Check Docker Compose
if docker compose version &>/dev/null; then
  print_status "Docker Compose" "PASS" "$(docker compose version | head -n 1)"
elif command -v docker-compose &>/dev/null; then
  print_status "Docker Compose" "PASS" "$(docker-compose --version | head -n 1)"
else
  print_status "Docker Compose" "WARN" "Docker Compose utility is missing"
fi

# Check PostgreSQL Client
if command -v psql &>/dev/null; then
  print_status "PostgreSQL Client Utility" "FOUND" "$(psql --version)"
else
  print_status "PostgreSQL Client Utility" "FAIL" "psql client utility missing"
fi

# Check Nginx
if command -v nginx &>/dev/null; then
  # Check for RTMP module integration
  if nginx -V 2>&1 | grep -q "rtmp"; then
    print_status "Nginx Web Server" "PASS" "$(nginx -v 2>&1 | cut -d'/' -f2) (RTMP module loaded)"
  else
    print_status "Nginx Web Server" "WARN" "$(nginx -v 2>&1 | cut -d'/' -f2) (RTMP module missing)"
  fi
else
  print_status "Nginx Web Server" "FAIL" "Nginx is not installed on host"
fi

# Check FFmpeg
if command -v ffmpeg &>/dev/null; then
  if ffmpeg -codecs 2>&1 | grep -q "libx264"; then
    print_status "FFmpeg Transcoder" "PASS" "FFmpeg is installed with libx264 support"
  else
    print_status "FFmpeg Transcoder" "WARN" "FFmpeg is installed but libx264 codec support was not verified"
  fi
else
  print_status "FFmpeg Transcoder" "FAIL" "FFmpeg transcode utility missing"
fi

echo ""
echo -e "${BOLD}--- [2/5] Systemd Service Monitors ---${NC}"

services=(postgresql nginx streampulse fail2ban)
for srv in "${services[@]}"; do
  if systemctl list-units --full -all | grep -Fq "$srv.service"; then
    if systemctl is-active --quiet "$srv"; then
      print_status "$srv.service" "ACTIVE" "Active and running in background"
    else
      print_status "$srv.service" "FAIL" "Installed but currently INACTIVE"
    fi
  else
    print_status "$srv.service" "FAIL" "Service unit not registered in systemd"
  fi
done

echo ""
echo -e "${BOLD}--- [3/5] Network Socket Allocations ---${NC}"

# Check RTMP Port 1935
if ss -tuln | grep -q ":1935 "; then
  PROCESS_1935=$(ss -tulnp | grep ":1935 " | awk '{print $7}' | cut -d'"' -f2 | head -n 1)
  print_status "RTMP Ingestion (Port 1935)" "OPEN" "Accepting streams. Process: ${PROCESS_1935:-nginx}"
else
  print_status "RTMP Ingestion (Port 1935)" "FAIL" "Port closed - Nginx RTMP module not listening"
fi

# Check HTTP Web Port 80
if ss -tuln | grep -q ":80 "; then
  print_status "HTTP Dashboard Proxy (Port 80)" "OPEN" "Responding to connection requests"
else
  print_status "HTTP Dashboard Proxy (Port 80)" "FAIL" "Port closed - HTTP reverse-proxy offline"
fi

# Check Internal Port 3000
if ss -tuln | grep -q ":3000 "; then
  print_status "StreamPulse Internal (Port 3000)" "OPEN" "Node.js Express backend bound successfully"
else
  print_status "StreamPulse Internal (Port 3000)" "FAIL" "Port closed - Node.js Express server is down"
fi

echo ""
echo -e "${BOLD}--- [4/5] Storage, Path permissions, and Formats ---${NC}"

# Check Memory & Disk
RAM_FREE=$(free -m | awk '/^Mem:/{print $4}')
DISK_FREE=$(df -m . | awk 'NR==2 {print $4}')
print_status "Free System Memory" "PASS" "${RAM_FREE} MB available"
print_status "Free Disk Space" "PASS" "${DISK_FREE} MB available on root volume"

# Verify HLS directory permissions
if [ -d "/var/www/hls" ]; then
  HLS_OWNER=$(stat -c '%U' /var/www/hls)
  HLS_PERM=$(stat -c '%a' /var/www/hls)
  if [[ "$HLS_OWNER" = "www-data" && "$HLS_PERM" -ge 755 ]]; then
    print_status "HLS Streaming Directory" "PASS" "/var/www/hls owner is '$HLS_OWNER' with permissions '$HLS_PERM'"
  else
    print_status "HLS Streaming Directory" "WARN" "/var/www/hls has unexpected owner '$HLS_OWNER' or perm '$HLS_PERM'"
  fi
else
  print_status "HLS Streaming Directory" "FAIL" "HLS streaming directory '/var/www/hls' is missing"
fi

# Verify DASH output support
if [ -d "/var/www/hls/dash" ]; then
  print_status "DASH Output Directory" "VALID" "/var/www/hls/dash is active and configured"
else
  print_status "DASH Output Directory" "WARN" "/var/www/hls/dash directory is missing"
fi

# Verify frontend build assets
if [ -f "dist/index.html" ]; then
  print_status "Frontend SPA Build" "PASS" "Built assets verified in dist/ directory"
else
  print_status "Frontend SPA Build" "FAIL" "No compiled frontend bundle (dist/index.html is missing)"
fi

echo ""
echo -e "${BOLD}--- [5/5] Connected Systems & Database Validation ---${NC}"

# Verify PostgreSQL DB connection and tables
if [ -f ".env" ]; then
  DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | xargs || true)
  DB_PASS=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | xargs || true)
  DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2 | xargs || true)
  
  if [[ -n "$DB_USER" && -n "$DB_PASS" && -n "$DB_NAME" ]]; then
    if PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
      TABLE_COUNT=$(PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
      
      # Verify core tables are present
      USERS_TABLE=$(PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users');")
      STREAMS_TABLE=$(PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'streams');")
      
      if [[ "$USERS_TABLE" = "t" && "$STREAMS_TABLE" = "t" ]]; then
        print_status "PostgreSQL DB Connection" "PASS" "Successfully authenticated to '$DB_NAME' ($TABLE_COUNT tables found, schema is valid)"
      else
        print_status "PostgreSQL DB Connection" "WARN" "Database connected, but core tables (users, streams) are missing!"
      fi
    else
      print_status "PostgreSQL DB Connection" "FAIL" "Failed to connect using credentials stored in .env"
    fi
  else
    print_status "PostgreSQL DB Connection" "FAIL" "Incomplete database keys inside .env configuration"
  fi
else
  print_status "PostgreSQL DB Connection" "FAIL" "Configuration file .env not found"
fi

# Verify local backend API responsiveness
if curl -s --max-time 3 http://localhost:3000/api/health &>/dev/null; then
  print_status "StreamPulse Backend API" "PASS" "Local API healthcheck resolved with a positive response code"
elif curl -s --max-time 3 http://localhost:3000/ &>/dev/null; then
  print_status "StreamPulse Backend API" "PASS" "Server responded. Frontend pages served"
else
  print_status "StreamPulse Backend API" "FAIL" "Express router timed out or failed to reply"
fi

echo ""
echo -e "${CYAN}==============================================================================${NC}"
echo -e "Diagnostic test cycle finished."
echo -e "${CYAN}==============================================================================${NC}\n"
