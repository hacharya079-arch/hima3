-- StreamPulse RTMP VPS Manager Database Schema (PostgreSQL)

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Streams Table
CREATE TABLE IF NOT EXISTS streams (
    id VARCHAR(50) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    broadcaster VARCHAR(100) NOT NULL,
    stream_key VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'offline', -- offline, live, disabled, scheduled
    scheduled_start TIMESTAMP,
    rtmp_url VARCHAR(255) NOT NULL,
    resolution VARCHAR(20) DEFAULT '1080p',
    bitrate INTEGER DEFAULT 4500,
    codec VARCHAR(20) DEFAULT 'H.264',
    ingest_ip VARCHAR(50) NOT NULL,
    viewers INTEGER DEFAULT 0,
    start_time TIMESTAMP
);

-- Seed Initial Default Administrator Account (username: admin, password: admin123)
-- Hash generated using bcryptjs (rounds: 10)
INSERT INTO users (username, email, password_hash, role)
VALUES (
    'admin', 
    'admin@streampulse.io', 
    '$2a$10$Xm3C0H5gLqGz7uB7wF8pZeGbyhS6F1mP689S5fV/M4V8L5Yn4O7yW', 
    'admin'
) ON CONFLICT (username) DO NOTHING;
