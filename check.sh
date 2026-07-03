#!/bin/bash

# ==============================================================================
# StreamPulse RTMP VPS Manager - Production Health Diagnostics
# Checks status of all critical dependencies, services, and networking ports.
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
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "${CYAN}${BOLD}      📊  StreamPulse RTMP VPS Manager - Health Diagnostics Check             ${NC}"
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

  printf "  %-35s" "$label"
  
  if [ "$status" = "PASS" ] || [ "$status" = "ACTIVE" ] || [ "$status" = "OPEN" ] || [ "$status" = "FOUND" ]; then
    echo -e "[ ${GREEN}${BOLD}PASS${NC} ]  $details"
  elif [ "$status" = "WARN" ]; then
    echo -e "[ ${YELLOW}${BOLD}WARN${NC} ]  $details"
  else
    echo -e "[ ${RED}${BOLD}FAIL${NC} ]  $details"
  fi
}

echo -e "${BOLD}--- [1/3] Dependency Presence & Versions ---${NC}"

# Check Git
if command -v git &>/dev/null; then
  print_status "Git" "FOUND" "$(git --version | head -n 1)"
else
  print_status "Git" "FAIL" "Not installed or not in PATH"
fi

# Check Curl
if command -v curl &>/dev/null; then
  print_status "Curl" "FOUND" "$(curl --version | head -n 1 | cut -d' ' -f1-2)"
else
  print_status "Curl" "FAIL" "Not installed or not in PATH"
fi

# Check Node.js
if command -v node &>/dev/null; then
  print_status "Node.js" "FOUND" "$(node -v)"
else
  print_status "Node.js" "FAIL" "Not installed or not in PATH"
fi

# Check NPM
if command -v npm &>/dev/null; then
  print_status "npm" "FOUND" "$(npm -v)"
else
  print_status "npm" "FAIL" "Not installed or not in PATH"
fi

# Check Docker
if command -v docker &>/dev/null; then
  print_status "Docker" "FOUND" "$(docker --version)"
else
  print_status "Docker" "WARN" "Docker is not installed on host"
fi

# Check PostgreSQL
if command -v psql &>/dev/null; then
  print_status "PostgreSQL Client" "FOUND" "$(psql --version)"
else
  print_status "PostgreSQL Client" "FAIL" "psql client utility missing"
fi

# Check Nginx
if command -v nginx &>/dev/null; then
  print_status "Nginx" "FOUND" "$(nginx -v 2>&1 | cut -d'/' -f2)"
else
  print_status "Nginx" "FAIL" "Nginx is not installed on host"
fi

# Check FFmpeg
if command -v ffmpeg &>/dev/null; then
  print_status "FFmpeg Transcoder" "FOUND" "$(ffmpeg -version 2>&1 | head -n 1 | cut -d' ' -f1-3)"
else
  print_status "FFmpeg Transcoder" "FAIL" "FFmpeg transcode utility missing"
fi

# Check OpenSSL
if command -v openssl &>/dev/null; then
  print_status "OpenSSL" "FOUND" "$(openssl version)"
else
  print_status "OpenSSL" "FAIL" "OpenSSL utility missing"
fi

echo ""
echo -e "${BOLD}--- [2/3] Host System Services ---${NC}"

# Check systemctl service status
services=(postgresql nginx streampulse)
for srv in "${services[@]}"; do
  if systemctl list-units --full -all | grep -Fq "$srv.service"; then
    if systemctl is-active --quiet "$srv"; then
      print_status "$srv.service" "ACTIVE" "Active and running in background"
    else
      print_status "$srv.service" "FAIL" "Installed but currently INACTIVE/STOPPED"
    fi
  else
    print_status "$srv.service" "FAIL" "Service unit not registered in systemd"
  fi
done

echo ""
echo -e "${BOLD}--- [3/3] Port Allocation & Networking ---${NC}"

# Check RTMP Port 1935
if ss -tuln | grep -q ":1935"; then
  print_status "RTMP Ingestion (Port 1935)" "OPEN" "Accepting video stream broadcasts"
else
  print_status "RTMP Ingestion (Port 1935)" "FAIL" "Port closed - Nginx RTMP module not listening"
fi

# Check HTTP Web Port 80
if ss -tuln | grep -q ":80"; then
  print_status "HTTP Dashboard Proxy (Port 80)" "OPEN" "Responding to browser connection requests"
else
  print_status "HTTP Dashboard Proxy (Port 80)" "FAIL" "Port closed - Nginx reverse-proxy down"
fi

# Check Internal Port 3000
if ss -tuln | grep -q ":3000"; then
  print_status "StreamPulse Internal (Port 3000)" "OPEN" "Node.js express application listening"
else
  print_status "StreamPulse Internal (Port 3000)" "FAIL" "Port closed - Node.js server down"
fi

echo ""
echo -e "${CYAN}==============================================================================${NC}"
echo -e "💡 TIP: Run 'journalctl -u streampulse -n 50 --no-pager' to inspect app logs."
echo -e "${CYAN}==============================================================================${NC}\n"
