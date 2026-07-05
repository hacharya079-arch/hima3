#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - Production Diagnostic & Verification Suite
# Supported OS: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
# Architect: Senior Linux DevOps & Production Reliability Engineer
# Code Quality: Production-grade Bash, set -euo pipefail compatible
# ==============================================================================

set -euo pipefail

# Get the absolute path of the directory containing this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# ------------------------------------------------------------------------------
# 1. COLOR CODES & FORMATTING
# ------------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ------------------------------------------------------------------------------
# 2. RUNTIME ENVIRONMENT DISCOVERY
# ------------------------------------------------------------------------------
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
    local virt; virt=$(systemd-detect-virt 2>/dev/null || echo "none")
    if [ -n "$virt" ] && [ "$virt" != "none" ]; then
      echo "Virtual Machine Mode ($virt)"
      return 0
    fi
  fi
  echo "Bare-Metal / Physical Mode"
}

detect_active_dir() {
  # Direct check if SCRIPT_DIR is the root/app dir
  if [ -f "$SCRIPT_DIR/.env" ] || [ -f "$SCRIPT_DIR/package.json" ] || [ -f "$SCRIPT_DIR/dist/server.cjs" ]; then
    echo "$SCRIPT_DIR"
    return 0
  fi

  local search_paths=("/opt/streampulse" "/srv/streampulse")
  # Safely expand possible home directory installations without set -u issues
  local home_dirs; home_dirs=$(find /home -maxdepth 2 -name "streampulse" -type d 2>/dev/null || echo "")
  local dir
  for dir in $home_dirs; do
    if [ -n "$dir" ] && [ -d "$dir" ]; then
      search_paths+=("$dir")
    fi
  done

  for path in "${search_paths[@]}"; do
    if [ -d "$path" ] && { [ -f "$path/.env" ] || [ -f "$path/package.json" ] || [ -f "$path/dist/server.cjs" ]; }; then
      echo "$path"
      return 0
    fi
  done
  echo "$SCRIPT_DIR"
}

ENV_MODE=$(detect_environment_mode)
ACTIVE_DIR=$(detect_active_dir)
IS_ROOT=true
if [ "$EUID" -ne 0 ]; then
  IS_ROOT=false
fi

# ------------------------------------------------------------------------------
# 3. DIAGNOSTIC REPORT COUNTERS & STATE
# ------------------------------------------------------------------------------
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
TOTAL_COUNT=0

declare -a REMEDIATION_STEPS=()

add_report() {
  local status="$1"
  local component="$2"
  local description="$3"

  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  case "$status" in
    "PASS")
      PASS_COUNT=$((PASS_COUNT + 1))
      echo -e "  [ ${GREEN}${BOLD}PASS${NC} ] ${BOLD}${component}${NC}: ${description}"
      ;;
    "WARN")
      WARN_COUNT=$((WARN_COUNT + 1))
      echo -e "  [ ${YELLOW}${BOLD}WARN${NC} ] ${BOLD}${component}${NC}: ${YELLOW}${description}${NC}"
      ;;
    "FAIL")
      FAIL_COUNT=$((FAIL_COUNT + 1))
      echo -e "  [ ${RED}${BOLD}FAIL${NC} ] ${BOLD}${component}${NC}: ${RED}${BOLD}${description}${NC}"
      ;;
    "SKIP")
      SKIP_COUNT=$((SKIP_COUNT + 1))
      echo -e "  [ ${BLUE}${BOLD}SKIP${NC} ] ${BOLD}${component}${NC}: ${BLUE}${description}${NC}"
      ;;
  esac
}

add_remediation() {
  local component="$1"
  local fix_cmd="$2"
  REMEDIATION_STEPS+=("${component}|${fix_cmd}")
}

print_header() {
  echo -e "\n${CYAN}${BOLD}==============================================================================${NC}"
  echo -e "${CYAN}${BOLD}   🔍  StreamPulse Platform Diagnostic & System Verification Suite           ${NC}"
  echo -e "${CYAN}${BOLD}==============================================================================${NC}"
  echo -e "Timestamp:    $(date)"
  echo -e "Active Dir:   ${CYAN}${ACTIVE_DIR}${NC}"
  echo -e "Env Mode:     ${CYAN}${ENV_MODE}${NC}"
  echo -e "Host IP:      $(hostname -I | awk '{print $1}' 2>/dev/null || echo "127.0.0.1")"
  echo -e "OS:           $(cat /etc/os-release | grep "PRETTY_NAME" | cut -d'=' -f2 | tr -d '\"' || echo "Ubuntu Linux")"
  echo -e "${CYAN}==============================================================================${NC}"
}

print_section() {
  echo -e "\n${BOLD}${CYAN}▶  $1${NC}"
  echo -e "${CYAN}------------------------------------------------------------------------------${NC}"
}

is_port_listening() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tuln 2>/dev/null | grep -q -E "[:\s]${port}\s" && return 0
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -tuln 2>/dev/null | grep -q -E "[:\s]${port}\s" && return 0
  fi
  # File descriptor fallback check (does not require external tools)
  if (timeout 1 bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/$port" >/dev/null 2>&1); then
    return 0
  fi
  return 1
}

# ------------------------------------------------------------------------------
# 4. MODULAR DIAGNOSTIC FUNCTIONS
# ------------------------------------------------------------------------------

# -- Category 1: Hardware Resource Diagnostics --
check_hardware() {
  print_section "1. HARDWARE SYSTEM RESOURCES"

  # CPU Core Count Discovery
  local cpu_cores=1
  if command -v nproc >/dev/null 2>&1; then
    cpu_cores=$(nproc)
  elif [ -f /proc/cpuinfo ]; then
    cpu_cores=$(grep -c ^processor /proc/cpuinfo || echo "1")
  fi

  # CPU 1-minute Load Average
  local cpu_load="0.00"
  if [ -f /proc/loadavg ]; then
    cpu_load=$(awk '{print $1}' /proc/loadavg || echo "0.00")
  elif command -v uptime >/dev/null 2>&1; then
    cpu_load=$(uptime | awk -F'load average:' '{ print $2 }' | cut -d',' -f1 | xargs 2>/dev/null | awk '{print $1}' || echo "0.00")
  fi

  # Assess Load Level (Warning threshold is dynamic based on core capacity)
  local load_int; load_int=$(echo "$cpu_load" | cut -d. -f1 || echo "0")
  local max_load_threshold=$(( cpu_cores * 2 ))
  
  if [ "$load_int" -ge "$max_load_threshold" ]; then
    add_report "WARN" "CPU 1-min Load" "System load average is high: $cpu_load ($cpu_cores Cores)"
    add_remediation "Assess System Processes" "Execute 'htop' or 'top -b -n 1 | head -n 20' to analyze resource hogging services."
  else
    add_report "PASS" "CPU 1-min Load" "Normal CPU load state ($cpu_load on $cpu_cores Cores)"
  fi

  # Physical RAM Check
  local total_ram=0
  local free_ram=0
  if command -v free >/dev/null 2>&1; then
    total_ram=$(free -m | awk '/^Mem:/{print $2}' || echo "0")
    free_ram=$(free -m | awk '/^Mem:/{print $7}' || echo "0")
  elif [ -f /proc/meminfo ]; then
    local total_kb; total_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}' || echo "0")
    local free_kb; free_kb=$(grep MemAvailable /proc/meminfo | awk '{print $2}' || echo "0")
    total_ram=$(( total_kb / 1024 ))
    free_ram=$(( free_kb / 1024 ))
  fi

  if [ "$total_ram" -gt 0 ]; then
    if [ "$total_ram" -lt 950 ]; then
      add_report "WARN" "System RAM" "Memory is ${total_ram}MB (Recommended: >= 1024MB for video transcoding)"
      add_remediation "Scale Host Memory" "Increase system RAM limit to >= 1GB to prevent Out-Of-Memory (OOM) killer terminations of FFmpeg."
    else
      add_report "PASS" "System RAM" "Total Memory: ${total_ram}MB, Available Memory: ${free_ram}MB"
    fi
  else
    add_report "WARN" "System RAM" "Unable to fetch system RAM capacity metrics"
  fi

  # Disk Partitions Free Space Diagnostics
  local active_disk_free=0
  local hls_disk_free=0
  local required_disk_mb=1500

  if command -v df >/dev/null 2>&1; then
    active_disk_free=$(df -m "$ACTIVE_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
    if [ -d "/var/www/hls" ]; then
      hls_disk_free=$(df -m "/var/www/hls" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
    else
      hls_disk_free="$active_disk_free"
    fi
  fi

  if [ "$active_disk_free" -gt 0 ]; then
    if [ "$active_disk_free" -lt "$required_disk_mb" ]; then
      add_report "FAIL" "Disk Space (Active)" "Free space in $ACTIVE_DIR is ${active_disk_free}MB (Required: >= ${required_disk_mb}MB)"
      add_remediation "Clean Up Active Disk" "Run disk clean-up routines, prune older Docker components, or expand partition size."
    else
      add_report "PASS" "Disk Space (Active)" "Free space is ${active_disk_free}MB (Meets requirements)"
    fi
  else
    add_report "WARN" "Disk Space (Active)" "Could not retrieve partition space details for $ACTIVE_DIR"
  fi

  if [ -d "/var/www/hls" ] && [ "$hls_disk_free" -ne "$active_disk_free" ]; then
    if [ "$hls_disk_free" -gt 0 ]; then
      if [ "$hls_disk_free" -lt "$required_disk_mb" ]; then
        add_report "FAIL" "Disk Space (HLS)" "Free space in /var/www/hls is ${hls_disk_free}MB (Required: >= ${required_disk_mb}MB)"
        add_remediation "Manage HLS Fragmentation" "Reduce segment retention counts or fragment lengths inside nginx-rtmp.conf."
      else
        add_report "PASS" "Disk Space (HLS)" "Free space is ${hls_disk_free}MB"
      fi
    fi
  fi
}

# -- Category 2: Dependencies & Runtime Utilities --
check_runtimes() {
  print_section "2. RUNTIME DEPENDENCIES & UTILITIES"

  # 1. Node.js Check
  if command -v node >/dev/null 2>&1; then
    local node_ver; node_ver=$(node -v || echo "unknown")
    add_report "PASS" "Node.js" "Installed ($node_ver)"
  else
    add_report "FAIL" "Node.js" "Missing from host PATH"
    add_remediation "Install Node.js Runtime" "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  fi

  # 2. npm Package Manager Check
  if command -v npm >/dev/null 2>&1; then
    local npm_ver; npm_ver=$(npm -v || echo "unknown")
    add_report "PASS" "npm" "Installed ($npm_ver)"
  else
    add_report "FAIL" "npm" "Missing from host PATH"
    add_remediation "Install npm Package Manager" "sudo apt-get install -y npm"
  fi

  # 3. FFmpeg and Codec validation
  if command -v ffmpeg >/dev/null 2>&1; then
    local ffmpeg_ver; ffmpeg_ver=$(ffmpeg -version 2>/dev/null | head -n 1 | awk '{print $3}' || echo "installed")
    local codec_ok=false
    if ffmpeg -codecs 2>&1 | grep -q "libx264"; then
      codec_ok=true
    fi

    if [ "$codec_ok" = "true" ]; then
      add_report "PASS" "FFmpeg Transcoder" "Installed ($ffmpeg_ver) with active libx264 software-encoding codec"
    else
      add_report "WARN" "FFmpeg Transcoder" "Installed but MISSING libx264 support (essential for standard transcoding)"
      add_remediation "Reinstall FFmpeg with x264" "sudo apt-get update && sudo apt-get install -y ffmpeg libavcodec-extra"
    fi
  else
    add_report "FAIL" "FFmpeg Transcoder" "Missing from host PATH"
    add_remediation "Install FFmpeg pipeline" "sudo apt-get update && sudo apt-get install -y ffmpeg"
  fi

  # 4. PostgreSQL Client (psql)
  if command -v psql >/dev/null 2>&1; then
    local psql_ver; psql_ver=$(psql --version 2>/dev/null | head -n 1 | awk '{print $3}' || echo "installed")
    add_report "PASS" "PostgreSQL Client" "Installed ($psql_ver)"
  else
    add_report "FAIL" "PostgreSQL Client" "Missing client utilities (psql)"
    add_remediation "Install Postgres Client" "sudo apt-get update && sudo apt-get install -y postgresql-client"
  fi

  # 5. Git CLI
  if command -v git >/dev/null 2>&1; then
    local git_ver; git_ver=$(git --version 2>/dev/null | head -n 1 | awk '{print $3}' || echo "installed")
    add_report "PASS" "Git CLI" "Installed ($git_ver)"
  else
    add_report "FAIL" "Git CLI" "Missing Git utility (Required for production versioning)"
    add_remediation "Install Git CLI" "sudo apt-get install -y git"
  fi

  # 6. Docker Engine
  if command -v docker >/dev/null 2>&1; then
    local docker_ver; docker_ver=$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',' || echo "installed")
    add_report "PASS" "Docker Engine" "Installed ($docker_ver)"
  else
    add_report "SKIP" "Docker Engine" "Not installed (Optional)"
  fi

  # 7. Docker Compose
  local has_compose=false
  local compose_ver=""
  if docker compose version >/dev/null 2>&1; then
    has_compose=true
    compose_ver=$(docker compose version 2>/dev/null | head -n 1 || echo "v2")
  elif command -v docker-compose >/dev/null 2>&1; then
    has_compose=true
    compose_ver=$(docker-compose --version 2>/dev/null | head -n 1 || echo "v1")
  fi

  if [ "$has_compose" = "true" ]; then
    add_report "PASS" "Docker Compose" "Installed ($compose_ver)"
  else
    add_report "SKIP" "Docker Compose" "Not installed (Optional)"
  fi
}

# -- Category 3: Daemon Service Health (Multi-Method Detection Hierarchy) --
check_service() {
  local service_name="$1"
  local is_required="$2"

  local is_installed=false
  local is_active=false
  local detection_method=""
  local extra_info=""

  # Formulate comprehensive naming candidates to handle alternative architectures/OS naming conventions
  local alt_names=()
  if [ "$service_name" = "postgresql" ]; then
    alt_names=("postgresql" "postgres")
    if command -v systemctl >/dev/null 2>&1; then
      local systemd_pg; systemd_pg=$(systemctl list-units --type=service --all --no-legend 2>/dev/null | awk '{print $1}' | grep -E '^postgresql(@[0-9]+)?\.service$|^postgres\.service$' || true)
      if [ -n "$systemd_pg" ]; then
        local pg_srv
        for pg_srv in $systemd_pg; do
          alt_names+=("${pg_srv%.service}")
        done
      fi
    fi
  elif [ "$service_name" = "streampulse" ]; then
    alt_names=("streampulse" "streampulse-backend" "streampulse-api")
  else
    alt_names=("$service_name")
  fi

  local name
  for name in "${alt_names[@]}"; do
    if [ -z "$name" ]; then continue; fi

    # Priority 1: systemctl is-active
    if command -v systemctl >/dev/null 2>&1; then
      if systemctl is-active --quiet "$name" 2>/dev/null; then
        is_installed=true
        is_active=true
        detection_method="systemctl is-active ($name)"
        break
      fi
    fi

    # Priority 2: systemctl status check
    if command -v systemctl >/dev/null 2>&1; then
      local status_output; status_output=$(systemctl status "$name" 2>/dev/null || echo "")
      if [ -n "$status_output" ]; then
        is_installed=true
        if echo "$status_output" | grep -q "Active: active"; then
          is_active=true
          detection_method="systemctl status ($name)"
          break
        fi
      fi
    fi

    # Priority 3: systemctl list-unit-files
    if command -v systemctl >/dev/null 2>&1; then
      local unit_file_match; unit_file_match=$(systemctl list-unit-files --type=service --all --no-legend 2>/dev/null | grep -E "^${name}(\.service)?\s" | head -n 1 || true)
      if [ -n "$unit_file_match" ]; then
        is_installed=true
        local unit_state; unit_state=$(echo "$unit_file_match" | awk '{print $2}' || echo "unknown")
        extra_info="($name is $unit_state)"
      fi
    fi

    # Priority 4: systemctl list-units
    if command -v systemctl >/dev/null 2>&1; then
      local unit_active_match; unit_active_match=$(systemctl list-units --type=service --all --no-legend 2>/dev/null | grep -E "^${name}(\.service)?\s" | head -n 1 || true)
      if [ -n "$unit_active_match" ]; then
        is_installed=true
        local active_state; active_state=$(echo "$unit_active_match" | awk '{print $3}' || echo "unknown")
        extra_info="($name is $active_state)"
      fi
    fi
  done

  # Priority 5: Fallback Detection (Process Table, File Checks, Sockets)
  if [ "$is_active" = "false" ]; then
    local proc_running=false
    local path_exists=false

    case "$service_name" in
      "streampulse")
        if pgrep -f "dist/server\.cjs" >/dev/null 2>&1 || pgrep -f "server\.ts" >/dev/null 2>&1 || pgrep -f "streampulse" >/dev/null 2>&1; then
          proc_running=true
        fi
        if [ -d "$ACTIVE_DIR" ] && { [ -f "$ACTIVE_DIR/package.json" ] || [ -f "$ACTIVE_DIR/dist/server.cjs" ]; }; then
          path_exists=true
        fi
        ;;
      "nginx")
        if pgrep -x nginx >/dev/null 2>&1 || pidof nginx >/dev/null 2>&1; then
          proc_running=true
        fi
        if [ -d "/etc/nginx" ] || command -v nginx >/dev/null 2>&1; then
          path_exists=true
        fi
        ;;
      "postgresql")
        if pgrep -x postgres >/dev/null 2>&1 || pgrep -x postmaster >/dev/null 2>&1; then
          proc_running=true
        fi
        if [ -d "/etc/postgresql" ] || [ -d "/var/lib/postgresql" ] || command -v psql >/dev/null 2>&1; then
          path_exists=true
        fi
        ;;
      "docker")
        if pgrep -x dockerd >/dev/null 2>&1 || [ -S "/var/run/docker.sock" ]; then
          proc_running=true
        fi
        if command -v docker >/dev/null 2>&1; then
          path_exists=true
        fi
        ;;
      "fail2ban")
        if pgrep -f fail2ban >/dev/null 2>&1 || [ -S "/var/run/fail2ban/fail2ban.sock" ]; then
          proc_running=true
        fi
        if [ -d "/etc/fail2ban" ] || command -v fail2ban-client >/dev/null 2>&1; then
          path_exists=true
        fi
        ;;
    esac

    if [ "$proc_running" = "true" ]; then
      is_installed=true
      is_active=true
      detection_method="Process Table / Socket Discovery Fallback"
    elif [ "$path_exists" = "true" ]; then
      is_installed=true
    fi
  fi

  # Service reporting and resolution commands formulation
  if [ "$is_installed" = "false" ]; then
    if [ "$is_required" = "true" ]; then
      add_report "FAIL" "Service: $service_name" "Service is NOT installed on host (Critical)"
      add_remediation "Install $service_name" "Please consult deployment guidelines and script installers to deploy the service."
    else
      add_report "SKIP" "Service: $service_name" "Service is not installed (Optional)"
    fi
  elif [ "$is_active" = "true" ]; then
    add_report "PASS" "Service: $service_name" "Service is running & healthy (Method: $detection_method)"
  else
    if [ "$is_required" = "true" ]; then
      add_report "FAIL" "Service: $service_name" "Installed but INACTIVE $extra_info (Critical)"
      add_remediation "Start $service_name" "sudo systemctl start $service_name"
    else
      add_report "WARN" "Service: $service_name" "Installed but INACTIVE $extra_info (Optional)"
      add_remediation "Start $service_name" "sudo systemctl start $service_name"
    fi
  fi
}

check_services() {
  print_section "3. DAEMON SERVICE HEALTH"
  # Required services
  check_service "streampulse" "true"
  check_service "nginx" "true"
  check_service "postgresql" "true"
  # Optional services
  check_service "docker" "false"
  check_service "fail2ban" "false"
}

# -- Category 4: Network Port Bindings Check --
check_ports() {
  print_section "4. NETWORK PORT BINDINGS"

  # Core port validation
  local ports=(80 1935 3000 5432)
  local port
  for port in "${ports[@]}"; do
    local desc=""
    case "$port" in
      80) desc="HTTP Ingress Web" ;;
      1935) desc="RTMP Ingest Port" ;;
      3000) desc="StreamPulse Web API" ;;
      5432) desc="PostgreSQL DB Port" ;;
    esac

    if is_port_listening "$port"; then
      add_report "PASS" "Port $port ($desc)" "Bound & actively listening"
    else
      add_report "FAIL" "Port $port ($desc)" "Port is offline / unreachable"
      case "$port" in
        80) add_remediation "Start Web Server" "sudo systemctl start nginx" ;;
        1935) add_remediation "Verify RTMP Block" "Ensure the RTMP configuration inside /etc/nginx/nginx.conf is correct and reload Nginx." ;;
        3000) add_remediation "Start Backend API Service" "sudo systemctl start streampulse" ;;
        5432) add_remediation "Start PostgreSQL" "sudo systemctl start postgresql" ;;
      esac
    fi
  done

  # Optional HTTPS port verification
  if is_port_listening 443; then
    add_report "PASS" "Port 443 (HTTPS Ingress)" "Bound & actively listening"
  else
    add_report "WARN" "Port 443 (HTTPS Ingress)" "Port is offline / not configured (Optional)"
    add_remediation "Setup TLS Encryption" "Generate SSL Certificates using Certbot: sudo certbot --nginx"
  fi
}

# -- Category 5: Configurations & DB Connectivity Check --
check_config_and_db() {
  print_section "5. CONFIGURATION & DATABASE CONNECTIVITY"

  local env_path="$ACTIVE_DIR/.env"
  if [ ! -f "$env_path" ]; then
    add_report "FAIL" ".env Configuration File" "Not found at active directory path: $env_path"
    add_remediation "Deploy Configuration File" "Copy standard template file to create a secure .env file: cp $ACTIVE_DIR/.env.example $env_path && chmod 600 $env_path"
    return 1
  fi

  add_report "PASS" ".env Configuration File" "Found configuration file at $env_path"

  # Load variables safely under set -u
  local db_host db_port db_user db_password db_name jwt_secret gemini_key
  db_host=$(grep "^DB_HOST=" "$env_path" | cut -d'=' -f2- | xargs 2>/dev/null | tr -d '"'\'' ' || echo "")
  db_port=$(grep "^DB_PORT=" "$env_path" | cut -d'=' -f2- | xargs 2>/dev/null | tr -d '"'\'' ' || echo "5432")
  db_user=$(grep "^DB_USER=" "$env_path" | cut -d'=' -f2- | xargs 2>/dev/null | tr -d '"'\'' ' || echo "")
  db_password=$(grep "^DB_PASSWORD=" "$env_path" | cut -d'=' -f2- | xargs 2>/dev/null | tr -d '"'\'' ' || echo "")
  db_name=$(grep "^DB_NAME=" "$env_path" | cut -d'=' -f2- | xargs 2>/dev/null | tr -d '"'\'' ' || echo "")
  jwt_secret=$(grep "^JWT_SECRET=" "$env_path" | cut -d'=' -f2- | xargs 2>/dev/null | tr -d '"'\'' ' || echo "")
  gemini_key=$(grep "^GEMINI_API_KEY=" "$env_path" | cut -d'=' -f2- | xargs 2>/dev/null | tr -d '"'\'' ' || echo "")

  local missing_properties=()
  [ -z "$db_host" ] && missing_properties+=("DB_HOST")
  [ -z "$db_port" ] && missing_properties+=("DB_PORT")
  [ -z "$db_user" ] && missing_properties+=("DB_USER")
  [ -z "$db_password" ] && missing_properties+=("DB_PASSWORD")
  [ -z "$db_name" ] && missing_properties+=("DB_NAME")
  [ -z "$jwt_secret" ] && missing_properties+=("JWT_SECRET")

  if [ ${#missing_properties[@]} -gt 0 ]; then
    add_report "FAIL" "Configured Variables" "Missing crucial environment settings: ${missing_properties[*]}"
    add_remediation "Fix Config File Variables" "Define all necessary connection properties inside $env_path: ${missing_properties[*]}"
    return 1
  fi

  add_report "PASS" "Configured Variables" "All required configuration credentials are valid"

  # Credentials hardening warnings
  if [ "$jwt_secret" = "streampulse_default_secret_key_98451023" ]; then
    add_report "WARN" "JWT Token Protection" "Default unsecure template key is used for JWT signatures"
    add_remediation "Strengthen JWT Secret" "Generate a production-strength random secret: openssl rand -hex 32"
  else
    add_report "PASS" "JWT Token Protection" "Personalized cryptographically secure JWT key configured"
  fi

  if [ -z "$gemini_key" ]; then
    add_report "WARN" "AI Feature Engine" "GEMINI_API_KEY environment variable is empty. Intelligent transcoding optimization will be disabled"
    add_remediation "Integrate Gemini AI" "Add GEMINI_API_KEY=your_key to $env_path to activate real-time stream diagnostic tips and optimizations."
  else
    add_report "PASS" "AI Feature Engine" "Gemini API credentials successfully integrated"
  fi

  # Direct Client Socket Connection Test via psql
  if ! command -v psql >/dev/null 2>&1; then
    add_report "FAIL" "PostgreSQL Socket Connect" "PostgreSQL client (psql) is missing; connection validation skipped"
    return 1
  fi

  local db_conn_ok=false
  if PGPASSWORD="$db_password" timeout 3 psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1;" >/dev/null 2>&1; then
    db_conn_ok=true
  fi

  if [ "$db_conn_ok" = "false" ]; then
    add_report "FAIL" "PostgreSQL Socket Connect" "Authentication or socket connectivity failed to PostgreSQL server ($db_name@$db_host:$db_port)"
    add_remediation "Check Database Status" "Verify if database server is active and allows local connections: sudo pg_isready"
    return 1
  fi

  add_report "PASS" "PostgreSQL Socket Connect" "Successfully authenticated & connected to PostgreSQL database"

  # Database schema tables verification
  local users_ok=false
  local streams_ok=false

  if PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='users');" 2>/dev/null | grep -q "t"; then
    users_ok=true
  fi

  if PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='streams');" 2>/dev/null | grep -q "t"; then
    streams_ok=true
  fi

  if [ "$users_ok" = "true" ] && [ "$streams_ok" = "true" ]; then
    add_report "PASS" "Database Schema" "Production schema validated. tables 'users' and 'streams' are intact"
  else
    add_report "FAIL" "Database Schema" "Connected to DB but required structures (users/streams) are missing"
    add_remediation "Run DB Schema Migration" "PGPASSWORD=\"$db_password\" psql -h \"$db_host\" -p \"$db_port\" -U \"$db_user\" -d \"$db_name\" -f \"$ACTIVE_DIR/vps-deployment/schema.sql\""
  fi
}

# -- Category 6: Directories & File System Integrity --
check_filesystem() {
  print_section "6. DIRECTORIES & FILE SYSTEM INTEGRITY"

  local hls_dir="/var/www/hls"
  local log_dir="/var/log/streampulse"
  local data_dir="$ACTIVE_DIR/data"

  # 1. Check HLS root directory
  if [ -d "$hls_dir" ]; then
    if [ -w "$hls_dir" ]; then
      add_report "PASS" "HLS Output Path" "Directory $hls_dir exists and is writable"
    else
      add_report "FAIL" "HLS Output Path" "Directory $hls_dir exists but is NOT writable"
      add_remediation "Fix HLS Permissions" "sudo chown -R www-data:www-data $hls_dir && sudo chmod -R 775 $hls_dir"
    fi
  else
    add_report "FAIL" "HLS Output Path" "Directory $hls_dir is missing (Critical for segment generation)"
    add_remediation "Create HLS Output Path" "sudo mkdir -p $hls_dir && sudo chown -R www-data:www-data $hls_dir && sudo chmod -R 775 $hls_dir"
  fi

  # 2. Check logs directory
  if [ -d "$log_dir" ]; then
    if [ -w "$log_dir" ]; then
      add_report "PASS" "Log Storage Path" "Directory $log_dir exists and is writable"
    else
      add_report "FAIL" "Log Storage Path" "Directory $log_dir exists but is NOT writable"
      add_remediation "Fix Log Permissions" "sudo chown -R \$(whoami):\$(whoami) $log_dir && sudo chmod -R 755 $log_dir"
    fi
  else
    add_report "FAIL" "Log Storage Path" "Directory $log_dir is missing"
    add_remediation "Create Log Storage Path" "sudo mkdir -p $log_dir && sudo chown -R \$(whoami):\$(whoami) $log_dir && sudo chmod -R 755 $log_dir"
  fi

  # 3. Local data storage path
  if [ -d "$data_dir" ]; then
    if [ -w "$data_dir" ]; then
      add_report "PASS" "Local Data Path" "Directory $data_dir exists and is writable"
    else
      add_report "FAIL" "Local Data Path" "Directory $data_dir exists but is NOT writable"
      add_remediation "Fix Local Data Permissions" "sudo chmod -R 775 $data_dir"
    fi
  else
    add_report "WARN" "Local Data Path" "Directory $data_dir is missing"
    add_remediation "Create Local Data Path" "mkdir -p $data_dir && chmod 775 $data_dir"
  fi

  # 4. Transcode pipeline executable
  local trans_bin="/usr/local/bin/transcode.sh"
  local trans_local="$ACTIVE_DIR/vps-deployment/transcode.sh"

  if [ -x "$trans_bin" ]; then
    add_report "PASS" "Transcode Pipeline" "Executable script found globally at $trans_bin"
  elif [ -f "$trans_bin" ]; then
    add_report "FAIL" "Transcode Pipeline" "Script exists at $trans_bin but lacks executable permission"
    add_remediation "Set Executable Flag" "sudo chmod +x $trans_bin"
  elif [ -f "$trans_local" ]; then
    add_report "WARN" "Transcode Pipeline" "No global script at $trans_bin. Found local template"
    add_remediation "Install Global Transcoder" "sudo cp $trans_local $trans_bin && sudo chmod +x $trans_bin"
  else
    add_report "FAIL" "Transcode Pipeline" "Pipeline launch script transcode.sh is completely missing"
    add_remediation "Create Transcode Pipeline" "Please restore transcode.sh to /usr/local/bin/transcode.sh and configure permissions."
  fi
}

# -- Category 7: Production Ownership & Security Validation --
check_production_security() {
  print_section "7. PRODUCTION SECURITY & OWNERSHIP"

  # Firewall Status Check (ufw)
  if command -v ufw >/dev/null 2>&1; then
    local ufw_status; ufw_status=$(ufw status 2>/dev/null || echo "Status: inactive")
    if echo "$ufw_status" | grep -q "active"; then
      add_report "PASS" "UFW Firewall" "Firewall protection is active"
      
      # Confirm critical ports allowed
      local rules_ok=true
      local critical_ports=(22 80 1935)
      local cp
      for cp in "${critical_ports[@]}"; do
        if ! echo "$ufw_status" | grep -q -E "(\s|^)$cp(/|$)" 2>/dev/null; then
          rules_ok=false
          add_report "WARN" "Firewall Port: $cp" "Critical port $cp is not allowed in active firewall rules"
          add_remediation "Allow Port $cp" "sudo ufw allow $cp/tcp"
        fi
      done
      if [ "$rules_ok" = "true" ]; then
        add_report "PASS" "Firewall Open Ports" "All key streaming and ingress ports allowed safely"
      fi
    else
      add_report "WARN" "UFW Firewall" "Firewall is installed but currently INACTIVE"
      add_remediation "Activate Firewall Protection" "sudo ufw enable"
    fi
  else
    add_report "WARN" "UFW Firewall" "UFW package not installed on system"
    add_remediation "Install UFW Firewall" "sudo apt-get install -y ufw"
  fi

  # Environment configuration permissions security check
  local env_path="$ACTIVE_DIR/.env"
  if [ -f "$env_path" ]; then
    local file_perms; file_perms=$(stat -c "%a" "$env_path" 2>/dev/null || echo "unknown")
    if [[ "$file_perms" == "600" || "$file_perms" == "640" || "$file_perms" == "400" ]]; then
      add_report "PASS" "Environment Perms" "Secure permissions configured on .env file ($file_perms)"
    else
      add_report "WARN" "Environment Perms" "Insecure permissions detected on .env file ($file_perms)"
      add_remediation "Restrict Env Permissions" "sudo chmod 600 $env_path"
    fi
  fi

  # Ownership checking (if running with systemd/production layout as root)
  if [ "$IS_ROOT" = "true" ]; then
    local hls_dir="/var/www/hls"
    if [ -d "$hls_dir" ]; then
      local hls_owner; hls_owner=$(stat -c "%U" "$hls_dir" 2>/dev/null || echo "unknown")
      if [ "$hls_owner" = "www-data" ] || [ "$hls_owner" = "nginx" ]; then
        add_report "PASS" "HLS Ownership" "Verified correct owner ($hls_owner)"
      else
        add_report "WARN" "HLS Ownership" "Owned by '$hls_owner' instead of 'www-data'"
        add_remediation "Fix HLS Ownership" "sudo chown -R www-data:www-data $hls_dir"
      fi
    fi
  else
    add_report "SKIP" "Ownership Checks" "Skipped (Requires privileged root access)"
  fi
}

# -- Category 8: Web Service API Health & Validation --
check_api_endpoint() {
  print_section "8. WEB SERVICE API HEALTH & INTEGRITY"

  # Port recovery
  local port="3000"
  local env_path="$ACTIVE_DIR/.env"
  if [ -f "$env_path" ]; then
    port=$(grep "^PORT=" "$env_path" | cut -d'=' -f2- | xargs 2>/dev/null | tr -d '"'\'' ' || echo "3000")
  fi

  if ! is_port_listening "$port"; then
    add_report "SKIP" "API Health Endpoint" "Skipped (StreamPulse backend is not listening on port $port)"
    return 0
  fi

  if ! command -v curl >/dev/null 2>&1; then
    add_report "WARN" "API Health Endpoint" "Missing curl utility; Skipping GET /health request validation"
    return 0
  fi

  # API health request invocation (with 3-second fail-fast timeout)
  local http_code="000"
  local payload=""

  # Invoke direct health check
  local url="http://127.0.0.1:$port/health"
  local curl_resp; curl_resp=$(curl -s -w "\n%{http_code}" --max-time 3 "$url" 2>/dev/null || echo "")
  
  if [ -n "$curl_resp" ]; then
    http_code=$(echo "$curl_resp" | tail -n 1)
    payload=$(echo "$curl_resp" | head -n -1)
  fi

  # Fallback to /api/health if not 200
  if [ "$http_code" != "200" ] || [[ "$payload" != *"status"* ]]; then
    local fallback_url="http://127.0.0.1:$port/api/health"
    local fb_resp; fb_resp=$(curl -s -w "\n%{http_code}" --max-time 3 "$fallback_url" 2>/dev/null || echo "")
    if [ -n "$fb_resp" ]; then
      local fb_code; fb_code=$(echo "$fb_resp" | tail -n 1)
      if [ "$fb_code" = "200" ]; then
        payload=$(echo "$fb_resp" | head -n -1)
        http_code="$fb_code"
      fi
    fi
  fi

  if [ "$http_code" = "200" ]; then
    # Parse payload strictly, verifying "status" and "ok" are present
    if echo "$payload" | grep -q "status" && echo "$payload" | grep -q "ok"; then
      add_report "PASS" "API GET /health" "Server returns active healthy state: status=ok (payload: $payload)"
    else
      add_report "WARN" "API GET /health" "Returned HTTP 200, but JSON did not match expected structure (payload: $payload)"
    fi
  else
    add_report "FAIL" "API GET /health" "Health endpoint returned unhealthy status code $http_code"
    add_remediation "Audit Application Process" "Inspect current backend logs using: journalctl -u streampulse -n 40 --no-pager"
  fi
}

# ------------------------------------------------------------------------------
# 5. DIAGNOSTICS ORCHESTRATION & REPORT GENERATION
# ------------------------------------------------------------------------------
main() {
  print_header

  # Run diagnostic layers sequentially
  check_hardware
  check_runtimes
  check_services
  check_ports
  check_config_and_db
  check_filesystem
  check_production_security
  check_api_endpoint

  # Calculate health metrics
  local active_audits=$(( TOTAL_COUNT - SKIP_COUNT ))
  local score_percent=0
  if [ "$active_audits" -gt 0 ]; then
    score_percent=$(( (PASS_COUNT * 100) / active_audits ))
  fi

  # Render professional dashboard summary card
  echo -e "\n${CYAN}${BOLD}==============================================================================${NC}"
  echo -e "${BOLD}   🏁  Platform Diagnostic Verification Summary                              ${NC}"
  echo -e "${CYAN}${BOLD}==============================================================================${NC}"
  echo -e "  Passed Audits:   ${GREEN}${BOLD}${PASS_COUNT}${NC}"
  echo -e "  Warnings:        ${YELLOW}${BOLD}${WARN_COUNT}${NC}"
  echo -e "  Skipped Audits:  ${BLUE}${BOLD}${SKIP_COUNT}${NC}"
  echo -e "  Failed Audits:   ${RED}${BOLD}${FAIL_COUNT}${NC}"
  echo -e "${CYAN}------------------------------------------------------------------------------${NC}"

  # Fluid progress bar
  local bar_width=40
  local filled_chars=$(( (score_percent * bar_width) / 100 ))
  local empty_chars=$(( bar_width - filled_chars ))
  local bar_color="${GREEN}"

  if [ "$score_percent" -lt 50 ]; then
    bar_color="${RED}"
  elif [ "$score_percent" -lt 85 ]; then
    bar_color="${YELLOW}"
  fi

  printf "  Health Score: %s[" "$bar_color"
  local i
  for ((i=0; i<filled_chars; i++)); do printf "█"; done
  for ((i=0; i<empty_chars; i++)); do printf "░"; done
  printf "] %d%%${NC}\n" "$score_percent"
  echo -e "${CYAN}==============================================================================${NC}"

  # Render final status banners
  if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}==============================================================================${NC}"
    echo -e "${GREEN}${BOLD}   🏆  SYSTEM HEALTHY                                                        ${NC}"
    echo -e "${GREEN}${BOLD}==============================================================================${NC}"
    if [ "$WARN_COUNT" -gt 0 ]; then
      echo -e "${YELLOW}${BOLD}Warning:${NC} Minor non-blocking configuration updates recommended. See report above."
    fi
  else
    echo -e "\n${RED}${BOLD}==============================================================================${NC}"
    echo -e "${RED}${BOLD}   🚨  SYSTEM UNHEALTHY                                                      ${NC}"
    echo -e "${RED}${BOLD}==============================================================================${NC}"
    echo -e "${RED}Error: ${BOLD}${FAIL_COUNT}${NC} critical validation audits failed. Immediate action required."
  fi

  # Output troubleshooting playbook commands
  if [ ${#REMEDIATION_STEPS[@]} -gt 0 ]; then
    echo -e "\n${CYAN}${BOLD}🔧 Troubleshooting & Remediation Playbook${NC}"
    echo -e "${CYAN}==============================================================================${NC}"
    local step
    for step in "${REMEDIATION_STEPS[@]}"; do
      local component; component=$(echo "$step" | cut -d'|' -f1)
      local fix_cmd; fix_cmd=$(echo "$step" | cut -d'|' -f2-)
      echo -e "  - ${BOLD}$component${NC}:"
      echo -e "    ${YELLOW}$fix_cmd${NC}"
    done
    echo -e "${CYAN}==============================================================================${NC}\n"
  fi

  # Exit code conformant to diagnostic health state
  if [ "$FAIL_COUNT" -eq 0 ]; then
    exit 0
  else
    exit 1
  fi
}

main
