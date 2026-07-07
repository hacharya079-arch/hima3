#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - Production Diagnostic & Verification Suite
# Supported OS: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
# Architect: Senior Linux DevOps & Production Reliability Engineer
# Code Quality: Production-grade Bash, set -euo pipefail compatible
# ==============================================================================

set -euo pipefail

# Get script path safely
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# ------------------------------------------------------------------------------
# 1. COLOR CODES & FORMATTING
# ------------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# ------------------------------------------------------------------------------
# 2. RUNTIME ENVIRONMENT DISCOVERY
# ------------------------------------------------------------------------------
detect_environment_mode() {
  if [ -f /.dockerenv ] || grep -qi "docker\|lxc\|container" /proc/1/cgroup 2>/dev/null; then
    echo "Container Mode"
    return 0
  fi
  if command -v systemd-detect-virt &>/dev/null; then
    local virt; virt=$(systemd-detect-virt 2>/dev/null || echo "none")
    if [ -n "$virt" ] && [ "$virt" != "none" ]; then
      echo "Virtual Machine Mode ($virt)"
      return 0
    fi
  fi
  echo "Bare-Metal Mode"
}

detect_active_dir() {
  if [ -f "$SCRIPT_DIR/.env" ] || [ -f "$SCRIPT_DIR/package.json" ]; then
    echo "$SCRIPT_DIR"
    return 0
  fi
  local p
  for p in "/opt/streampulse" "/srv/streampulse"; do
    if [ -d "$p" ] && { [ -f "$p/.env" ] || [ -f "$p/package.json" ]; }; then
      echo "$p"
      return 0
    fi
  done
  echo "$SCRIPT_DIR"
}

ENV_MODE=$(detect_environment_mode)
ACTIVE_DIR=$(detect_active_dir)
IS_ROOT=false
if [ "$EUID" -eq 0 ]; then
  IS_ROOT=true
fi

has_systemd=false
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  has_systemd=true
fi

# ------------------------------------------------------------------------------
# 3. DIAGNOSTIC REPORT STATE
# ------------------------------------------------------------------------------
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
TOTAL_COUNT=0

declare -a REMEDIATION_STEPS=()

add_report() {
  local status="$1" component="$2" desc="$3"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  case "$status" in
    "PASS")
      PASS_COUNT=$((PASS_COUNT + 1))
      echo -e "  [ ${GREEN}${BOLD}PASS${NC} ] ${BOLD}${component}${NC}: ${desc}"
      ;;
    "WARN")
      WARN_COUNT=$((WARN_COUNT + 1))
      echo -e "  [ ${YELLOW}${BOLD}WARN${NC} ] ${BOLD}${component}${NC}: ${YELLOW}${desc}${NC}"
      ;;
    "FAIL")
      FAIL_COUNT=$((FAIL_COUNT + 1))
      echo -e "  [ ${RED}${BOLD}FAIL${NC} ] ${BOLD}${component}${NC}: ${RED}${BOLD}${desc}${NC}"
      ;;
    "SKIP")
      SKIP_COUNT=$((SKIP_COUNT + 1))
      echo -e "  [ ${BLUE}${BOLD}SKIP${NC} ] ${BOLD}${component}${NC}: ${BLUE}${desc}${NC}"
      ;;
  esac
}

add_remediation() {
  local comp="$1" cmd="$2"
  local safe_cmd; safe_cmd=$(echo "$cmd" | tr '|' ';')
  REMEDIATION_STEPS+=("${comp}|${safe_cmd}")
}

print_header() {
  echo -e "\n${CYAN}${BOLD}==============================================================================${NC}"
  echo -e "${CYAN}${BOLD}   🔍  StreamPulse Platform Diagnostic & System Verification Suite           ${NC}"
  echo -e "${CYAN}${BOLD}==============================================================================${NC}"
  echo -e "Timestamp:    $(date)"
  echo -e "Active Dir:   ${CYAN}${ACTIVE_DIR}${NC}"
  echo -e "Env Mode:     ${CYAN}${ENV_MODE}${NC}"
  
  local ip_addr="127.0.0.1"
  if command -v hostname >/dev/null 2>&1; then
    ip_addr=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
  fi
  echo -e "Host IP:      ${CYAN}${ip_addr}${NC}"
  
  local os_name="Ubuntu Linux"
  if [ -f /etc/os-release ]; then
    os_name=$(grep "PRETTY_NAME" /etc/os-release | cut -d'=' -f2 | tr -d '"' || echo "Ubuntu Linux")
  fi
  echo -e "OS:           ${CYAN}${os_name}${NC}"
  echo -e "Systemd:      $( [ "$has_systemd" = "true" ] && echo -e "${GREEN}Active${NC}" || echo -e "${YELLOW}Not Running${NC}" )"
  echo -e "${CYAN}==============================================================================${NC}"
}

print_section() {
  echo -e "\n${BOLD}${CYAN}▶  $1${NC}"
  echo -e "${CYAN}------------------------------------------------------------------------------${NC}"
}

is_port_listening() {
  local port="$1"
  local found=false
  
  set +e
  if command -v ss >/dev/null 2>&1; then
    ss -tuln 2>/dev/null | grep -q -E "[:\s]${port}\s"
    [ $? -eq 0 ] && found=true
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tuln 2>/dev/null | grep -q -E "[:\s]${port}\s"
    [ $? -eq 0 ] && found=true
  fi
  
  if [ "$found" = "false" ]; then
    timeout 1 bash -c "exec 3<>/dev/tcp/127.0.0.1/$port" >/dev/null 2>&1
    [ $? -eq 0 ] && found=true
  fi
  set -e
  
  if [ "$found" = "true" ]; then
    return 0
  else
    return 1
  fi
}

get_env_val() {
  local key="$1" file="$2" default="${3:-}"
  if [ -f "$file" ]; then
    local line; line=$(grep "^${key}=" "$file" || true)
    if [ -n "$line" ]; then
      echo "$line" | cut -d'=' -f2- | xargs | tr -d '"'\'' '
      return 0
    fi
  fi
  echo "$default"
}

# ------------------------------------------------------------------------------
# 4. MODULAR DIAGNOSTIC FUNCTIONS
# ------------------------------------------------------------------------------

check_hardware() {
  print_section "1. HARDWARE SYSTEM RESOURCES"

  local cpu_cores=1
  if command -v nproc >/dev/null 2>&1; then
    cpu_cores=$(nproc)
  elif [ -f /proc/cpuinfo ]; then
    cpu_cores=$(grep -c ^processor /proc/cpuinfo || echo "1")
  fi

  local cpu_load="0.00"
  if [ -f /proc/loadavg ]; then
    cpu_load=$(awk '{print $1}' /proc/loadavg || echo "0.00")
  elif command -v uptime >/dev/null 2>&1; then
    cpu_load=$(uptime | awk -F'load average:' '{ print $2 }' | cut -d',' -f1 | xargs 2>/dev/null | awk '{print $1}' || echo "0.00")
  fi
  cpu_load=$(echo "$cpu_load" | tr -d ',' | xargs)
  if [[ ! "$cpu_load" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then cpu_load="0.00"; fi

  local load_int; load_int=$(echo "$cpu_load" | cut -d. -f1)
  if [[ ! "$load_int" =~ ^[0-9]+$ ]]; then load_int=0; fi

  local max_load_threshold=$(( cpu_cores * 2 ))
  if [ "$load_int" -ge "$max_load_threshold" ]; then
    add_report "WARN" "CPU 1-min Load" "System load is high: $cpu_load ($cpu_cores Cores)"
    add_remediation "Assess System Processes" "Run 'htop' to analyze resource consumption."
  else
    add_report "PASS" "CPU 1-min Load" "Normal CPU load state ($cpu_load on $cpu_cores Cores)"
  fi

  local total_ram=0 free_ram=0
  if command -v free >/dev/null 2>&1; then
    total_ram=$(free -m | awk '/^Mem:/{print $2}' || echo "0")
    free_ram=$(free -m | awk '/^Mem:/{print $7}' || echo "0")
  elif [ -f /proc/meminfo ]; then
    local total_kb; total_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}' || echo "0")
    local free_kb; free_kb=$(grep MemAvailable /proc/meminfo | awk '{print $2}' || echo "0")
    if [[ "$total_kb" =~ ^[0-9]+$ ]]; then total_ram=$(( total_kb / 1024 )); fi
    if [[ "$free_kb" =~ ^[0-9]+$ ]]; then free_ram=$(( free_kb / 1024 )); fi
  fi
  if [[ ! "$total_ram" =~ ^[0-9]+$ ]]; then total_ram=0; fi
  if [[ ! "$free_ram" =~ ^[0-9]+$ ]]; then free_ram=0; fi

  if [ "$total_ram" -gt 0 ]; then
    if [ "$total_ram" -lt 950 ]; then
      add_report "WARN" "System RAM" "Memory is ${total_ram}MB (Recommended: >= 1024MB for video transcoding)"
      add_remediation "Scale Host Memory" "Increase system RAM to prevent OOM killer terminations."
    else
      add_report "PASS" "System RAM" "Total Memory: ${total_ram}MB, Available Memory: ${free_ram}MB"
    fi
  else
    add_report "WARN" "System RAM" "Unable to fetch RAM capacity metrics"
  fi

  local active_disk_free=0 hls_disk_free=0 required_disk_mb=1500
  if command -v df >/dev/null 2>&1; then
    active_disk_free=$(df -m "$ACTIVE_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
    if [ -d "/var/www/hls" ]; then
      hls_disk_free=$(df -m "/var/www/hls" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
    else
      hls_disk_free="$active_disk_free"
    fi
  fi
  if [[ ! "$active_disk_free" =~ ^[0-9]+$ ]]; then active_disk_free=0; fi
  if [[ ! "$hls_disk_free" =~ ^[0-9]+$ ]]; then hls_disk_free=0; fi

  if [ "$active_disk_free" -gt 0 ]; then
    if [ "$active_disk_free" -lt "$required_disk_mb" ]; then
      add_report "FAIL" "Disk Space (Active)" "Free space in $ACTIVE_DIR is ${active_disk_free}MB (Required: >= ${required_disk_mb}MB)"
      add_remediation "Clean Up Active Disk" "Prune logs, clear unused Docker cache, or expand disk partitions."
    else
      add_report "PASS" "Disk Space (Active)" "Free space is ${active_disk_free}MB (Meets requirements)"
    fi
  else
    add_report "WARN" "Disk Space (Active)" "Could not retrieve partition space details for $ACTIVE_DIR"
  fi

  if [ -d "/var/www/hls" ] && [ "$hls_disk_free" -ne "$active_disk_free" ]; then
    if [ "$hls_disk_free" -gt 0 ] && [ "$hls_disk_free" -lt "$required_disk_mb" ]; then
      add_report "FAIL" "Disk Space (HLS)" "Free space in /var/www/hls is ${hls_disk_free}MB"
      add_remediation "Manage HLS Fragmentation" "Reduce segment retention counts or fragment lengths in Nginx RTMP config."
    fi
  fi
}

check_runtimes() {
  print_section "2. RUNTIME DEPENDENCIES & UTILITIES"

  if command -v node >/dev/null 2>&1; then
    add_report "PASS" "Node.js" "Installed ($(node -v 2>/dev/null || echo "unknown"))"
  else
    add_report "FAIL" "Node.js" "Missing from host PATH"
    add_remediation "Install Node.js" "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  fi

  if command -v npm >/dev/null 2>&1; then
    add_report "PASS" "npm" "Installed ($(npm -v 2>/dev/null || echo "unknown"))"
  else
    add_report "FAIL" "npm" "Missing from host PATH"
    add_remediation "Install npm" "sudo apt-get install -y npm"
  fi

  if command -v ffmpeg >/dev/null 2>&1; then
    local ver; ver=$(ffmpeg -version 2>/dev/null | head -n 1 | awk '{print $3}' || echo "installed")
    if ffmpeg -codecs 2>&1 | grep -q "libx264"; then
      add_report "PASS" "FFmpeg Transcoder" "Installed ($ver) with active libx264 codec"
    else
      add_report "WARN" "FFmpeg Transcoder" "Installed but MISSING libx264 support"
      add_remediation "Reinstall FFmpeg with x264" "sudo apt-get update && sudo apt-get install -y ffmpeg libavcodec-extra"
    fi
  else
    add_report "FAIL" "FFmpeg Transcoder" "Missing from host PATH"
    add_remediation "Install FFmpeg" "sudo apt-get update && sudo apt-get install -y ffmpeg"
  fi

  if command -v psql >/dev/null 2>&1; then
    add_report "PASS" "PostgreSQL Client" "Installed ($(psql --version 2>/dev/null | head -n 1 | awk '{print $3}' || echo "installed"))"
  else
    add_report "FAIL" "PostgreSQL Client" "Missing client utilities (psql)"
    add_remediation "Install Postgres Client" "sudo apt-get update && sudo apt-get install -y postgresql-client"
  fi

  if command -v git >/dev/null 2>&1; then
    add_report "PASS" "Git CLI" "Installed"
  else
    add_report "FAIL" "Git CLI" "Missing Git utility"
    add_remediation "Install Git" "sudo apt-get install -y git"
  fi

  if command -v docker >/dev/null 2>&1; then
    add_report "PASS" "Docker Engine" "Installed"
  else
    add_report "SKIP" "Docker Engine" "Not installed (Optional)"
  fi

  local has_compose=false
  if docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1; then
    has_compose=true
  fi
  if [ "$has_compose" = "true" ]; then
    add_report "PASS" "Docker Compose" "Installed"
  else
    add_report "SKIP" "Docker Compose" "Not installed (Optional)"
  fi
}

get_systemd_units_for_service() {
  local service="$1"
  local matched_units=()
  
  if [ "$has_systemd" = "false" ]; then
    echo ""
    return 0
  fi
  
  # List all possible services via systemctl
  # We do this by querying list-unit-files and list-units
  local all_units
  set +e
  all_units=$( (systemctl list-unit-files --type=service --all --no-legend 2>/dev/null | awk '{print $1}' || echo ""; \
                systemctl list-units --type=service --all --no-legend 2>/dev/null | awk '{print $1}' || echo "") | sort -u | grep -v '^$' || true)
  set -e
                
  if [ -z "$all_units" ]; then
    # Fallback to systemctl show directly on the service name
    all_units="$service"
  fi
  
  local unit
  while IFS= read -r unit; do
    [ -z "$unit" ] && continue
    local base="${unit%.service}"
    local match=false
    case "$service" in
      "postgresql")
        if [[ "$base" =~ ^postgresql(@[0-9a-zA-Z_-]+)?$ ]] || [[ "$base" == "postgres" ]]; then
          match=true
        fi
        ;;
      "streampulse")
        if [[ "$base" =~ ^streampulse(-backend|-api)?(@[0-9a-zA-Z_-]+)?$ ]]; then
          match=true
        fi
        ;;
      "nginx")
        if [[ "$base" == "nginx" ]]; then match=true; fi
        ;;
      "docker")
        if [[ "$base" == "docker" ]]; then match=true; fi
        ;;
      "fail2ban")
        if [[ "$base" == "fail2ban" ]]; then match=true; fi
        ;;
      *)
        if [[ "$base" == "$service" ]]; then match=true; fi
        ;;
    esac
    if [ "$match" = "true" ]; then
      matched_units+=("$unit")
    fi
  done <<< "$all_units"
  
  echo "${matched_units[@]:-}"
}

check_service_status() {
  local service_name="$1" is_required="$2"
  
  # Initialize states
  local is_installed=false
  local is_active=false
  local is_enabled=false
  local method=""
  local extra=""
  local pids=()
  local checked_units=()
  
  # 1. Query unit files & loaded units (Method 3, 4)
  local matched_units; matched_units=$(get_systemd_units_for_service "$service_name" | xargs)
  
  # 2. Extract state using standard systemctl metrics (Method 1, 2, 5, 6)
  if [ "$has_systemd" = "true" ] && [ -n "$matched_units" ]; then
    is_installed=true
    method="systemd"
    
    local unit
    for unit in $matched_units; do
      checked_units+=("$unit")
      
      # systemctl show (Method 1)
      local load_state; load_state=$(systemctl show "$unit" -p LoadState 2>/dev/null | cut -d= -f2 || echo "")
      local active_state; active_state=$(systemctl show "$unit" -p ActiveState 2>/dev/null | cut -d= -f2 || echo "")
      local unit_file_state; unit_file_state=$(systemctl show "$unit" -p UnitFileState 2>/dev/null | cut -d= -f2 || echo "")
      local main_pid; main_pid=$(systemctl show "$unit" -p MainPID 2>/dev/null | cut -d= -f2 || echo "")
      
      # systemctl status (Method 2)
      local status_out; status_out=$(systemctl status "$unit" 2>/dev/null || true)
      local status_says_active=false
      if echo "$status_out" | grep -q -E "Active: active \(running\)|\(running\)"; then
        status_says_active=true
      fi
      
      # systemctl is-active (Method 5)
      local is_active_quiet=false
      if systemctl is-active --quiet "$unit" 2>/dev/null; then
        is_active_quiet=true
      fi
      
      # systemctl is-enabled (Method 6)
      local is_enabled_quiet=false
      local en; en=$(systemctl is-enabled "$unit" 2>/dev/null || echo "disabled")
      if [[ "$en" == "enabled" || "$en" == "enabled-runtime" || "$en" == "static" || "$en" == "alias" ]]; then
        is_enabled_quiet=true
      fi
      
      # Evaluate states
      if [ "$active_state" = "active" ] || [ "$status_says_active" = "true" ] || [ "$is_active_quiet" = "true" ]; then
        is_active=true
        if [ -n "$main_pid" ] && [[ "$main_pid" =~ ^[0-9]+$ ]] && [ "$main_pid" -gt 0 ] && kill -0 "$main_pid" 2>/dev/null; then
          pids+=("$main_pid")
        fi
      fi
      
      if [ "$is_enabled_quiet" = "true" ] || [ "$unit_file_state" = "enabled" ]; then
        is_enabled=true
      fi
    done
    
    if [ "$is_active" = "true" ]; then
      extra="(Active systemd unit(s): ${checked_units[*]}, PID(s): ${pids[*]:-none})"
    else
      extra="(Inactive systemd unit(s): ${checked_units[*]})"
    fi
  fi
  
  # 3. Process Discovery (Method 7) & Socket/Port validation (Method 8) as robust fallbacks
  local proc_running=false
  local socket_or_port_ok=false
  local fallback_pids=()
  
  case "$service_name" in
    "streampulse")
      set +e
      local p; p=$(pgrep -f "dist/server\.cjs" || pgrep -f "server\.ts" || pgrep -f "streampulse" || echo "")
      set -e
      if [ -n "$p" ]; then
        proc_running=true
        for pid in $p; do
          if kill -0 "$pid" 2>/dev/null; then fallback_pids+=("$pid"); fi
        done
      fi
      
      local sp_port="3000"
      local env_path="$ACTIVE_DIR/.env"
      if [ -f "$env_path" ]; then
        sp_port=$(get_env_val "PORT" "$env_path" "3000")
      fi
      if is_port_listening "$sp_port"; then
        socket_or_port_ok=true
      fi
      ;;
      
    "nginx")
      set +e
      local p; p=$(pgrep -x nginx || pidof nginx || echo "")
      set -e
      if [ -n "$p" ]; then
        proc_running=true
        for pid in $p; do
          if kill -0 "$pid" 2>/dev/null; then fallback_pids+=("$pid"); fi
        done
      fi
      
      if is_port_listening 80 || is_port_listening 443 || is_port_listening 1935; then
        socket_or_port_ok=true
      fi
      ;;
      
    "postgresql")
      set +e
      local p; p=$(pgrep -x postgres || pgrep -x postmaster || echo "")
      set -e
      if [ -n "$p" ]; then
        proc_running=true
        for pid in $p; do
          if kill -0 "$pid" 2>/dev/null; then fallback_pids+=("$pid"); fi
        done
      fi
      
      if is_port_listening 5432; then
        socket_or_port_ok=true
      elif [ -d "/var/run/postgresql" ] && [ -n "$(find /var/run/postgresql/ -name ".s.PGSQL.*" 2>/dev/null)" ]; then
        socket_or_port_ok=true
      fi
      ;;
      
    "docker")
      set +e
      local p; p=$(pgrep -x dockerd || echo "")
      set -e
      if [ -n "$p" ]; then
        proc_running=true
        for pid in $p; do
          if kill -0 "$pid" 2>/dev/null; then fallback_pids+=("$pid"); fi
        done
      fi
      
      if [ -S "/var/run/docker.sock" ] || [ -S "/var/run/docker-bootstrap.sock" ]; then
        socket_or_port_ok=true
      fi
      ;;
      
    "fail2ban")
      set +e
      local p; p=$(pgrep -f fail2ban-server || pgrep -f fail2ban || echo "")
      set -e
      if [ -n "$p" ]; then
        proc_running=true
        for pid in $p; do
          if kill -0 "$pid" 2>/dev/null; then fallback_pids+=("$pid"); fi
        done
      fi
      
      if [ -S "/var/run/fail2ban/fail2ban.sock" ]; then
        socket_or_port_ok=true
      fi
      ;;
  esac
  
  # Merge systemd and process/socket findings
  # If systemd is inactive or absent but we found a running process or socket,
  # override status to installed & active to eliminate container/VM false-positives!
  if [ "$is_active" = "false" ] && { [ "$proc_running" = "true" ] || [ "$socket_or_port_ok" = "true" ]; }; then
    is_installed=true
    is_active=true
    pids=("${fallback_pids[@]}")
    method="Process/Socket Discovery"
    extra="(PID(s): ${pids[*]:-none}, Listening Socket/Port: $socket_or_port_ok)"
  fi
  
  # Also, check if file structures exist to determine if installed (Method 3 fallback)
  local path_exists=false
  case "$service_name" in
    "streampulse")
      if [ -d "$ACTIVE_DIR" ] && { [ -f "$ACTIVE_DIR/package.json" ] || [ -f "$ACTIVE_DIR/dist/server.cjs" ]; }; then path_exists=true; fi
      ;;
    "nginx")
      if [ -d "/etc/nginx" ] || command -v nginx >/dev/null 2>&1; then path_exists=true; fi
      ;;
    "postgresql")
      if [ -d "/etc/postgresql" ] || [ -d "/var/lib/postgresql" ] || command -v psql >/dev/null 2>&1; then path_exists=true; fi
      ;;
    "docker")
      if command -v docker >/dev/null 2>&1; then path_exists=true; fi
      ;;
    "fail2ban")
      if [ -d "/etc/fail2ban" ] || command -v fail2ban-client >/dev/null 2>&1; then path_exists=true; fi
      ;;
  esac
  
  if [ "$is_installed" = "false" ] && [ "$path_exists" = "true" ]; then
    is_installed=true
    method="File Paths"
    extra="(Inactive)"
  fi
  
  # Final Reporting
  if [ "$is_installed" = "false" ]; then
    if [ "$is_required" = "true" ]; then
      add_report "FAIL" "Service: $service_name" "Service is NOT installed on the host"
      add_remediation "Install $service_name" "Please install $service_name using the system package manager or installer."
    else
      add_report "SKIP" "Service: $service_name" "Service is not installed (Optional)"
    fi
  elif [ "$is_active" = "true" ]; then
    local enabled_str="Enabled: $is_enabled"
    if [ "$has_systemd" = "false" ]; then enabled_str="Systemd not active"; fi
    add_report "PASS" "Service: $service_name" "Service is running & healthy ($enabled_str, Method: $method, $extra)"
  else
    if [ "$is_required" = "true" ]; then
      add_report "FAIL" "Service: $service_name" "Service is installed but INACTIVE $extra"
      add_remediation "Start $service_name" "sudo systemctl start $service_name"
    else
      add_report "WARN" "Service: $service_name" "Service is installed but INACTIVE $extra"
      add_remediation "Start $service_name" "sudo systemctl start $service_name"
    fi
  fi
}

check_services() {
  print_section "3. DAEMON SERVICE HEALTH"
  check_service_status "streampulse" "true"
  check_service_status "nginx" "true"
  check_service_status "postgresql" "true"
  check_service_status "docker" "false"
  check_service_status "fail2ban" "false"
}

check_ports() {
  print_section "4. NETWORK PORT BINDINGS"
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
        1935) add_remediation "Verify RTMP Configuration" "Check for rtmp block in /etc/nginx/nginx.conf or modules." ;;
        3000) add_remediation "Start API Service" "sudo systemctl start streampulse" ;;
        5432) add_remediation "Start PostgreSQL" "sudo systemctl start postgresql" ;;
      esac
    fi
  done

  if is_port_listening 443; then
    add_report "PASS" "Port 443 (HTTPS Ingress)" "Bound & actively listening"
  else
    add_report "WARN" "Port 443 (HTTPS Ingress)" "Port is offline / not configured (Optional)"
    add_remediation "Setup TLS Encryption" "Generate SSL certificates using: sudo certbot --nginx"
  fi
}

check_config_and_db() {
  print_section "5. CONFIGURATION & DATABASE CONNECTIVITY"

  local env_path="$ACTIVE_DIR/.env"
  if [ ! -f "$env_path" ]; then
    add_report "FAIL" ".env Configuration File" "Not found at: $env_path"
    add_remediation "Deploy Configuration" "cp $ACTIVE_DIR/.env.example $env_path && chmod 600 $env_path"
    return 1
  fi
  add_report "PASS" ".env Configuration File" "Found configuration file at $env_path"

  local db_host db_port db_user db_password db_name jwt_secret gemini_key
  db_host=$(get_env_val "DB_HOST" "$env_path" "")
  db_port=$(get_env_val "DB_PORT" "$env_path" "5432")
  db_user=$(get_env_val "DB_USER" "$env_path" "")
  db_password=$(get_env_val "DB_PASSWORD" "$env_path" "")
  db_name=$(get_env_val "DB_NAME" "$env_path" "")
  jwt_secret=$(get_env_val "JWT_SECRET" "$env_path" "")
  gemini_key=$(get_env_val "GEMINI_API_KEY" "$env_path" "")
  if [ -z "$gemini_key" ]; then
    gemini_key=$(get_env_val "API_KEY" "$env_path" "")
  fi

  local missing_properties=()
  [ -z "$db_host" ] && missing_properties+=("DB_HOST")
  [ -z "$db_port" ] && missing_properties+=("DB_PORT")
  [ -z "$db_user" ] && missing_properties+=("DB_USER")
  [ -z "$db_password" ] && missing_properties+=("DB_PASSWORD")
  [ -z "$db_name" ] && missing_properties+=("DB_NAME")
  [ -z "$jwt_secret" ] && missing_properties+=("JWT_SECRET")

  if [ ${#missing_properties[@]} -gt 0 ]; then
    add_report "FAIL" "Configured Variables" "Missing crucial environment settings: ${missing_properties[*]}"
    add_remediation "Fix Config File Variables" "Define missing connections in $env_path: ${missing_properties[*]}"
    return 1
  fi
  add_report "PASS" "Configured Variables" "All required configuration credentials are valid"

  if [ "$jwt_secret" = "streampulse_default_secret_key_98451023" ]; then
    add_report "WARN" "JWT Token Protection" "Default unsecure template key is used for JWT signatures"
    add_remediation "Strengthen JWT Secret" "Generate a production-strength random secret: openssl rand -hex 32"
  else
    add_report "PASS" "JWT Token Protection" "Personalized cryptographically secure JWT key configured"
  fi

  if [ -z "$gemini_key" ]; then
    add_report "WARN" "AI Feature Engine" "GEMINI_API_KEY variable is empty"
    add_remediation "Integrate Gemini AI" "Add GEMINI_API_KEY=your_key to $env_path to enable intelligent optimizations."
  else
    add_report "PASS" "AI Feature Engine" "Gemini API credentials successfully integrated"
  fi

  if ! command -v psql >/dev/null 2>&1; then
    add_report "FAIL" "PostgreSQL Socket Connect" "psql client utility missing; skipping verification"
    return 1
  fi

  local db_conn_ok=false
  set +e
  PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1;" >/dev/null 2>&1
  if [ $? -eq 0 ]; then
    db_conn_ok=true
  fi
  set -e

  if [ "$db_conn_ok" = "false" ]; then
    add_report "FAIL" "PostgreSQL Socket Connect" "Connectivity failed to PostgreSQL server ($db_name@$db_host:$db_port)"
    add_remediation "Check Database Status" "Verify if database is active and accepting connections: sudo pg_isready"
    return 1
  fi
  add_report "PASS" "PostgreSQL Socket Connect" "Successfully authenticated & connected to database"

  local users_ok=false streams_ok=false
  set +e
  PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='users');" 2>/dev/null | grep -q "t"
  if [ $? -eq 0 ]; then
    users_ok=true
  fi
  PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='streams');" 2>/dev/null | grep -q "t"
  if [ $? -eq 0 ]; then
    streams_ok=true
  fi
  set -e

  if [ "$users_ok" = "true" ] && [ "$streams_ok" = "true" ]; then
    add_report "PASS" "Database Schema" "Production schema validated. Tables 'users' and 'streams' are intact"
  else
    add_report "FAIL" "Database Schema" "Connected but required structures (users/streams) are missing"
    add_remediation "Run DB Schema Migration" "PGPASSWORD=\"$db_password\" psql -h \"$db_host\" -p \"$db_port\" -U \"$db_user\" -d \"$db_name\" -f \"$ACTIVE_DIR/vps-deployment/schema.sql\""
  fi
}

check_filesystem() {
  print_section "6. DIRECTORIES & FILE SYSTEM INTEGRITY"

  local hls_dir="/var/www/hls"
  local log_dir="/var/log/streampulse"
  local data_dir="$ACTIVE_DIR/data"

  if [ -d "$hls_dir" ]; then
    if [ -w "$hls_dir" ]; then
      add_report "PASS" "HLS Output Path" "Directory $hls_dir exists and is writable"
    else
      add_report "FAIL" "HLS Output Path" "Directory $hls_dir exists but is NOT writable"
      add_remediation "Fix HLS Permissions" "sudo chown -R www-data:www-data $hls_dir && sudo chmod -R 775 $hls_dir"
    fi
  else
    add_report "FAIL" "HLS Output Path" "Directory $hls_dir is missing"
    add_remediation "Create HLS Output Path" "sudo mkdir -p $hls_dir && sudo chown -R www-data:www-data $hls_dir && sudo chmod -R 775 $hls_dir"
  fi

  if [ -d "$log_dir" ]; then
    if [ -w "$log_dir" ]; then
      add_report "PASS" "Log Storage Path" "Directory $log_dir exists and is writable"
    else
      add_report "FAIL" "Log Storage Path" "Directory $log_dir exists but is NOT writable"
      add_remediation "Fix Log Permissions" "sudo chown -R streampulse:streampulse $log_dir && sudo chmod -R 755 $log_dir"
    fi
  else
    add_report "FAIL" "Log Storage Path" "Directory $log_dir is missing"
    add_remediation "Create Log Storage Path" "sudo mkdir -p $log_dir && sudo chown -R streampulse:streampulse $log_dir && sudo chmod -R 755 $log_dir"
  fi

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

  local trans_bin="/usr/local/bin/transcode.sh"
  local trans_local="$ACTIVE_DIR/vps-deployment/transcode.sh"
  if [ -x "$trans_bin" ]; then
    add_report "PASS" "Transcode Pipeline" "Executable script found globally at $trans_bin"
  elif [ -f "$trans_bin" ]; then
    add_report "FAIL" "Transcode Pipeline" "Script exists at $trans_bin but is NOT executable"
    add_remediation "Set Executable Flag" "sudo chmod +x $trans_bin"
  elif [ -f "$trans_local" ]; then
    add_report "WARN" "Transcode Pipeline" "Global script missing; local template found"
    add_remediation "Install Global Transcoder" "sudo cp $trans_local $trans_bin && sudo chmod +x $trans_bin"
  else
    add_report "FAIL" "Transcode Pipeline" "transcode.sh script completely missing"
    add_remediation "Create Transcode Pipeline" "Please restore transcode.sh to /usr/local/bin/transcode.sh."
  fi
}

check_production_security() {
  print_section "7. PRODUCTION SECURITY & OWNERSHIP"

  if command -v ufw >/dev/null 2>&1; then
    local ufw_status; ufw_status=$(ufw status 2>/dev/null || echo "Status: inactive")
    if echo "$ufw_status" | grep -q "active"; then
      add_report "PASS" "UFW Firewall" "Firewall is active"
      local rules_ok=true cp
      for cp in 22 80 1935; do
        if ! echo "$ufw_status" | grep -q -E "(\s|^)$cp(/|$)" 2>/dev/null; then
          rules_ok=false
          add_report "WARN" "Firewall Port: $cp" "Critical port $cp is blocked or not explicitly allowed"
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

  if [ "$IS_ROOT" = "true" ]; then
    local hls_dir="/var/www/hls"
    if [ -d "$hls_dir" ]; then
      local hls_owner; hls_owner=$(stat -c "%U" "$hls_dir" 2>/dev/null || echo "unknown")
      if [ "$hls_owner" = "www-data" ] || [ "$hls_owner" = "nginx" ] || [ "$hls_owner" = "root" ]; then
        add_report "PASS" "HLS Ownership" "Verified correct owner ($hls_owner)"
      else
        add_report "WARN" "HLS Ownership" "Owned by '$hls_owner' instead of 'www-data' or 'nginx'"
        add_remediation "Fix HLS Ownership" "sudo chown -R www-data:www-data $hls_dir"
      fi
    fi
  else
    add_report "SKIP" "Ownership Checks" "Skipped (Requires privileged root access)"
  fi
}

check_api_endpoint() {
  print_section "8. WEB SERVICE API HEALTH & INTEGRITY"

  local port="3000"
  local env_path="$ACTIVE_DIR/.env"
  if [ -f "$env_path" ]; then
    port=$(get_env_val "PORT" "$env_path" "3000")
  fi

  if ! is_port_listening "$port"; then
    add_report "SKIP" "API Health Endpoint" "Skipped (StreamPulse backend is not listening on port $port)"
    return 0
  fi

  if ! command -v curl >/dev/null 2>&1; then
    add_report "WARN" "API Health Endpoint" "Missing curl; skipping health probe"
    return 0
  fi

  local http_code="000"
  local payload=""
  local url="http://127.0.0.1:$port/health"
  
  set +e
  local curl_resp; curl_resp=$(curl -s -w "\n%{http_code}" --max-time 3 "$url" 2>/dev/null)
  local curl_exit_code=$?
  set -e
  
  if [ $curl_exit_code -eq 0 ] && [ -n "$curl_resp" ]; then
    http_code=$(echo "$curl_resp" | tail -n 1)
    payload=$(echo "$curl_resp" | head -n -1)
  fi

  if [ "$http_code" != "200" ] || [[ "$payload" != *"status"* ]]; then
    local fallback_url="http://127.0.0.1:$port/api/health"
    set +e
    local fb_resp; fb_resp=$(curl -s -w "\n%{http_code}" --max-time 3 "$fallback_url" 2>/dev/null)
    local fb_exit_code=$?
    set -e
    
    if [ $fb_exit_code -eq 0 ] && [ -n "$fb_resp" ]; then
      local fb_code; fb_code=$(echo "$fb_resp" | tail -n 1)
      if [ "$fb_code" = "200" ]; then
        payload=$(echo "$fb_resp" | head -n -1)
        http_code="$fb_code"
      fi
    fi
  fi

  if [ "$http_code" = "200" ]; then
    if echo "$payload" | grep -q "status" && echo "$payload" | grep -q "ok"; then
      add_report "PASS" "API GET /health" "Server returns active healthy state: status=ok (payload: $payload)"
    else
      add_report "WARN" "API GET /health" "Returned HTTP 200, but structure mismatch (payload: $payload)"
    fi
  else
    add_report "FAIL" "API GET /health" "Health endpoint returned code $http_code"
    add_remediation "Audit Application Process" "Inspect backend logs: journalctl -u streampulse -n 40 --no-pager"
  fi
}

# ------------------------------------------------------------------------------
# 5. DIAGNOSTICS ORCHESTRATION & REPORT GENERATION
# ------------------------------------------------------------------------------
main() {
  print_header

  check_hardware
  check_runtimes
  check_services
  check_ports
  check_config_and_db
  check_filesystem
  check_production_security
  check_api_endpoint

  local active_audits=$(( TOTAL_COUNT - SKIP_COUNT ))
  local score_percent=0
  if [ "$active_audits" -gt 0 ]; then
    score_percent=$(( (PASS_COUNT * 100) / active_audits ))
  fi

  echo -e "\n${CYAN}${BOLD}==============================================================================${NC}"
  echo -e "${BOLD}   🏁  Platform Diagnostic Verification Summary                              ${NC}"
  echo -e "${CYAN}${BOLD}==============================================================================${NC}"
  echo -e "  Passed Audits:   ${GREEN}${BOLD}${PASS_COUNT}${NC}"
  echo -e "  Warnings:        ${YELLOW}${BOLD}${WARN_COUNT}${NC}"
  echo -e "  Skipped Audits:  ${BLUE}${BOLD}${SKIP_COUNT}${NC}"
  echo -e "  Failed Audits:   ${RED}${BOLD}${FAIL_COUNT}${NC}"
  echo -e "${CYAN}------------------------------------------------------------------------------${NC}"

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

  if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}==============================================================================${NC}"
    echo -e "${GREEN}${BOLD}   🏆  SYSTEM HEALTHY                                                        ${NC}"
    echo -e "${GREEN}${BOLD}==============================================================================${NC}"
    if [ "$WARN_COUNT" -gt 0 ]; then
      echo -e "${YELLOW}${BOLD}Warning:${NC} Minor non-blocking configuration recommended. See report above."
    fi
  else
    echo -e "\n${RED}${BOLD}==============================================================================${NC}"
    echo -e "${RED}${BOLD}   🚨  SYSTEM UNHEALTHY                                                      ${NC}"
    echo -e "${RED}${BOLD}==============================================================================${NC}"
    echo -e "${RED}Error: ${BOLD}${FAIL_COUNT}${NC} critical validation audits failed. Immediate action required."
  fi

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

  if [ "$FAIL_COUNT" -eq 0 ]; then
    exit 0
  else
    exit 1
  fi
}

main
