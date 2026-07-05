#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - High-Performance Platform Diagnostic Suite
# Supported OS: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
# Architect: Senior Linux DevOps, Security & Production Reliability Engineer
# ==============================================================================

# Prevent unbound variables and fail on command pipe errors
set -uo pipefail

# Get the absolute path of the directory containing this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# ----------------------------------------------------
# 1. ENVIRONMENT MODE & ACTIVE PATH DISCOVERY
# ----------------------------------------------------

# Detect Docker container vs bare-metal installation mode
detect_environment_mode() {
  if [ -f /.dockerenv ]; then
    echo "Docker Container Mode"
    return 0
  fi
  if grep -qi "docker\|lxc\|container" /proc/1/cgroup 2>/dev/null; then
    echo "Docker/LXC Container Mode"
    return 0
  fi
  if command -v systemd-detect-virt &>/dev/null; then
    local virt=$(systemd-detect-virt 2>/dev/null)
    if [ -n "$virt" ] && [ "$virt" != "none" ]; then
      echo "Virtual Machine Mode ($virt)"
      return 0
    fi
  fi
  echo "Bare-Metal / Physical Mode"
}
ENV_MODE=$(detect_environment_mode)

# Support custom installation directories dynamically (Rule 28)
detect_active_dir() {
  local search_paths=(
    "$SCRIPT_DIR"
    "/opt/streampulse"
    "/srv/streampulse"
  )
  # Dynamic expansion of any home directory installations
  for d in /home/*/streampulse; do
    if [ -d "$d" ]; then
      search_paths+=("$d")
    fi
  done

  # Prioritize directory that contains actual application source or build targets
  for path in "${search_paths[@]}"; do
    if [ -d "$path" ] && { [ -f "$path/.env" ] || [ -f "$path/package.json" ] || [ -f "$path/dist/server.cjs" ]; }; then
      echo "$path"
      return 0
    fi
  done
  
  # Default to current script directory
  echo "$SCRIPT_DIR"
}
ACTIVE_DIR=$(detect_active_dir)

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
  echo -e "Timestamp:    $(date)"
  echo -e "Active Dir:   ${CYAN}${ACTIVE_DIR}${NC}"
  echo -e "Env Mode:     ${CYAN}${ENV_MODE}${NC}"
  echo -e "Host IP:      $(hostname -I | awk '{print $1}' 2>/dev/null || echo "127.0.0.1")"
  echo -e "OS:           $(cat /etc/os-release | grep "PRETTY_NAME" | cut -d'=' -f2 | tr -d '\"' || echo "Ubuntu Linux")"
  echo -e "${CYAN}==============================================================================${NC}\n"
}

print_section() {
  echo -e "${BOLD}--- $1 ---${NC}"
}

# Root privilege validation
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

is_systemd_available() {
  if [ "$ENV_MODE" = "Docker Container Mode" ] || [ "$ENV_MODE" = "Docker/LXC Container Mode" ]; then
    return 1
  fi
  if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null; then
    return 0
  elif command -v systemctl &>/dev/null && [ -d /run/systemd/system ]; then
    return 0
  fi
  return 1
}

# ----------------------------------------------------
# 1. SYSTEM HARDWARE RESOURCES CHECK
# ----------------------------------------------------
print_section "1. System Hardware Resources Check"

# RAM check (Total and Available)
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}' 2>/dev/null || echo "")
AVAILABLE_RAM_MB=$(free -m | awk '/^Mem:/{print $7}' 2>/dev/null || echo "")
if [ -n "$TOTAL_RAM_MB" ] && [ -n "$AVAILABLE_RAM_MB" ]; then
  if [ "$TOTAL_RAM_MB" -lt 950 ]; then
    add_report "WARN" "System Memory" "Only ${TOTAL_RAM_MB}MB total RAM detected (Available: ${AVAILABLE_RAM_MB}MB). FFmpeg transcode operations may face constraints."
  else
    add_report "PASS" "System Memory" "RAM metrics: Total=${TOTAL_RAM_MB}MB, Available=${AVAILABLE_RAM_MB}MB (Prerequisite: >= 1024MB)."
  fi
else
  # Container/cgroup memory checking fallback
  if [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
    local limit_bytes=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || echo "")
    if [ -n "$limit_bytes" ] && [ "$limit_bytes" -lt 9223372036854771712 ]; then
      local limit_mb=$((limit_bytes / 1024 / 1024))
      add_report "PASS" "System Memory" "Cgroup RAM Limit detected: ${limit_mb}MB."
    else
      add_report "WARN" "System Memory" "Unable to fetch memory metrics (skipped inside non-privileged container)."
    fi
  else
    add_report "WARN" "System Memory" "Unable to fetch complete memory metrics."
  fi
fi

# Disk space check on actual HLS storage directory
HLS_DIR="/var/www/hls"
DISK_TARGET="$HLS_DIR"
if [ ! -d "$DISK_TARGET" ]; then
  DISK_TARGET="$ACTIVE_DIR"
fi
AVAILABLE_DISK_MB=$(df -m "$DISK_TARGET" 2>/dev/null | awk 'NR==2 {print $4}' || echo "")
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
CPU_LOAD=$(uptime 2>/dev/null | awk -F'load average:' '{ print $2 }' | cut -d',' -f1 | xargs || echo "")
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
  add_report "WARN" "Docker Engine" "Docker is not installed or not in system path (Optional if running native host mode)."
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
# 3. DAEMON SERVICES DIAGNOSIS (SYSTEMD + FAILSAFE PROCESS TABLE LOOKUP)
# ----------------------------------------------------
print_section "3. Background Daemon Services Status"

is_port_listening() {
  local port="$1"
  if command -v ss &>/dev/null; then
    ss -tuln 2>/dev/null | grep -q -E "[:\s]${port}\s" && return 0
  elif command -v netstat &>/dev/null; then
    netstat -tuln 2>/dev/null | grep -q -E "[:\s]${port}\s" && return 0
  else
    # Parse /proc/net/tcp for absolute fallback
    local hex_port=$(printf '%04X' "$port" 2>/dev/null || echo "")
    if [ -n "$hex_port" ] && [ -f "/proc/net/tcp" ]; then
      grep -q -i ":$hex_port" /proc/net/tcp 2>/dev/null && return 0
    fi
  fi
  return 1
}

is_process_running() {
  local service_type="$1"
  case "$service_type" in
    "nginx")
      pgrep -x nginx &>/dev/null || pidof nginx &>/dev/null || ps -C nginx &>/dev/null
      ;;
    "postgresql")
      pgrep -x postgres &>/dev/null || pgrep -x postmaster &>/dev/null || pidof postgres &>/dev/null || ps -C postgres &>/dev/null || ps -C postmaster &>/dev/null
      ;;
    "streampulse")
      pgrep -f "server\.ts" &>/dev/null || pgrep -f "server\.js" &>/dev/null || pgrep -f "server\.cjs" &>/dev/null || pgrep -f "streampulse" &>/dev/null
      ;;
    "docker")
      pgrep -x dockerd &>/dev/null || [ -S "/var/run/docker.sock" ]
      ;;
    "fail2ban")
      pgrep -f fail2ban &>/dev/null || [ -f "/var/run/fail2ban/fail2ban.sock" ] || [ -S "/var/run/fail2ban/fail2ban.sock" ]
      ;;
    *)
      return 1
      ;;
  esac
}

find_service_unit() {
  local service_pattern="$1"
  
  if ! is_systemd_available; then
    return 1
  fi
  
  # Try exact matches first
  if systemctl list-unit-files --all 2>/dev/null | grep -E -q "^${service_pattern}\.service"; then
    echo "${service_pattern}.service"
    return 0
  fi
  
  # Search list-unit-files
  local match=""
  match=$(systemctl list-unit-files --all --type=service 2>/dev/null | awk '{print $1}' | grep -E -i "${service_pattern}" | grep -E "\.service$" | head -n 1)
  if [ -n "$match" ]; then
    # If it's a templated service (e.g., postgresql@.service), resolve active instance if possible
    if [[ "$match" == *"@.service" ]]; then
      local prefix="${match%@.service}"
      local active_instance=$(systemctl list-units --all --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -E -i "^${prefix}@[0-9a-zA-Z_-]+\.service$" | head -n 1)
      if [ -n "$active_instance" ]; then
        echo "$active_instance"
        return 0
      fi
    fi
    echo "$match"
    return 0
  fi
  
  # Search list-units
  match=$(systemctl list-units --all --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -E -i "${service_pattern}" | grep -E "\.service$" | head -n 1)
  if [ -n "$match" ]; then
    echo "$match"
    return 0
  fi
  
  # Search physical directories
  local search_dirs=("/etc/systemd/system" "/lib/systemd/system" "/usr/lib/systemd/system")
  for sdir in "${search_dirs[@]}"; do
    if [ -d "$sdir" ]; then
      local found_file=$(find "$sdir" -maxdepth 2 -name "*${service_pattern}*.service" 2>/dev/null | head -n 1)
      if [ -n "$found_file" ]; then
        echo "$(basename "$found_file")"
        return 0
      fi
    fi
  done
  
  return 1
}

diagnose_service() {
  local service_type="$1"
  local display_name="$2"
  local required="$3"
  
  local status="NOT_INSTALLED"
  local systemd_name=""
  local enabled=false
  local active=false
  
  # 1. Systemd verification
  if is_systemd_available; then
    systemd_name=$(find_service_unit "$service_type" || echo "")
    if [ -n "$systemd_name" ]; then
      status="INSTALLED_BUT_STOPPED"
      if systemctl is-active --quiet "$systemd_name" 2>/dev/null; then
        active=true
        status="RUNNING"
      fi
      if systemctl is-enabled --quiet "$systemd_name" 2>/dev/null; then
        enabled=true
      fi
    fi
  fi
  
  # 2. Process and port verification (failsafe bypass)
  if is_process_running "$service_type"; then
    status="RUNNING"
    active=true
  fi
  
  # Port verification mapping
  case "$service_type" in
    "nginx")
      if is_port_listening 80 || is_port_listening 443; then
        status="RUNNING"
        active=true
      fi
      ;;
    "postgresql")
      if is_port_listening 5432; then
        status="RUNNING"
        active=true
      fi
      ;;
    "streampulse")
      if is_port_listening 3000; then
        status="RUNNING"
        active=true
      fi
      ;;
  esac
  
  # 3. Physical package asset validation (if systemd and process table both yielded nothing)
  if [ "$status" = "NOT_INSTALLED" ]; then
    local physical_present=false
    case "$service_type" in
      "nginx")
        if [ -x "/usr/sbin/nginx" ] || [ -d "/etc/nginx" ]; then physical_present=true; fi
        ;;
      "postgresql")
        if [ -d "/usr/lib/postgresql" ] || [ -d "/etc/postgresql" ]; then physical_present=true; fi
        ;;
      "streampulse")
        if [ -d "$ACTIVE_DIR" ] && { [ -f "$ACTIVE_DIR/package.json" ] || [ -f "$ACTIVE_DIR/server.ts" ] || [ -f "$ACTIVE_DIR/dist/server.cjs" ]; }; then
          physical_present=true
        fi
        ;;
      "docker")
        if command -v docker &>/dev/null || [ -d "/etc/docker" ]; then physical_present=true; fi
        ;;
      "fail2ban")
        if [ -x "/usr/bin/fail2ban-server" ] || [ -d "/etc/fail2ban" ]; then physical_present=true; fi
        ;;
    esac
    
    if [ "$physical_present" = true ]; then
      status="INSTALLED_BUT_STOPPED"
    fi
  fi
  
  # 4. Report status to user
  if [ "$status" = "RUNNING" ]; then
    local extra=""
    if [ -n "$systemd_name" ]; then
      extra=" (Systemd unit: $systemd_name"
      if [ "$enabled" = true ]; then
        extra="$extra, Enabled on boot)"
      else
        extra="$extra, Disabled on boot)"
      fi
    else
      extra=" (Running via Process/Port Table discovery)"
    fi
    add_report "PASS" "$display_name Service" "RUNNING${extra}"
  elif [ "$status" = "INSTALLED_BUT_STOPPED" ]; then
    local extra=""
    if [ -n "$systemd_name" ]; then
      extra=" (Systemd unit: $systemd_name"
      if [ "$enabled" = true ]; then
        extra="$extra, Enabled on boot)"
      else
        extra="$extra, Disabled on boot)"
      fi
    else
      extra=" (Binary/Code asset found on disk but stopped)"
    fi
    
    if [ "$required" = "true" ]; then
      add_report "FAIL" "$display_name Service" "INSTALLED BUT STOPPED${extra}"
    else
      add_report "WARN" "$display_name Service" "INSTALLED BUT STOPPED${extra} (Optional)"
    fi
  else
    if [ "$required" = "true" ]; then
      add_report "FAIL" "$display_name Service" "NOT INSTALLED"
    else
      add_report "WARN" "$display_name Service" "NOT INSTALLED (Optional)"
    fi
  fi
}

diagnose_service "streampulse" "StreamPulse API Manager" "true"
diagnose_service "nginx" "Nginx Web & RTMP Server" "true"
diagnose_service "postgresql" "PostgreSQL Database" "true"
diagnose_service "fail2ban" "Fail2Ban Protection" "false"
diagnose_service "docker" "Docker Engine" "false"
echo ""

# ----------------------------------------------------
# 4. NETWORK PORT BINDINGS
# ----------------------------------------------------
print_section "4. Network Port Bindings"

check_port() {
  local port="$1"
  local service_desc="$2"
  local required="$3"
  
  if is_port_listening "$port"; then
    add_report "PASS" "Port $port ($service_desc)" "Bound and actively listening."
  else
    if [ "$required" = "true" ]; then
      add_report "FAIL" "Port $port ($service_desc)" "Port is NOT bound. Ensure the service is fully started."
    else
      add_report "WARN" "Port $port ($service_desc)" "Port is NOT bound (Optional or upgrade fallback)."
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

if [ -f "$ACTIVE_DIR/.env" ]; then
  add_report "PASS" "Config File (.env)" "Found at $ACTIVE_DIR/.env"
  
  # Extract DB parameters cleanly, stripping out surrounding quotes
  DB_USER=$(grep "^DB_USER=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  DB_PASSWORD=$(grep "^DB_PASSWORD=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  DB_NAME=$(grep "^DB_NAME=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  DB_HOST=$(grep "^DB_HOST=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  
  if [[ -n "$DB_USER" && -n "$DB_PASSWORD" && -n "$DB_NAME" && -n "$DB_HOST" ]]; then
    # Validate real PostgreSQL connection and schema presence
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
      add_report "PASS" "Database Connection" "Connected successfully to PostgreSQL ($DB_NAME@$DB_HOST)."
      
      # Verify tables from database schema
      local tables_exist=false
      if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'streams');" 2>/dev/null | grep -q "t"; then
        tables_exist=true
      fi
      
      if [ "$tables_exist" = "true" ]; then
        local tables_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null)
        add_report "PASS" "Database Schema" "Verified database schema: 'streams' table present ($tables_count tables total)."
      else
        add_report "FAIL" "Database Schema" "Database connected, but expected StreamPulse tables are missing. Please seed from schema.sql."
      fi
    else
      add_report "FAIL" "Database Connection" "Failed to authenticate to PostgreSQL ($DB_NAME@$DB_HOST). Ensure database user credentials match."
    fi
  else
    add_report "FAIL" "Database Credentials" "Required credentials (DB_USER, DB_PASSWORD, DB_NAME, DB_HOST) are empty or not defined in .env."
  fi
else
  add_report "FAIL" "Config File (.env)" "Config file (.env) was not found in active directory '$ACTIVE_DIR'."
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
    local is_writable=false
    if [ -w "$dir_path" ]; then
      is_writable=true
    fi
    
    local write_desc="Writable"
    if [ "$is_writable" = "false" ]; then write_desc="NOT Writable"; fi
    
    # Custom adjustments for container execution contexts
    if [ "$ENV_MODE" = "Docker Container Mode" ] || [ "$ENV_MODE" = "Docker/LXC Container Mode" ]; then
      if [ "$is_writable" = "true" ]; then
        add_report "PASS" "$desc Directory" "Found at $dir_path (Writable, skipping host-level owner check under container)."
      else
        add_report "WARN" "$desc Directory" "Found at $dir_path but is NOT writable."
      fi
    elif [ "$IS_ROOT" = "true" ]; then
      local actual_owner=$(stat -c '%U' "$dir_path" 2>/dev/null || echo "unknown")
      if [ "$actual_owner" = "$owner" ]; then
        add_report "PASS" "$desc Directory" "Found at $dir_path with correct owner ($owner) and is $write_desc."
      else
        add_report "WARN" "$desc Directory" "Found at $dir_path but owned by '$actual_owner' instead of expected '$owner'. ($write_desc)"
      fi
    else
      add_report "PASS" "$desc Directory" "Found at $dir_path. ($write_desc, skipped root owner check)"
    fi
  else
    add_report "FAIL" "$desc Directory" "Directory does not exist at expected path '$dir_path'."
  fi
}

check_directory "/var/www/hls" "HLS Live Segment Root" "www-data"
check_directory "/var/log/streampulse" "StreamPulse System Logs" "streampulse"

# Locating transcode script with fallback
local transcode_path="/usr/local/bin/transcode.sh"
if [ ! -x "$transcode_path" ] && [ -f "$ACTIVE_DIR/vps-deployment/transcode.sh" ]; then
  transcode_path="$ACTIVE_DIR/vps-deployment/transcode.sh"
fi

if [ -x "$transcode_path" ]; then
  add_report "PASS" "Transcode Engine" "Transcode launcher script found and executable at $transcode_path."
else
  add_report "FAIL" "Transcode Engine" "Transcode script is missing or not executable at $transcode_path."
fi
echo ""

# ----------------------------------------------------
# 7. WEB SERVICE API & ENDPOINT INTEGRITY
# ----------------------------------------------------
print_section "7. Web Service API & Endpoint Integrity"

HEALTH_RESP=$(curl -s --max-time 3 http://127.0.0.1:3000/health 2>/dev/null || echo "")
API_FOUND=false

if [[ "$HEALTH_RESP" == *"\"status\""*"\"ok\""* ]] || [[ "$HEALTH_RESP" == *"\"ok\""* ]]; then
  add_report "PASS" "Local API Status" "GET http://127.0.0.1:3000/health returns status: ok"
  API_FOUND=true
else
  # Trying api/health sub-route fallback
  API_HEALTH_RESP=$(curl -s --max-time 3 http://127.0.0.1:3000/api/health 2>/dev/null || echo "")
  if [[ "$API_HEALTH_RESP" == *"\"status\""*"\"ok\""* ]] || [[ "$API_HEALTH_RESP" == *"\"ok\""* ]]; then
    add_report "PASS" "Local API Status" "GET http://127.0.0.1:3000/api/health returns status: ok"
    API_FOUND=true
  else
    # Try generic base route connection
    local base_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:3000/ || echo "000")
    if [ "$base_code" != "000" ] && [ "$base_code" != "404" ]; then
      add_report "PASS" "Local API Status" "Port 3000 responsive (HTTP $base_code at root level)."
      API_FOUND=true
    fi
  fi
fi

if [ "$API_FOUND" = "false" ]; then
  add_report "FAIL" "Local API Status" "Port 3000 or health endpoints are unresponsive. Ensure the Node.js server is running."
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

if [ "$FAIL_COUNT" -eq 0 ]; then
  if [ "$WARN_COUNT" -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}🎉 SUCCESS: Your StreamPulse RTMP VPS Manager is healthy and 100% ready for production!${NC}\n"
  else
    echo -e "\n${YELLOW}${BOLD}⚠ WARNING: Your platform is running but has warnings. Please check the warnings above.${NC}\n"
  fi
  exit 0
else
  echo -e "\n${RED}${BOLD}❌ ERROR: System is unhealthy. Please resolve the critical failures listed above!${NC}\n"
  exit 1
fi
