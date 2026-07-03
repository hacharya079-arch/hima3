#!/bin/bash

# StreamPulse Multi-Bitrate Adaptive HLS Transcoding Script
# This script is auto-triggered by Nginx-RTMP when a stream ingest begins.
# Args: $1 = Stream Key / Stream Name

STREAM_KEY=$1
HLS_PATH="/var/www/hls/${STREAM_KEY}"
RTMP_INPUT="rtmp://localhost/live/${STREAM_KEY}"

# Exit if no stream key is supplied
if [ -z "$STREAM_KEY" ]; then
    echo "No stream key specified. Exiting..."
    exit 1
fi

# Ensure output path exists
mkdir -p "${HLS_PATH}"

# Run FFmpeg transcoding in background to achieve low latency
# Generates 1080p, 720p, 480p, and 360p streams with unified HLS master playlist
ffmpeg -i "${RTMP_INPUT}" \
  -filter_complex "[v:0]split=4[v1080][v720][v480][v360]" \
  \
  -map "[v1080]" -c:v:0 libx264 -preset veryfast -b:v:0 6000k -maxrate:v:0 6000k -bufsize:v:0 12000k -g 60 -keyint_min 60 -sc_threshold 0 \
  -map "[v720]"  -c:v:1 libx264 -preset veryfast -b:v:1 3500k -maxrate:v:1 3500k -bufsize:v:1 7000k  -g 60 -keyint_min 60 -sc_threshold 0 \
  -map "[v480]"  -c:v:2 libx264 -preset veryfast -b:v:2 1500k -maxrate:v:2 1500k -bufsize:v:2 3000k  -g 60 -keyint_min 60 -sc_threshold 0 \
  -map "[v360]"  -c:v:3 libx264 -preset veryfast -b:v:3 800k  -maxrate:v:3 800k  -bufsize:v:3 1600k  -g 60 -keyint_min 60 -sc_threshold 0 \
  \
  -map a:0 -c:a:0 aac -b:a:0 192k -ac 2 \
  -map a:0 -c:a:1 aac -b:a:1 128k -ac 2 \
  -map a:0 -c:a:2 aac -b:a:2 96k  -ac 2 \
  -map a:0 -c:a:3 aac -b:a:3 64k  -ac 2 \
  \
  -f hls \
  -hls_time 4 \
  -hls_playlist_type event \
  -master_pl_name master.m3u8 \
  -hls_segment_filename "${HLS_PATH}/v%v/file%03d.ts" \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3" \
  "${HLS_PATH}/v%v/index.m3u8" > /var/log/nginx/transcode_${STREAM_KEY}.log 2>&1 &

echo "Transcoding process initialized for stream ${STREAM_KEY} in background."
