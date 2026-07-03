# StreamPulse Dockerfile: Unified Nginx-RTMP, FFmpeg, and Node.js Environment

# Build stage for building the frontend Node application
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Final production stage
FROM ubuntu:24.04

# Avoid prompt questions during installations
ENV DEBIAN_FRONTEND=noninteractive

# Install core packages, nginx, ffmpeg, build-essential, and nodejs
RUN apt-get update && apt-get install -y \
    build-essential \
    libpcre3 \
    libpcre3-dev \
    libssl-dev \
    zlib1g-dev \
    wget \
    ffmpeg \
    curl \
    git \
    nginx \
    libnginx-mod-rtmp \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Set up working directory for the Express manager server
WORKDIR /app

# Copy built node server and frontend distribution
COPY --from=frontend-builder /app/package*.json ./
RUN npm ci --only=production
COPY --from=frontend-builder /app/dist ./dist
COPY --from=frontend-builder /app/data ./data

# Setup Nginx RTMP and HTTP serving directories
RUN mkdir -p /var/www/hls && chmod -R 755 /var/www/hls
RUN mkdir -p /var/log/nginx

# Copy configuration files
COPY vps-deployment/nginx.conf /etc/nginx/nginx.conf
COPY vps-deployment/nginx-rtmp.conf /etc/nginx/nginx-rtmp.conf
COPY vps-deployment/transcode.sh /usr/local/bin/transcode.sh
RUN chmod +x /usr/local/bin/transcode.sh

# Expose RTMP, HTTP, and Node backend ports
EXPOSE 1935
EXPOSE 80
EXPOSE 443
EXPOSE 3000

# Copy start runner script
COPY <<-"EOF" /app/entrypoint.sh
#!/bin/bash
# Start Nginx in background
nginx -c /etc/nginx/nginx.conf &
# Start RTMP Nginx module in background
nginx -c /etc/nginx/nginx-rtmp.conf &
# Start StreamPulse Node server in foreground
npm run start
EOF

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
