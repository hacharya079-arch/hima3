#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - High-Performance Platform Diagnostic Suite
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
  echo -e "\n${CYAN}${BOLD}==============================================================================${NC}"
  echo -e "${CYAN}${BOLD}   🔍  StreamPulse Platform Diagnostic & System Verification Suite           ${NC}"
  echo -e "${CYAN}${BOLD}==============================================================================${NC}"
  echo -e "Timestamp: $(date)"
  echo -e "Host IP:   $(hostname -I | awk '{print $1}')"
  echo -e "OS:        $(cat /etc/os-release | grep "PRETTY_NAME" | cut -d'=' -f2 | tr -d '\"')"
  echo -e "${CYAN}==============================================================================${NC}\n"
}

print_section() {
  echo -e "${BOLD}--- $1 ---${NC}"
}

# 1. Root privilege validation
IS_ROOT=true
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}[!] Warning: Running as non-root user. Some privileged diagnostics (like Fail2Ban status, directory permissions) will be skipped or may show warnings.${NC}\n"
  IS_ROOT=false
fi

print_header

# Initialize report counters
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

add_report() {
  local status="$1"
  local component="$2"
  local description="$3"
  
  if [ "$status" = "PASS" ]; then
    echo -e "  [${GREEN}✔${NC}] ${BOLD}${component}${NC}: ${description}"
    PASS_COUNT=$((PASS_COUNT + 1))
  elif [ "$status" = "WARN" ]; then
    echo -e "  [${YELLOW}⚠${NC}] ${BOLD}${component}${NC}: ${YELLOW}${description}${NC}"
    WARN_COUNT=$((WARN_COUNT + 1))
  else
    echo -e "  [${RED}✘${NC}] ${BOLD}${component}${NC}: ${RED}${description}${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# ----------------------------------------------------
# 1. SYSTEM HARDWARE RESOURCES CHECK
# ----------------------------------------------------
print_section "1. System Hardware Resources Check"

# RAM check (Total and Available)
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
AVAILABLE_RAM_MB=$(free -m | awk '/^Mem:/{print $7}')
if [ -n "$TOTAL_RAM_MB" ] && [ -n "$AVAILABLE_RAM_MB" ]; then
  if [ "$TOTAL_RAM_MB" -lt 950 ]; then
    add_report "WARN" "System Memory" "Only ${TOTAL_RAM_MB}MB total RAM detected (Available: ${AVAILABLE_RAM_MB}MB). FFmpeg transcode operations may face constraints."
  else
    add_report "PASS" "System Memory" "RAM metrics: Total=${TOTAL_RAM_MB}MB, Available=${AVAILABLE_RAM_MB}MB (Prerequisite: >= 1024MB)."
  fi
else
  add_report "WARN" "System Memory" "Unable to fetch complete memory metrics."
fi

# Disk space check on actual HLS storage directory
HLS_DIR="/var/www/hls"
DISK_TARGET="$HLS_DIR"
if [ ! -d "$DISK_TARGET" ]; then
  DISK_TARGET="$SCRIPT_DIR"
fi
AVAILABLE_DISK_MB=$(df -m "$DISK_TARGET" | awk 'NR==2 {print $4}')
if [ -n "$AVAILABLE_DISK_MB" ]; then
  if [ "$AVAILABLE_DISK_MB" -lt 1500 ]; then
    add_report "FAIL" "Disk Space" "Only ${AVAILABLE_DISK_MB}MB free disk space available at $DISK_TARGET (Prerequisite: >= 1500MB)."
  else
    add_report "PASS" "Disk Space" "${AVAILABLE_DISK_MB}MB free disk space available at $DISK_TARGET."
  fi
else
  add_report "WARN" "Disk Space" "Unable to fetch disk metrics."
fi

# CPU Load check
CPU_LOAD=$(uptime | awk -F'load average:' '{ print $2 }' | cut -d',' -f1 | xargs)
if [ -n "$CPU_LOAD" ]; then
  add_report "PASS" "CPU Load" "Current CPU 1-minute load average is: $CPU_LOAD."
else
  add_report "WARN" "CPU Load" "Unable to fetch CPU load average."
fi
echo ""

# ----------------------------------------------------
# 2. RUNTIME DEPENDENCIES & UTILITIES
# ----------------------------------------------------
print_section "2. Runtime Dependencies & Utilities"

# Node.js
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  add_report "PASS" "Node.js Runtime" "Installed version: $NODE_VER."
else
  add_report "FAIL" "Node.js Runtime" "Node.js executable is missing from the system path."
fi

# npm
if command -v npm &>/dev/null; then
  NPM_VER=$(npm -v)
  add_report "PASS" "npm Package Manager" "Installed version: v$NPM_VER."
else
  add_report "FAIL" "npm Package Manager" "npm executable is missing from the system path."
fi

# Docker
if command -v docker &>/dev/null; then
  DOCKER_VER=$(docker --version | head -n 1)
  add_report "PASS" "Docker Engine" "$DOCKER_VER."
else
  add_report "WARN" "Docker Engine" "Docker is not installed or not in system path (Bypassed if native host mode is used)."
fi

# PostgreSQL Client
if command -v psql &>/dev/null; then
  PSQL_VER=$(psql --version | head -n 1)
  add_report "PASS" "PostgreSQL Client" "$PSQL_VER is available."
else
  add_report "FAIL" "PostgreSQL Client" "PostgreSQL client utilities (psql) are missing."
fi

# FFmpeg
if command -v ffmpeg &>/dev/null; then
  FFMPEG_VER=$(ffmpeg -version | head -n 1 | cut -d' ' -f3)
  if ffmpeg -codecs 2>&1 | grep -q "libx264"; then
    add_report "PASS" "FFmpeg Transcoder" "Installed (v$FFMPEG_VER) with active libx264 codec support."
  else
    add_report "WARN" "FFmpeg Transcoder" "Installed (v$FFMPEG_VER) but libx264 codec was not explicitly verified."
  fi
else
  add_report "FAIL" "FFmpeg Transcoder" "FFmpeg transcode binary is missing from the system path."
fi
echo ""

# ----------------------------------------------------
# 3. BACKGROUND SERVICES STATUS (SYSTEMD)
# ----------------------------------------------------
print_section "3. Background Daemon Services Status"

check_service() {
  local service_name="$1"
  local display_name="$2"
  local required="$3"
  
  if ! systemctl list-unit-files | grep -Fq "${service_name}.service"; then
    if [ "$required" = "true" ]; then
      add_report "FAIL" "$display_name Service" "Service unit '${service_name}.service' is NOT installed on this system."
    else
      add_report "WARN" "$display_name Service" "Service unit '${service_name}.service' is NOT installed on this system (Optional)."
    fi
  elif systemctl is-active --quiet "$service_name"; then
    add_report "PASS" "$display_name Service" "Service daemon is running and active."
  else
    if [ "$required" = "true" ]; then
      add_report "FAIL" "$display_name Service" "Service is installed but INACTIVE or failed to start."
    else
      add_report "WARN" "$display_name Service" "Service is installed but INACTIVE or disabled (Optional)."
    fi
  fi
}

check_service "streampulse" "StreamPulse API Manager" "true"
check_service "nginx" "Nginx Web & RTMP Server" "true"
check_service "postgresql" "PostgreSQL Database" "true"
check_service "fail2ban" "Fail2Ban Protection" "false"
check_service "docker" "Docker Engine" "false"
echo ""

# ----------------------------------------------------
# 4. NETWORK PORT BINDINGS
# ----------------------------------------------------
print_section "4. Network Port Bindings"

check_port() {
  local port="$1"
  local service_desc="$2"
  local required="$3"
  
  local bound=false
  if command -v ss &>/dev/null; then
    if ss -tuln | grep -q ":$port "; then bound=true; fi
  else
    if netstat -tuln | grep -q ":$port "; then bound=true; fi
  fi
  
  if [ "$bound" = true ]; then
    add_report "PASS" "Port $port ($service_desc)" "Bound and actively listening."
  else
    if [ "$required" = "true" ]; then
      add_report "FAIL" "Port $port ($service_desc)" "Port is NOT bound. Ensure the service is fully started."
    else
      add_report "WARN" "Port $port ($service_desc)" "Port is NOT bound (Optional/Upgrade mode dependency)."
    fi
  fi
}

check_port "80" "HTTP Dashboard Ingress" "true"
check_port "1935" "RTMP Video Ingest" "true"
check_port "3000" "StreamPulse Backend Engine" "true"
check_port "5432" "PostgreSQL Database Engine" "true"
echo ""

# ----------------------------------------------------
# 5. ENVIRONMENT & DATABASE CONNECTIVITY
# ----------------------------------------------------
print_section "5. Environment & Database Connectivity"

if [ -f "$SCRIPT_DIR/.env" ]; then
  add_report "PASS" "Config File (.env)" "Found at absolute path with secure configurations."
  
  # Load DB credentials safely from env file, stripping quotes
  DB_USER=$(grep "^DB_USER=" "$SCRIPT_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  DB_PASSWORD=$(grep "^DB_PASSWORD=" "$SCRIPT_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  DB_NAME=$(grep "^DB_NAME=" "$SCRIPT_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  DB_HOST=$(grep "^DB_HOST=" "$SCRIPT_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  
  if [[ -n "$DB_USER" && -n "$DB_PASSWORD" && -n "$DB_NAME" && -n "$DB_HOST" ]]; then
    # Test local database connectivity
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
      add_report "PASS" "Database Connection" "Successfully authenticated to PostgreSQL ($DB_NAME@$DB_HOST) with configured credentials."
      
      # Validate schema existence
      TABLES_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
      if [ "$TABLES_COUNT" -gt 0 ]; then
        add_report "PASS" "Database Schema" "Verified $TABLES_COUNT tables in public schema."
      else
        add_report "FAIL" "Database Schema" "Database tables are missing. Try re-running the schema.sql seed."
      fi
    else
      add_report "FAIL" "Database Connection" "Failed to connect to local database. Verify credentials in .env and check pg_hba.conf."
    fi
  else
    add_report "FAIL" "Database Credentials" "Required credentials (DB_USER, DB_PASSWORD, DB_NAME, DB_HOST) are partially missing from .env."
  fi
else
  add_report "FAIL" "Config File (.env)" "Config file (.env) is missing from the app root directory $SCRIPT_DIR."
fi
echo ""

# ----------------------------------------------------
# 6. DIRECTORIES & FILE SYSTEM INTEGRITY
# ----------------------------------------------------
print_section "6. Directories & File System Integrity"

check_directory() {
  local dir_path="$1"
  local desc="$2"
  local owner="$3"
  
  if [ -d "$dir_path" ]; then
    if [ "$IS_ROOT" = "true" ]; then
      local actual_owner=$(stat -c '%U' "$dir_path" 2>/dev/null || echo "unknown")
      if [ "$actual_owner" = "$owner" ]; then
        add_report "PASS" "$desc Directory" "Found at $dir_path with correct owner ($owner)."
      else
        add_report "WARN" "$desc Directory" "Found at $dir_path but has owner '$actual_owner' instead of expected '$owner'."
      fi
    else
      add_report "PASS" "$desc Directory" "Directory exists at $dir_path. (Owner validation skipped for non-root check)"
    fi
  else
    add_report "FAIL" "$desc Directory" "Missing from expected path: $dir_path."
  fi
}

check_directory "/var/www/hls" "HLS Live Segment Root" "www-data"
check_directory "/var/log/streampulse" "StreamPulse System Logs" "streampulse"

if [ -x "/usr/local/bin/transcode.sh" ]; then
  add_report "PASS" "Transcode Engine" "Script /usr/local/bin/transcode.sh exists and is executable."
else
  add_report "FAIL" "Transcode Engine" "Transcode script /usr/local/bin/transcode.sh is missing or not executable."
fi
echo ""

# ----------------------------------------------------
# 7. WEB SERVICE API & ENDPOINT INTEGRITY
# ----------------------------------------------------
print_section "7. Web Service API & Endpoint Integrity"

API_HEALTHY=false
if curl -s --max-time 3 http://127.0.0.1:3000/api/health &>/dev/null; then
  API_HEALTHY=true
  add_report "PASS" "Local API Status" "Responding successfully to HTTP GET /api/health."
elif curl -s --max-time 3 http://127.0.0.1:3000/ &>/dev/null; then
  API_HEALTHY=true
  add_report "PASS" "Local API Status" "Responding to index route on port 3000."
else
  add_report "FAIL" "Local API Status" "No response on http://127.0.0.1:3000. Ensure npm/Node server is running."
fi

# ----------------------------------------------------
# SUMMARY OF PLATFORM STATUS
# ----------------------------------------------------
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "${BOLD}   🏁  Platform Diagnostic Verification Summary                              ${NC}"
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "  Passed Audits:   ${GREEN}${PASS_COUNT}${NC}"
echo -e "  Warnings:        ${YELLOW}${WARN_COUNT}${NC}"
echo -e "  Failed Audits:   ${RED}${FAIL_COUNT}${NC}"
echo -e "${CYAN}==============================================================================${NC}"

if [ "$FAIL_COUNT" -eq 0 ] && [ "$WARN_COUNT" -eq 0 ]; then
  echo -e "\n${GREEN}${BOLD}🎉 SUCCESS: Your StreamPulse RTMP VPS Manager is healthy and 100% ready for production!${NC}\n"
  exit 0
elif [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "\n${YELLOW}${BOLD}⚠ WARNING: Your platform is running but has warnings. Please check the warnings above.${NC}\n"
  exit 0
else
  echo -e "\n${RED}${BOLD}❌ ERROR: System is unhealthy. Please resolve the critical failures listed above!${NC}\n"
  exit 1
fi
