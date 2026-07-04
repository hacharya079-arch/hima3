# StreamPulse RTMP VPS Manager

StreamPulse is an enterprise-grade RTMP VPS Management platform designed to orchestrate and monitor multi-bitrate RTMP live-streaming, live transcoding (using FFmpeg), and high-performance delivery over HLS and DASH. It features automatic system tuning, SSL automation, built-in security auditing, and detailed monitoring dashboards.

---

## 🚀 Deployment Pathways

StreamPulse supports two robust deployment architectures:

1. **Native Bare-Metal Systemd Deployment** (Recommended for maximum CPU and GPU performance during FFmpeg transcoding).
2. **Containerized Docker Deployment** (Recommended for quick, sandboxed environment setup).

---

## 🛠️ Method 1: Native Bare-Metal Systemd Deployment (Recommended)

This deployment pathway installs Node.js, PostgreSQL (secured with minimum privileges), Nginx with the RTMP module, and Fail2Ban directly on your host Ubuntu VPS. The Node.js application runs under a dedicated, unprivileged system user (`streampulse`).

### Prerequisites
- A clean VPS running **Ubuntu 20.04, 22.04, or 24.04 LTS**.
- Root privileges on the server.
- A registered domain name with an A record pointing to your VPS IP address.

### Step-by-Step Installation

1. **Clone the Repository**:
   ```bash
   git clone <your-repository-url>
   cd streampulse-vps-manager
   ```

2. **Grant Execution Permissions**:
   ```bash
   chmod +x install.sh check.sh uninstall.sh
   ```

3. **Run the One-Click Installer**:
   ```bash
   sudo ./install.sh
   ```
   *The installer will automatically handle package installation, database creation, unprivileged user configuration, SSL certificate generation via Certbot, system tuning, and systemd service registration.*

4. **Verify Deployment & Security**:
   ```bash
   sudo ./check.sh
   ```
   *This utility audits CPU, RAM, disk HLS directories, systemd services, UFW firewalls, Fail2Ban protection jails, and local PostgreSQL database connectivity.*

5. **Decommissioning (If needed)**:
   ```bash
   sudo ./uninstall.sh
   ```
   *This command safely stops background processes, removes systemd configuration, cleans static paths, deletes log paths, and optionally purges database elements and the unprivileged Linux user.*

---

## 🐳 Method 2: Containerized Docker Deployment

This pathway runs StreamPulse in isolated Docker containers using Docker Compose. It encapsulates Nginx, PostgreSQL, FFmpeg, and Node.js into a pre-configured network stack.

Refer to the dedicated [vps-deployment/INSTALLATION.md](./vps-deployment/INSTALLATION.md) for detailed configuration, domain mapping, volume mounts, and container commands.

### Quick Start
```bash
cd vps-deployment
sudo docker compose up -d --build
```

---

## 📦 Repository Structure & Path Consistency

The repository has been structured so that all deployment pathways can be executed directly without manual file operations:

- `/install.sh`: Bare-metal Linux systemd automated installer (root execution).
- `/check.sh`: System status and security auditing suite.
- `/uninstall.sh`: Idempotent system decommissioner.
- `/vps-deployment/`: Configuration directory containing:
  - `nginx.conf`: Nginx core configuration.
  - `nginx-rtmp.conf`: Nginx RTMP and HLS/DASH delivery module.
  - `schema.sql`: Clean database tables and indexes template.
  - `transcode.sh`: Foreground FFmpeg multi-bitrate transcoder wrapper (terminates on publisher disconnect).
  - `Dockerfile` & `docker-compose.yml`: For containerized deployment.
  - `INSTALLATION.md`: Full step-by-step setup guide for domains, SSL, and docker commands.

---

## 🛠️ Git Contribution & Integration workflow

To add these deployment scripts into Git tracking and commit them to your repository:

```bash
# 1. Track the deployment scripts and documentation
git add install.sh check.sh uninstall.sh
git add README.md vps-deployment/INSTALLATION.md
git add vps-deployment/transcode.sh

# 2. Commit the changes
git commit -m "feat(ops): add production-ready bare-metal and containerized deployment scripts"

# 3. Push to your main branch
git push origin main
```

---

## 🛡️ Production Security Standards

StreamPulse adheres to strict enterprise security standards:
- **Unprivileged Node Execution**: The background daemon runs under a dedicated, unprivileged system account (`streampulse`).
- **Hardened Database Privileges**: Database roles are configured as normal `NOSUPERUSER` roles with minimum schema permissions.
- **Fail2Ban SSH Protection**: SSH ports are monitored for automated block lists.
- **Unified Process Lifecycle**: The FFmpeg transcode script runs in the foreground (`exec ffmpeg`), ensuring automatic process cleanup by Nginx RTMP on stream publisher disconnect (no orphan processes).
