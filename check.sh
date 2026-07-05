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

detect_active_dir() {
  local search_paths=("$SCRIPT_DIR" "/opt/streampulse" "/srv/streampulse")
  for d in /home/*/streampulse; do
    if [ -d "$d" ]; then search_paths+=("$d"); fi
  done

  for path in "${search_paths[@]}"; do
    if [ -d "$path" ] && { [ -f "$path/.env" ] || [ -f "$path/package.json" ] || [ -f "$path/dist/server.cjs" ]; }; then
      echo "$path"
      return 0
    fi
  done
  echo "$SCRIPT_DIR"
}
ACTIVE_DIR=$(detect_active_dir)

# Terminal colors for professional formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0;37m' # No Color
BOLD='\033[1m'

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
  echo -e "\n${BOLD}${CYAN}▶  $1${NC}"
  echo -e "${CYAN}------------------------------------------------------------------------------${NC}"
}

IS_ROOT=true
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}[!] Warning: Running as non-root user. Privileged diagnostics may be skipped.${NC}\n"
  IS_ROOT=false
fi

print_header

# ----------------------------------------------------
# REPORT AND REMEDIATION ENGINE
# ----------------------------------------------------
PASS_COUNT=0
WARN_COUNT=0
SKIP_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

declare -a REMEDIATION_COMMANDS

add_report() {
  local status="$1"
  local component="$2"
  local description="$3"
  
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  
  if [ "$status" = "PASS" ]; then
    echo -e "  [${GREEN}✔${NC}] ${BOLD}${component}${NC}: ${description}"
    PASS_COUNT=$((PASS_COUNT + 1))
  elif [ "$status" = "WARN" ]; then
    echo -e "  [${YELLOW}⚠${NC}] ${BOLD}${component}${NC}: ${YELLOW}${description}${NC}"
    WARN_COUNT=$((WARN_COUNT + 1))
  elif [ "$status" = "SKIP" ]; then
    echo -e "  [${BLUE}↷${NC}] ${BOLD}${component}${NC}: ${BLUE}${description}${NC}"
    SKIP_COUNT=$((SKIP_COUNT + 1))
  else
    echo -e "  [${RED}✘${NC}] ${BOLD}${component}${NC}: ${RED}${description}${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

add_remediation() {
  local component="$1"
  local command="$2"
  REMEDIATION_COMMANDS+=("${component}|${command}")
}

is_systemd_available() {
  if command -v systemctl &>/dev/null; then
    systemctl list-units --type=service --no-legend &>/dev/null && return 0
  fi
  return 1
}

# ----------------------------------------------------
# 1. SYSTEM HARDWARE RESOURCES CHECK
# ----------------------------------------------------
print_section "1. System Hardware Resources"

# CPU Loads and Cores
CPU_CORES=$(nproc 2>/dev/null || echo "1")
CPU_MODEL=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | xargs 2>/dev/null || echo "Generic CPU")
CPU_LOAD=$(cat /proc/loadavg 2>/dev/null | awk '{print $1}' || uptime 2>/dev/null | awk -F'load average:' '{ print $2 }' | cut -d',' -f1 | xargs || echo "0.0")

# CPU load warning threshold (1.5 * Core Count)
MAX_LOAD=$(echo "$CPU_CORES * 1.5" | bc 2>/dev/null || echo "$CPU_CORES")
LOAD_OVERLIMIT=$(echo "$CPU_LOAD > $MAX_LOAD" | bc -l 2>/dev/null || echo "0")

if [ "$LOAD_OVERLIMIT" = "1" ]; then
  add_report "WARN" "CPU load average" "CPU 1-minute load is high: $CPU_LOAD ($CPU_CORES cores - $CPU_MODEL)"
  add_remediation "System CPU High Load" "Check top processes with: htop"
else
  add_report "PASS" "CPU load average" "Healthy ($CPU_LOAD) on $CPU_CORES Cores ($CPU_MODEL)"
fi

# Memory Checks
TOTAL_RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo "")
AVAILABLE_RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $7}' || echo "")

if [ -n "$TOTAL_RAM_MB" ] && [ -n "$AVAILABLE_RAM_MB" ]; then
  if [ "$TOTAL_RAM_MB" -lt 950 ]; then
    add_report "WARN" "System Memory" "Only ${TOTAL_RAM_MB}MB RAM detected. FFmpeg transcoding might suffer."
    add_remediation "Scale VPS RAM" "Increase VPS memory limit to >= 1GB (1024MB)"
  else
    add_report "PASS" "System Memory" "RAM: Total=${TOTAL_RAM_MB}MB, Available=${AVAILABLE_RAM_MB}MB"
  fi
else
  # Container check fallback
  if [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
    CG_LIMIT_BYTES=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || echo "")
    if [ -n "$CG_LIMIT_BYTES" ] && [ "$CG_LIMIT_BYTES" -lt 9223372036854771712 ]; then
      CG_LIMIT_MB=$((CG_LIMIT_BYTES / 1024 / 1024))
      add_report "PASS" "System Memory" "Container RAM Limit: ${CG_LIMIT_MB}MB"
    else
      add_report "WARN" "System Memory" "Cannot read host RAM statistics"
    fi
  else
    add_report "WARN" "System Memory" "System memory metrics unavailable"
  fi
fi

# Disk space check
HLS_DIR="/var/www/hls"
DISK_TARGET="$HLS_DIR"
if [ ! -d "$DISK_TARGET" ]; then DISK_TARGET="$ACTIVE_DIR"; fi
AVAILABLE_DISK_MB=$(df -m "$DISK_TARGET" 2>/dev/null | awk 'NR==2 {print $4}' || echo "")

if [ -n "$AVAILABLE_DISK_MB" ]; then
  if [ "$AVAILABLE_DISK_MB" -lt 1500 ]; then
    add_report "FAIL" "Disk Space" "Only ${AVAILABLE_DISK_MB}MB free disk space available at $DISK_TARGET (Prerequisite: >= 1500MB)"
    add_remediation "Disk Cleanup" "Free up disk space on $DISK_TARGET or expand the partition"
  else
    add_report "PASS" "Disk Space" "${AVAILABLE_DISK_MB}MB free at $DISK_TARGET (Prerequisite: >= 1500MB)"
  fi
else
  add_report "WARN" "Disk Space" "Unable to check disk partitions"
fi

UPTIME_STR=$(uptime -p 2>/dev/null || cat /proc/uptime 2>/dev/null | awk '{print "up " $1 " seconds"}' || echo "unknown")
add_report "PASS" "System Uptime" "Uptime state: $UPTIME_STR"

# ----------------------------------------------------
# 2. RUNTIME DEPENDENCIES & UTILITIES
# ----------------------------------------------------
print_section "2. Runtime Dependencies & Utilities"

check_dependency() {
  local cmd="$1"
  local name="$2"
  local ver_args="$3"
  local required="$4"
  
  if command -v "$cmd" &>/dev/null; then
    local ver=$(eval "$cmd $ver_args" 2>/dev/null | head -n 1)
    add_report "PASS" "$name" "Installed ($ver)"
    return 0
  else
    if [ "$required" = "true" ]; then
      add_report "FAIL" "$name" "Missing from system PATH"
      case "$cmd" in
        "node") add_remediation "Install Node.js" "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs" ;;
        "npm")  add_remediation "Install npm" "sudo apt-get install -y npm" ;;
        "git")  add_remediation "Install Git" "sudo apt-get install -y git" ;;
        "psql") add_remediation "Install PostgreSQL Client" "sudo apt-get install -y postgresql-client" ;;
        "ffmpeg") add_remediation "Install FFmpeg" "sudo apt-get update && sudo apt-get install -y ffmpeg" ;;
      esac
    else
      add_report "SKIP" "$name" "Not Installed (Optional)"
    fi
    return 1
  fi
}

check_dependency "node" "Node.js Runtime" "-v" "true"
check_dependency "npm" "npm Package Manager" "-v" "true"
check_dependency "git" "Git CLI Utility" "--version" "true"
check_dependency "psql" "PostgreSQL Client" "--version" "true"

# FFmpeg with codec check
if check_dependency "ffmpeg" "FFmpeg Transcoder" "-version" "true"; then
  if ffmpeg -codecs 2>&1 | grep -q "libx264"; then
    add_report "PASS" "FFmpeg h264 Codec" "libx264 software encoder support is active"
  else
    add_report "WARN" "FFmpeg h264 Codec" "libx264 software encoder support was not found"
    add_remediation "Recompile FFmpeg" "Install FFmpeg package with libx264 support: sudo apt-get install -y ffmpeg"
  fi
fi

# ----------------------------------------------------
# 3. BACKGROUND DAEMON SERVICES STATUS
# ----------------------------------------------------
print_section "3. Background Daemon Services Status"

is_port_listening() {
  local port="$1"
  if command -v ss &>/dev/null; then
    ss -tuln 2>/dev/null | grep -q -E "[:\s]${port}\s" && return 0
  elif command -v netstat &>/dev/null; then
    netstat -tuln 2>/dev/null | grep -q -E "[:\s]${port}\s" && return 0
  else
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
    "nginx") pgrep -x nginx &>/dev/null || pidof nginx &>/dev/null || ps -C nginx &>/dev/null ;;
    "postgresql") pgrep -x postgres &>/dev/null || pgrep -x postmaster &>/dev/null || pidof postgres &>/dev/null || ps -C postgres &>/dev/null ;;
    "streampulse") pgrep -f "dist/server\.cjs" &>/dev/null || pgrep -f "server\.ts" &>/dev/null || pgrep -f "streampulse" &>/dev/null ;;
    "docker") pgrep -x dockerd &>/dev/null || [ -S "/var/run/docker.sock" ] ;;
    "fail2ban") pgrep -f fail2ban &>/dev/null || [ -S "/var/run/fail2ban/fail2ban.sock" ] ;;
    *) return 1 ;;
  esac
}

find_systemd_unit() {
  local service_key="$1"
  if ! is_systemd_available; then echo ""; return 1; fi
  
  # Search physically first to bypass any dynamic listing lag
  local dirs=("/etc/systemd/system" "/lib/systemd/system" "/usr/lib/systemd/system" "/run/systemd/system")
  local patterns=()
  case "$service_key" in
    "streampulse") patterns=("streampulse.service" "*streampulse*.service") ;;
    "nginx")       patterns=("nginx.service" "*nginx*.service") ;;
    "postgresql")  patterns=("postgresql.service" "postgresql@*.service" "postgres.service" "*postgres*.service") ;;
    "docker")      patterns=("docker.service" "*docker*.service") ;;
    "fail2ban")    patterns=("fail2ban.service" "*fail2ban*.service") ;;
  esac

  for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
      for pat in "${patterns[@]}"; do
        local found=$(find "$dir" -maxdepth 1 -name "$pat" -print -quit 2>/dev/null)
        if [ -n "$found" ]; then
          basename "$found"
          return 0
        fi
      done
    fi
  done

  # Search via systemctl queries
  local match=""
  case "$service_key" in
    "streampulse")
      match=$(systemctl list-unit-files --type=service --all --no-legend 2>/dev/null | awk '{print $1}' | grep -E -i 'streampulse' | head -n 1)
      ;;
    "nginx")
      match=$(systemctl list-unit-files --type=service --all --no-legend 2>/dev/null | awk '{print $1}' | grep -E -i '^nginx.*\.service$' | head -n 1)
      ;;
    "postgresql")
      match=$(systemctl list-unit-files --type=service --all --no-legend 2>/dev/null | awk '{print $1}' | grep -E '^postgresql\.service$' | head -n 1)
      if [ -z "$match" ]; then
        match=$(systemctl list-unit-files --type=service --all --no-legend 2>/dev/null | awk '{print $1}' | grep -E '^postgresql@.*\.service$|^postgres.*\.service$' | head -n 1)
      fi
      ;;
    "docker")
      match=$(systemctl list-unit-files --type=service --all --no-legend 2>/dev/null | awk '{print $1}' | grep -E -i '^docker.*\.service$' | head -n 1)
      ;;
    "fail2ban")
      match=$(systemctl list-unit-files --type=service --all --no-legend 2>/dev/null | awk '{print $1}' | grep -E -i '^fail2ban.*\.service$' | head -n 1)
      ;;
  esac
  echo "$match"
}

# Global flags for cascade check skips
nginx_installed=false
pg_installed=false
sp_installed=false
docker_installed=false
f2b_installed=false

diagnose_service() {
  local service_key="$1"
  local display_name="$2"
  local is_optional="$3"
  
  local installed=false
  local running=false
  local unit_name=""
  local active_state="unknown"
  local enabled_state="unknown"
  
  unit_name=$(find_systemd_unit "$service_key")
  
  if [ -n "$unit_name" ]; then
    installed=true
    active_state=$(systemctl show -p ActiveState --value "$unit_name" 2>/dev/null || echo "unknown")
    enabled_state=$(systemctl is-enabled "$unit_name" 2>/dev/null || echo "unknown")
    if [ "$active_state" = "active" ]; then running=true; fi
  fi
  
  # Check physically
  local physical=false
  case "$service_key" in
    "nginx") [ -d "/etc/nginx" ] || command -v nginx &>/dev/null && physical=true ;;
    "postgresql") [ -d "/etc/postgresql" ] || [ -d "/var/lib/postgresql" ] && physical=true ;;
    "streampulse") [ -d "$ACTIVE_DIR" ] && { [ -f "$ACTIVE_DIR/package.json" ] || [ -f "$ACTIVE_DIR/dist/server.cjs" ]; } && physical=true ;;
    "docker") command -v docker &>/dev/null && physical=true ;;
    "fail2ban") [ -d "/etc/fail2ban" ] || command -v fail2ban-client &>/dev/null && physical=true ;;
  esac
  
  if [ "$physical" = "true" ]; then installed=true; fi
  
  # Check Process Table/Ports
  if is_process_running "$service_key"; then
    installed=true
    running=true
  fi
  case "$service_key" in
    "nginx") is_port_listening 80 || is_port_listening 1935 && { installed=true; running=true; } ;;
    "postgresql") is_port_listening 5432 && { installed=true; running=true; } ;;
    "streampulse") is_port_listening 3000 && { installed=true; running=true; } ;;
  esac
  
  # Set Global Install Flags
  if [ "$installed" = "true" ]; then
    case "$service_key" in
      "nginx") nginx_installed=true ;;
      "postgresql") pg_installed=true ;;
      "streampulse") sp_installed=true ;;
      "docker") docker_installed=true ;;
      "fail2ban") f2b_installed=true ;;
    esac
  fi
  
  if [ "$installed" = "false" ]; then
    add_report "SKIP" "$display_name Service" "SKIPPED (Not Installed)"
    return 0
  fi
  
  if [ "$running" = "true" ]; then
    local extra=""
    if [ -n "$unit_name" ]; then
      extra=" (Systemd unit: $unit_name, Enabled: $enabled_state)"
    else
      extra=" (Process table / port bound)"
    fi
    add_report "PASS" "$display_name Service" "RUNNING${extra}"
  else
    local extra=""
    if [ -n "$unit_name" ]; then
      extra=" (Systemd unit: $unit_name is inactive/failed)"
    else
      extra=" (Process / port check failed)"
    fi
    
    if [ "$is_optional" = "true" ]; then
      add_report "WARN" "$display_name Service" "INSTALLED BUT STOPPED${extra}"
      case "$service_key" in
        "docker") add_remediation "Start Docker" "sudo systemctl start docker" ;;
        "fail2ban") add_remediation "Start Fail2Ban" "sudo systemctl start fail2ban" ;;
      esac
    else
      add_report "FAIL" "$display_name Service" "INSTALLED BUT STOPPED${extra}"
      case "$service_key" in
        "nginx") add_remediation "Start Nginx Server" "sudo systemctl start nginx" ;;
        "postgresql") add_remediation "Start PostgreSQL Server" "sudo systemctl start postgresql" ;;
        "streampulse") add_remediation "Start StreamPulse Manager" "sudo systemctl start streampulse" ;;
      esac
    fi
  fi
}

diagnose_service "streampulse" "StreamPulse Service" "false"
diagnose_service "nginx" "Nginx Web & RTMP Server" "false"
diagnose_service "postgresql" "PostgreSQL Database" "false"
diagnose_service "fail2ban" "Fail2Ban Protection" "true"
diagnose_service "docker" "Docker Engine Daemon" "true"

# ----------------------------------------------------
# 4. NETWORK PORT BINDINGS
# ----------------------------------------------------
print_section "4. Network Port Bindings"

verify_port() {
  local port="$1"
  local desc="$2"
  local required="$3"
  local service_active="$4"
  
  if [ "$service_active" = "false" ]; then
    add_report "SKIP" "Port $port ($desc)" "SKIPPED (Service is not running)"
    return 0
  fi
  
  if is_port_listening "$port"; then
    add_report "PASS" "Port $port ($desc)" "Bound and actively listening"
  else
    if [ "$required" = "true" ]; then
      add_report "FAIL" "Port $port ($desc)" "Port is NOT listening"
      case "$port" in
        "80") add_remediation "Nginx Port Bind" "sudo systemctl restart nginx" ;;
        "1935") add_remediation "RTMP Port Bind" "Check RTMP block in /etc/nginx/nginx.conf and restart nginx" ;;
        "3000") add_remediation "Backend Port Bind" "sudo systemctl restart streampulse" ;;
        "5432") add_remediation "PostgreSQL Port Bind" "Check port configuration in postgresql.conf and restart postgresql" ;;
      esac
    else
      add_report "WARN" "Port $port ($desc)" "Port is offline (Optional)"
    fi
  fi
}

verify_port "80" "HTTP Dashboard Ingress" "true" "$nginx_installed"
verify_port "1935" "RTMP Streaming Port" "true" "$nginx_installed"
verify_port "3000" "StreamPulse Backend API" "true" "$sp_installed"
verify_port "5432" "PostgreSQL Server Port" "true" "$pg_installed"

# ----------------------------------------------------
# 5. ENVIRONMENT & DATABASE CONNECTIVITY
# ----------------------------------------------------
print_section "5. Environment & Database Connectivity"

if [ -f "$ACTIVE_DIR/.env" ]; then
  add_report "PASS" "Configuration file (.env)" "Found at $ACTIVE_DIR/.env"
  
  # Credentials extraction
  DB_USER=$(grep "^DB_USER=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" 2>/dev/null || echo "")
  DB_PASSWORD=$(grep "^DB_PASSWORD=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" 2>/dev/null || echo "")
  DB_NAME=$(grep "^DB_NAME=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" 2>/dev/null || echo "")
  DB_HOST=$(grep "^DB_HOST=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" 2>/dev/null || echo "")
  DB_PORT=$(grep "^DB_PORT=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" 2>/dev/null || echo "5432")
  JWT_SECRET=$(grep "^JWT_SECRET=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" 2>/dev/null || echo "")
  GEMINI_API_KEY=$(grep "^GEMINI_API_KEY=" "$ACTIVE_DIR/.env" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" 2>/dev/null || echo "")

  # JWT validation
  if [ -n "$JWT_SECRET" ]; then
    if [ "$JWT_SECRET" = "streampulse_default_secret_key_98451023" ] || [ ${#JWT_SECRET} -lt 16 ]; then
      add_report "WARN" "JWT Secret Security" "Insecure JWT_SECRET defined in .env"
      add_remediation "Strengthen JWT Secret" "Generate a secure key with: openssl rand -hex 32"
    else
      add_report "PASS" "JWT Secret Security" "Secure secret key is set"
    fi
  else
    add_report "FAIL" "JWT Secret Config" "JWT_SECRET is empty in .env"
    add_remediation "Set JWT Secret" "Define a secure random string for JWT_SECRET in $ACTIVE_DIR/.env"
  fi

  # Gemini key validation (Warning only if missing)
  if [ -n "$GEMINI_API_KEY" ]; then
    add_report "PASS" "Gemini API Key" "Key is present"
  else
    add_report "WARN" "Gemini API Key" "GEMINI_API_KEY missing. AI streaming assistance will run in simulation mode."
    add_remediation "Add Gemini AI Key" "Add GEMINI_API_KEY=your_key to $ACTIVE_DIR/.env to enable automated transcoding optimization suggestions"
  fi

  # DB credentials validation
  if [[ -n "$DB_USER" && -n "$DB_PASSWORD" && -n "$DB_NAME" && -n "$DB_HOST" ]]; then
    if command -v psql &>/dev/null; then
      if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
        add_report "PASS" "Database Connection" "Connected successfully to PostgreSQL ($DB_NAME@$DB_HOST:$DB_PORT)"
        
        # Schema Table Verification
        local schema_ok=false
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='streams');" 2>/dev/null | grep -q "t"; then
          schema_ok=true
        fi
        
        if [ "$schema_ok" = "true" ]; then
          add_report "PASS" "Database Schema Tables" "Schema verified. 'streams' table is active"
        else
          add_report "FAIL" "Database Schema Tables" "Connected to DB, but 'streams' schema table is missing"
          add_remediation "Seed DB Schema" "PGPASSWORD=\"$DB_PASSWORD\" psql -h \"$DB_HOST\" -p \"$DB_PORT\" -U \"$DB_USER\" -d \"$DB_NAME\" -f \"$ACTIVE_DIR/vps-deployment/schema.sql\""
        fi
      else
        add_report "FAIL" "Database Connection" "Authentication/connection failed to PostgreSQL on $DB_HOST"
        add_remediation "Fix Postgres Credentials" "Confirm database user '$DB_USER' matches host settings"
      fi
    else
      add_report "FAIL" "Database Connection" "PostgreSQL client utilities (psql) are missing; cannot run check"
    fi
  else
    add_report "FAIL" "Database Parameters" "DB parameters in .env are incomplete"
    add_remediation "Configure DB variables" "Check DB_USER, DB_PASSWORD, DB_NAME, DB_HOST in $ACTIVE_DIR/.env"
  fi
else
  add_report "FAIL" "Configuration file (.env)" "File not found at $ACTIVE_DIR/.env"
  add_remediation "Create Environment File" "cp $ACTIVE_DIR/.env.example $ACTIVE_DIR/.env && chmod 600 $ACTIVE_DIR/.env"
fi

# ----------------------------------------------------
# 6. DIRECTORIES & FILE SYSTEM INTEGRITY
# ----------------------------------------------------
print_section "6. Directories & File System Integrity"

verify_dir() {
  local path="$1"
  local desc="$2"
  local expected_owner="$3"
  local required_perm="$4"
  
  if [ -d "$path" ]; then
    if [ -w "$path" ]; then
      if [ "$IS_ROOT" = "true" ]; then
        local actual_owner=$(stat -c "%U" "$path" 2>/dev/null || echo "unknown")
        if [ "$actual_owner" = "$expected_owner" ]; then
          add_report "PASS" "$desc Path" "Found at $path with correct ownership ($expected_owner) and is writable"
        else
          add_report "WARN" "$desc Path" "Found at $path but owned by '$actual_owner' instead of '$expected_owner'"
          add_remediation "Fix $desc Ownership" "sudo chown -R $expected_owner:$expected_owner $path"
        fi
      else
        add_report "PASS" "$desc Path" "Found at $path and is writable"
      fi
    else
      add_report "FAIL" "$desc Path" "Found at $path but is NOT writable"
      add_remediation "Fix $desc Write Perms" "sudo chmod -R $required_perm $path && sudo chown -R $expected_owner $path"
    fi
  else
    add_report "FAIL" "$desc Path" "Directory $path is missing"
    add_remediation "Create $desc Directory" "sudo mkdir -p $path && sudo chown -R $expected_owner $path && sudo chmod -R $required_perm $path"
  fi
}

verify_dir "/var/www/hls" "HLS Segment Root" "www-data" "775"
verify_dir "/var/log/streampulse" "StreamPulse Logs" "streampulse" "755"

# Workspace local data folder
verify_dir "$ACTIVE_DIR/data" "Local Workspace Storage" "$(stat -c '%U' "$ACTIVE_DIR" 2>/dev/null || echo "streampulse")" "775"

# Transcode executable check
local transcode_sh="/usr/local/bin/transcode.sh"
if [ -x "$transcode_sh" ]; then
  add_report "PASS" "Transcode Pipeline Launcher" "Executable transcode launcher found at $transcode_sh"
elif [ -f "$ACTIVE_DIR/vps-deployment/transcode.sh" ]; then
  add_report "WARN" "Transcode Pipeline Launcher" "Launcher missing on host binary path. Template copy advised"
  add_remediation "Install Transcode Launcher" "sudo cp $ACTIVE_DIR/vps-deployment/transcode.sh /usr/local/bin/transcode.sh && sudo chmod +x /usr/local/bin/transcode.sh"
else
  add_report "FAIL" "Transcode Pipeline Launcher" "Launcher script or deployment template missing"
fi

# ----------------------------------------------------
# 7. WEB SERVICE API & ENDPOINT INTEGRITY
# ----------------------------------------------------
print_section "7. Web Service API & Endpoint Integrity"

if [ "$sp_installed" = "true" ]; then
  PORT_ENV=$(grep "^PORT=" "$ACTIVE_DIR/.env" 2>/dev/null | cut -d'=' -f2- | xargs || echo "3000")
  if [ -z "$PORT_ENV" ]; then PORT_ENV="3000"; fi
  
  if is_port_listening "$PORT_ENV"; then
    local health_resp=$(curl -s --max-time 3 "http://127.0.0.1:$PORT_ENV/health" 2>/dev/null || echo "")
    local status_verified=false
    
    if [[ "$health_resp" == *"status"* && "$health_resp" == *"ok"* ]]; then
      add_report "PASS" "API Health Endpoint" "GET /health returns HTTP 200 with status: ok"
      status_verified=true
    else
      # Try fallback /api/health
      local api_health_resp=$(curl -s --max-time 3 "http://127.0.0.1:$PORT_ENV/api/health" 2>/dev/null || echo "")
      if [[ "$api_health_resp" == *"status"* && "$api_health_resp" == *"ok"* ]]; then
        add_report "PASS" "API Health Endpoint" "GET /api/health returns HTTP 200 with status: ok"
        status_verified=true
      fi
    fi
    
    if [ "$status_verified" = "false" ]; then
      local root_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:$PORT_ENV/" || echo "000")
      if [ "$root_code" != "000" ] && [ "$root_code" != "404" ]; then
        add_report "PASS" "API Health Endpoint" "Server responsive at root level with HTTP $root_code"
      else
        add_report "FAIL" "API Health Endpoint" "Server listening but did not return valid health status response"
        add_remediation "Debug API Server" "Check recent application errors: journalctl -u streampulse -n 30 --no-pager"
      fi
    fi
  else
    add_report "FAIL" "StreamPulse Port Bind" "Port $PORT_ENV is offline. Backend is unresponsive"
    add_remediation "Start Backend Service" "sudo systemctl start streampulse"
  fi
else
  add_report "SKIP" "API Health Endpoint" "SKIPPED (StreamPulse API Manager service not running)"
fi

# ----------------------------------------------------
# 8. SECURITY CONFIGURATION VERIFICATION
# ----------------------------------------------------
print_section "8. Security Configuration"

# Firewall (UFW)
if command -v ufw &>/dev/null; then
  local ufw_out=$(ufw status 2>/dev/null || echo "")
  if [[ "$ufw_out" == *"Status: active"* || "$ufw_out" == *"active"* ]]; then
    add_report "PASS" "UFW Firewall Protection" "Firewall is active and shielding the host"
    local missing_ports=()
    for port in 22 80 443 1935; do
      if ! echo "$ufw_out" | grep -q -E "(\s|^)$port(/|$)" 2>/dev/null; then missing_ports+=("$port"); fi
    done
    
    if [ ${#missing_ports[@]} -gt 0 ]; then
      add_report "WARN" "UFW Allowed Ports" "Active firewall is missing rules for critical streaming ports: ${missing_ports[*]}"
      for p in "${missing_ports[@]}"; do
        add_remediation "Open Port $p in Firewall" "sudo ufw allow $p/tcp"
      done
    else
      add_report "PASS" "UFW Allowed Ports" "All streaming and SSH ports are safely allowed in the firewall"
    fi
  else
    add_report "WARN" "UFW Firewall Protection" "UFW is installed but INACTIVE"
    add_remediation "Activate Firewall Protection" "sudo ufw enable"
  fi
else
  add_report "WARN" "UFW Firewall Protection" "UFW utility is missing from the system"
  add_remediation "Install Firewall Protection" "sudo apt-get install -y ufw"
fi

# Fail2Ban Jails Check
if [ "$f2b_installed" = "true" ]; then
  if command -v fail2ban-client &>/dev/null; then
    local f2b_ping=$(fail2ban-client ping 2>/dev/null || echo "")
    if [ "$f2b_ping" = "Server replied: pong" ]; then
      add_report "PASS" "Fail2Ban Protection" "Fail2Ban daemon is active and responsive"
      local jails=$(fail2ban-client status 2>/dev/null | grep "Jail list" | cut -d':' -f2- | tr -d ' ' || echo "")
      if [ -n "$jails" ]; then
        add_report "PASS" "Fail2Ban Active Jails" "Monitoring active jails: $jails"
      else
        add_report "WARN" "Fail2Ban Active Jails" "Fail2Ban is running but no shields/jails are active"
        add_remediation "Configure Fail2Ban Shields" "Enable [sshd] and [nginx-http-auth] jails in /etc/fail2ban/jail.local"
      fi
    else
      add_report "WARN" "Fail2Ban Protection" "Fail2Ban client cannot reach the daemon"
      add_remediation "Restart Fail2Ban Shields" "sudo systemctl restart fail2ban"
    fi
  else
    add_report "WARN" "Fail2Ban Protection" "Fail2Ban client utility is missing"
  fi
fi

# Secure File Permissions
if [ -f "$ACTIVE_DIR/.env" ]; then
  local env_perm=$(stat -c "%a" "$ACTIVE_DIR/.env" 2>/dev/null || echo "")
  if [[ "$env_perm" == "600" || "$env_perm" == "640" || "$env_perm" == "400" ]]; then
    add_report "PASS" ".env File Security" "Secure file permissions verified ($env_perm)"
  else
    add_report "WARN" ".env File Security" "Insecure file permissions detected ($env_perm)"
    add_remediation "Secure .env Permissions" "sudo chmod 600 $ACTIVE_DIR/.env"
  fi
fi

# Let's Encrypt SSL
if [ "$nginx_installed" = "true" ]; then
  local domain=$(grep -oP 'server_name \K[^;]+' /etc/nginx/sites-enabled/streampulse 2>/dev/null | awk '{print $1}' || echo "")
  if [[ -n "$domain" && "$domain" != "_" && "$domain" != "localhost" ]]; then
    local fullchain="/etc/letsencrypt/live/$domain/fullchain.pem"
    if [ -f "$fullchain" ]; then
      local end_date=$(openssl x509 -enddate -noout -in "$fullchain" | cut -d= -f2)
      local end_epoch=$(date -d "$end_date" +%s 2>/dev/null || date --date="$end_date" +%s 2>/dev/null || echo "0")
      local now_epoch=$(date +%s)
      
      if [ "$end_epoch" -eq 0 ]; then
        add_report "WARN" "SSL Certificate" "Validating certificate date failed for domain $domain"
      else
        local days_left=$(( (end_epoch - now_epoch) / 86400 ))
        if [ "$days_left" -lt 0 ]; then
          add_report "FAIL" "SSL Certificate" "Let's Encrypt SSL certificate for $domain is EXPIRED"
          add_remediation "Renew Let's Encrypt SSL" "sudo certbot renew"
        elif [ "$days_left" -lt 15 ]; then
          add_report "WARN" "SSL Certificate" "Let's Encrypt SSL certificate for $domain expires in $days_left days"
          add_remediation "Renew Let's Encrypt SSL" "sudo certbot renew"
        else
          add_report "PASS" "SSL Certificate" "Active and secure SSL verified for $domain (expires in $days_left days)"
        fi
      fi
    else
      add_report "WARN" "SSL Certificate" "Domain $domain configured in Nginx but Let's Encrypt SSL is missing"
      add_remediation "Generate SSL Certificate" "sudo certbot --nginx -d $domain"
    fi
  else
    add_report "SKIP" "SSL Certificate" "SSL check skipped (No domain registered in Nginx config)"
  fi
fi

# ----------------------------------------------------
# 9. DOCKER CONTAINERIZATION CHECKS
# ----------------------------------------------------
print_section "9. Docker Engine & Active Containers"

if [ "$docker_installed" = "true" ]; then
  if docker info &>/dev/null; then
    add_report "PASS" "Docker Daemon status" "Responsive and running"
    
    if [ -f "$ACTIVE_DIR/vps-deployment/docker-compose.yml" ]; then
      local running_ps=$(docker compose -f "$ACTIVE_DIR/vps-deployment/docker-compose.yml" ps --format json 2>/dev/null || echo "")
      if [ -n "$running_ps" ] && [ "$running_ps" != "[]" ]; then
        local cc=$(echo "$running_ps" | grep -c "name" || echo "0")
        add_report "PASS" "Docker Compose Containers" "$cc active containers discovered in project"
      else
        add_report "SKIP" "Docker Compose Containers" "Project containers are currently inactive/offline"
      fi
    else
      add_report "SKIP" "Docker Compose Containers" "docker-compose.yml not found"
    fi
  else
    add_report "WARN" "Docker Daemon status" "Docker is installed but daemon is offline"
    add_remediation "Activate Docker Daemon" "sudo systemctl start docker"
  fi
else
  add_report "SKIP" "Docker Daemon status" "Docker is not installed"
fi

# ----------------------------------------------------
# VERIFICATION METRICS SUMMARY CARD
# ----------------------------------------------------
echo -e "\n${CYAN}${BOLD}==============================================================================${NC}"
echo -e "${BOLD}   🏁  Platform Diagnostic Verification Summary                              ${NC}"
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "  Passed Audits:   ${GREEN}${PASS_COUNT}${NC}"
echo -e "  Warnings:        ${YELLOW}${WARN_COUNT}${NC}"
echo -e "  Skipped Audits:  ${BLUE}${SKIP_COUNT}${NC}"
echo -e "  Failed Audits:   ${RED}${FAIL_COUNT}${NC}"
echo -e "${CYAN}------------------------------------------------------------------------------${NC}"

# Health percentage calculation
ACTIVE_TESTS=$((TOTAL_COUNT - SKIP_COUNT))
HEALTH_PERCENT=0
if [ "$ACTIVE_TESTS" -gt 0 ]; then
  HEALTH_PERCENT=$(( (PASS_COUNT * 100) / ACTIVE_TESTS ))
fi

# Progress Bar
BAR_WIDTH=40
FILLED_CHARS=$(( (HEALTH_PERCENT * BAR_WIDTH) / 100 ))
EMPTY_CHARS=$(( BAR_WIDTH - FILLED_CHARS ))
BAR_COLOR="${GREEN}"
if [ "$HEALTH_PERCENT" -lt 50 ]; then
  BAR_COLOR="${RED}"
elif [ "$HEALTH_PERCENT" -lt 85 ]; then
  BAR_COLOR="${YELLOW}"
fi

printf "  Health Score: %s[" "$BAR_COLOR"
for ((i=0; i<FILLED_CHARS; i++)); do printf "█"; done
for ((i=0; i<EMPTY_CHARS; i++)); do printf "░"; done
printf "] %d%%${NC}\n" "$HEALTH_PERCENT"
echo -e "${CYAN}==============================================================================${NC}"

# Final Status Banner
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "\n${GREEN}${BOLD}==============================================================================${NC}"
  echo -e "${GREEN}${BOLD}   🏆  SYSTEM STATUS : HEALTHY                                               ${NC}"
  echo -e "${GREEN}${BOLD}==============================================================================${NC}"
  if [ "$WARN_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Warning: Platform is operational but has minor notices. Review output above.${NC}"
  fi
else
  echo -e "\n${RED}${BOLD}==============================================================================${NC}"
  echo -e "${RED}${BOLD}   🚨  SYSTEM STATUS : NEEDS ATTENTION                                       ${NC}"
  echo -e "${RED}${BOLD}==============================================================================${NC}"
  echo -e "${RED}Error: $FAIL_COUNT critical checks failed. Action required immediately.${NC}"
fi

# Consolidated Troubleshooting & Remediation Playbook
if [ ${#REMEDIATION_COMMANDS[@]} -gt 0 ]; then
  echo -e "\n${CYAN}${BOLD}🔧 Troubleshooting & Remediation Playbook${NC}"
  echo -e "${CYAN}==============================================================================${NC}"
  for item in "${REMEDIATION_COMMANDS[@]}"; do
    comp=$(echo "$item" | cut -d'|' -f1)
    cmd=$(echo "$item" | cut -d'|' -f2-)
    echo -e "  - ${BOLD}$comp${NC}:"
    echo -e "    ${YELLOW}$cmd${NC}"
  done
  echo -e "${CYAN}==============================================================================${NC}\n"
fi

# Safe exit code based on critical failure presence
if [ "$FAIL_COUNT" -eq 0 ]; then
  exit 0
else
  exit 1
fi
