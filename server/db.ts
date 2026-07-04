import pg from 'pg';
import fs from 'fs';
import path from 'path';

// Let's create a local file path for fallback JSON persistence
const DATA_DIR = path.resolve('./data');
const JSON_DB_PATH = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Interfaces matching PostgreSQL tables
export interface UserRecord {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'user';
  created_at: string;
  status?: 'enabled' | 'disabled';
  assigned_stream_id?: string | null;
  login_history?: string | null;
}

export interface StreamRecord {
  id: string;
  userId: number;
  title: string;
  broadcaster: string;
  streamKey: string;
  status: 'offline' | 'live' | 'disabled' | 'scheduled';
  scheduledStart?: string;
  rtmpUrl: string;
  resolution: string;
  bitrate: number;
  codec: string;
  ingestIp: string;
  viewers: number;
  startTime?: string;
  width?: number;
  height?: number;
  fps?: number;
  aspectRatio?: string;
  videoCodec?: string;
  audioCodec?: string;
  preset?: string;
  profile?: string;
  pixelFormat?: string;
  enabledProfiles?: string;
  gopSize?: number;
  bufferSize?: number;
  maxBitrate?: number;
  scalingAlgorithm?: string;
  audioEnabled?: boolean;
  audioBitrate?: string;
  audioSampleRate?: number;
  audioChannels?: string;
  audioVolume?: number;
  audioNormalize?: boolean;
  audioNoiseReduction?: boolean;
  audioDelay?: number;
  audioLanguage?: string;
  audioTrackSelection?: string;
  audioPassthrough?: boolean;
  audioTranscoding?: boolean;
  profilesJson?: string;
}

export interface DeviceRecord {
  id: string;
  name: string;
  location?: string;
  description?: string;
  os_version?: string;
  player_version?: string;
  ip_address?: string;
  mac_address?: string;
  last_seen?: string;
  online_status: 'online' | 'offline' | 'playing' | 'buffering' | 'stopped' | 'disconnected';
  current_stream_id?: string;
  current_stream_url?: string;
  current_resolution?: string;
  current_volume: number;
  current_playback_status?: string;
  pairing_code?: string;
  paired: boolean;
  token?: string;
  cpu_usage?: number;
  ram_usage?: number;
  temperature?: number;
  network_speed?: string;
  screenshot_url?: string;
  screenshot_time?: string;
  brightness?: number;
  rotation?: string;
  player_settings?: string;
  network_settings?: string;
  client_version?: string;
}

export interface DeviceGroupRecord {
  id: string;
  name: string;
  description?: string;
}

export interface DeviceGroupMemberRecord {
  group_id: string;
  device_id: string;
}

export interface PlaybackHistoryRecord {
  id: string;
  device_id: string;
  stream_id?: string;
  stream_url?: string;
  action: string;
  timestamp: string;
}

export interface DeviceLogRecord {
  id: string;
  device_id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface DeviceScheduleRecord {
  id: string;
  device_id?: string;
  group_id?: string;
  time: string; // e.g. "09:00"
  action: 'play' | 'stop';
  stream_id?: string;
  stream_url?: string;
  enabled: boolean;
}

// In-Memory Fallback State (persisted to data/db.json)
interface LocalDBState {
  users: UserRecord[];
  streams: StreamRecord[];
  devices: DeviceRecord[];
  deviceGroups: DeviceGroupRecord[];
  deviceGroupMembers: DeviceGroupMemberRecord[];
  playbackHistory: PlaybackHistoryRecord[];
  deviceLogs: DeviceLogRecord[];
  deviceSchedules: DeviceScheduleRecord[];
}

let localState: LocalDBState = {
  users: [],
  streams: [
    {
      id: '1',
      userId: 1,
      title: 'Late Night Coding Sessions',
      broadcaster: 'dev_alex',
      viewers: 1240,
      status: 'live',
      startTime: new Date().toISOString(),
      rtmpUrl: 'rtmp://154.12.88.2/live',
      streamKey: 'alex_secure_123',
      resolution: '1080p',
      ingestIp: '154.12.88.2',
      bitrate: 6000,
      codec: 'H.264'
    },
    {
      id: '2',
      userId: 1,
      title: 'E-Sports Tournament Qualifiers',
      broadcaster: 'pro_gaming_tv',
      viewers: 8520,
      status: 'live',
      startTime: new Date().toISOString(),
      rtmpUrl: 'rtmp://192.168.1.45/live',
      streamKey: 'tournament_alpha',
      resolution: '4K',
      ingestIp: '192.168.1.45',
      bitrate: 10000,
      codec: 'H.265'
    }
  ],
  devices: [],
  deviceGroups: [],
  deviceGroupMembers: [],
  playbackHistory: [],
  deviceLogs: [],
  deviceSchedules: []
};

// Load saved data if exists
if (fs.existsSync(JSON_DB_PATH)) {
  try {
    const data = fs.readFileSync(JSON_DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    localState = {
      ...localState,
      ...parsed,
      users: parsed.users || [],
      streams: parsed.streams || [],
      devices: parsed.devices || [],
      deviceGroups: parsed.deviceGroups || [],
      deviceGroupMembers: parsed.deviceGroupMembers || [],
      playbackHistory: parsed.playbackHistory || [],
      deviceLogs: parsed.deviceLogs || [],
      deviceSchedules: parsed.deviceSchedules || []
    };
  } catch (err) {
    console.error('Error reading JSON DB fallback, using defaults', err);
  }
} else {
  // Create initial admin user
  // Password hash for 'admin123'
  // $2a$10$Xm3C0H5gLqGz7uB7wF8pZeGbyhS6F1mP689S5fV/M4V8L5Yn4O7yW
  localState.users.push({
    id: 1,
    username: 'admin',
    email: 'admin@streampulse.io',
    password_hash: '$2a$10$Xm3C0H5gLqGz7uB7wF8pZeGbyhS6F1mP689S5fV/M4V8L5Yn4O7yW',
    role: 'admin',
    created_at: new Date().toISOString()
  });
  fs.writeFileSync(JSON_DB_PATH, JSON.stringify(localState, null, 2));
}

// Function to save state to file
const saveLocalState = () => {
  try {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(localState, null, 2));
  } catch (err) {
    console.error('Error saving JSON DB fallback', err);
  }
};

// PostgreSQL configuration setup
const { Pool } = pg;
let pgPool: pg.Pool | null = null;
let usePostgres = false;

const isProd = process.env.NODE_ENV === 'production';
const hasAnyDbEnv = !!(process.env.DB_HOST || process.env.DB_USER || process.env.DB_PASSWORD || process.env.DB_NAME);

if (isProd || hasAnyDbEnv) {
  // Validate that all required db configurations are set
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    const missing = [];
    if (!process.env.DB_HOST) missing.push('DB_HOST');
    if (!process.env.DB_USER) missing.push('DB_USER');
    if (!process.env.DB_PASSWORD) missing.push('DB_PASSWORD');
    if (!process.env.DB_NAME) missing.push('DB_NAME');
    const errMsg = `CRITICAL: PostgreSQL configuration is expected but incomplete. Missing environment variables: ${missing.join(', ')}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }

  try {
    pgPool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Manage pool error event listener to support seamless reconnect handling
    pgPool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error] Unexpected idle client error:', err);
    });

    usePostgres = true;
    console.log('PostgreSQL configuration successfully loaded. Connection pool initialized.');
  } catch (err) {
    console.error('CRITICAL: Failed to create PostgreSQL connection pool:', err);
    throw err;
  }
} else {
  console.log('Running in local/dev fallback mode. PostgreSQL variables not set. Using secure local file-system persistence (data/db.json).');
}

// Database helper functions supporting both real Postgres and persistent JSON Fallback
export const db = {
  // Initialize Database tables if PostgreSQL is connected
  init: async () => {
    if (!usePostgres || !pgPool) return;
    try {
      const client = await pgPool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'enabled';
          ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_stream_id VARCHAR(50);
          ALTER TABLE users ADD COLUMN IF NOT EXISTS login_history TEXT;

          CREATE TABLE IF NOT EXISTS streams (
            id VARCHAR(50) PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            broadcaster VARCHAR(100) NOT NULL,
            stream_key VARCHAR(100) UNIQUE NOT NULL,
            status VARCHAR(50) DEFAULT 'offline',
            scheduled_start TIMESTAMP,
            rtmp_url VARCHAR(255) NOT NULL,
            resolution VARCHAR(20) DEFAULT '1080p',
            bitrate INTEGER DEFAULT 4500,
            codec VARCHAR(20) DEFAULT 'H.264',
            ingest_ip VARCHAR(50) NOT NULL,
            viewers INTEGER DEFAULT 0,
            start_time TIMESTAMP
          );

          ALTER TABLE streams ADD COLUMN IF NOT EXISTS width INTEGER;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS height INTEGER;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS fps INTEGER;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(50);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS video_codec VARCHAR(50);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_codec VARCHAR(50);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS preset VARCHAR(50);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS profile VARCHAR(50);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS pixel_format VARCHAR(50);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS enabled_profiles VARCHAR(255);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS gop_size INTEGER;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS buffer_size INTEGER;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS max_bitrate INTEGER;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS scaling_algorithm VARCHAR(50);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_enabled BOOLEAN DEFAULT TRUE;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_bitrate VARCHAR(50);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_sample_rate INTEGER;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_channels VARCHAR(50);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_volume INTEGER DEFAULT 100;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_normalize BOOLEAN DEFAULT FALSE;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_noise_reduction BOOLEAN DEFAULT FALSE;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_delay INTEGER DEFAULT 0;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_language VARCHAR(50);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_track_selection VARCHAR(50);
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_passthrough BOOLEAN DEFAULT FALSE;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS audio_transcoding BOOLEAN DEFAULT TRUE;
          ALTER TABLE streams ADD COLUMN IF NOT EXISTS profiles_json TEXT;

          CREATE TABLE IF NOT EXISTS devices (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            location VARCHAR(100),
            description VARCHAR(255),
            os_version VARCHAR(50),
            player_version VARCHAR(50),
            ip_address VARCHAR(50),
            mac_address VARCHAR(50),
            last_seen TIMESTAMP,
            online_status VARCHAR(50) DEFAULT 'offline',
            current_stream_id VARCHAR(50),
            current_stream_url VARCHAR(255),
            current_resolution VARCHAR(50),
            current_volume INTEGER DEFAULT 100,
            current_playback_status VARCHAR(50),
            pairing_code VARCHAR(20),
            paired BOOLEAN DEFAULT FALSE,
            token VARCHAR(255),
            cpu_usage DOUBLE PRECISION,
            ram_usage DOUBLE PRECISION,
            temperature DOUBLE PRECISION,
            network_speed VARCHAR(50),
            screenshot_url VARCHAR(255),
            screenshot_time TIMESTAMP,
            brightness INTEGER DEFAULT 100,
            rotation VARCHAR(20) DEFAULT '0',
            player_settings TEXT,
            network_settings TEXT,
            client_version VARCHAR(50) DEFAULT '1.0.0'
          );

          ALTER TABLE devices ADD COLUMN IF NOT EXISTS brightness INTEGER DEFAULT 100;
          ALTER TABLE devices ADD COLUMN IF NOT EXISTS rotation VARCHAR(20) DEFAULT '0';
          ALTER TABLE devices ADD COLUMN IF NOT EXISTS player_settings TEXT;
          ALTER TABLE devices ADD COLUMN IF NOT EXISTS network_settings TEXT;
          ALTER TABLE devices ADD COLUMN IF NOT EXISTS client_version VARCHAR(50) DEFAULT '1.0.0';

          CREATE TABLE IF NOT EXISTS device_groups (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(255)
          );

          CREATE TABLE IF NOT EXISTS device_group_members (
            group_id VARCHAR(50) REFERENCES device_groups(id) ON DELETE CASCADE,
            device_id VARCHAR(50) REFERENCES devices(id) ON DELETE CASCADE,
            PRIMARY KEY (group_id, device_id)
          );

          CREATE TABLE IF NOT EXISTS playback_history (
            id VARCHAR(50) PRIMARY KEY,
            device_id VARCHAR(50) REFERENCES devices(id) ON DELETE CASCADE,
            stream_id VARCHAR(50),
            stream_url VARCHAR(255),
            action VARCHAR(50),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS device_logs (
            id VARCHAR(50) PRIMARY KEY,
            device_id VARCHAR(50) REFERENCES devices(id) ON DELETE CASCADE,
            level VARCHAR(20) DEFAULT 'info',
            message TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS device_schedules (
            id VARCHAR(50) PRIMARY KEY,
            device_id VARCHAR(50) REFERENCES devices(id) ON DELETE CASCADE,
            group_id VARCHAR(50) REFERENCES device_groups(id) ON DELETE CASCADE,
            time VARCHAR(10) NOT NULL,
            action VARCHAR(20) NOT NULL,
            stream_id VARCHAR(50),
            stream_url VARCHAR(255),
            enabled BOOLEAN DEFAULT TRUE
          );
        `);
        console.log('PostgreSQL Database tables verified/created successfully.');
        
        // Seed default admin if table is empty
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        if (parseInt(userCount.rows[0].count, 10) === 0) {
          await client.query(`
            INSERT INTO users (username, email, password_hash, role)
            VALUES ('admin', 'admin@streampulse.io', '$2a$10$Xm3C0H5gLqGz7uB7wF8pZeGbyhS6F1mP689S5fV/M4V8L5Yn4O7yW', 'admin')
          `);
          console.log('Seeded default admin account into PostgreSQL.');
        }
      } finally {
        client.release();
      }
    } catch (err) {
      const isProd = process.env.NODE_ENV === 'production';
      const hasAnyDbEnv = !!(process.env.DB_HOST || process.env.DB_USER || process.env.DB_PASSWORD || process.env.DB_NAME);
      if (isProd || hasAnyDbEnv) {
        console.error('CRITICAL DATABASE ERROR: PostgreSQL initialization failed in production/configured mode.', err);
        throw err;
      } else {
        console.warn('Error initializing PostgreSQL database, switching to local file fallback:', err);
        usePostgres = false;
      }
    }
  },

  // USERS
  getUserByUsername: async (username: string): Promise<UserRecord | null> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('SELECT * FROM users WHERE username = $1', [username]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        username: r.username,
        email: r.email,
        password_hash: r.password_hash,
        role: r.role,
        created_at: r.created_at.toISOString(),
        status: r.status || 'enabled',
        assigned_stream_id: r.assigned_stream_id || null,
        login_history: r.login_history || null
      };
    }
    const user = localState.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    return user || null;
  },

  getUserById: async (id: number): Promise<UserRecord | null> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        username: r.username,
        email: r.email,
        password_hash: r.password_hash,
        role: r.role,
        created_at: r.created_at.toISOString(),
        status: r.status || 'enabled',
        assigned_stream_id: r.assigned_stream_id || null,
        login_history: r.login_history || null
      };
    }
    return localState.users.find(u => u.id === id) || null;
  },

  getUsers: async (): Promise<UserRecord[]> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('SELECT * FROM users ORDER BY username ASC');
      return res.rows.map(r => ({
        id: r.id,
        username: r.username,
        email: r.email,
        password_hash: r.password_hash,
        role: r.role,
        created_at: r.created_at.toISOString(),
        status: r.status || 'enabled',
        assigned_stream_id: r.assigned_stream_id || null,
        login_history: r.login_history || null
      }));
    }
    return localState.users;
  },

  createUser: async (username: string, email: string, passwordHash: string, role: 'admin' | 'user' = 'user'): Promise<UserRecord> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query(
        'INSERT INTO users (username, email, password_hash, role, status, assigned_stream_id, login_history) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [username, email, passwordHash, role, 'enabled', null, null]
      );
      const r = res.rows[0];
      return {
        id: r.id,
        username: r.username,
        email: r.email,
        password_hash: r.password_hash,
        role: r.role,
        created_at: r.created_at.toISOString(),
        status: r.status || 'enabled',
        assigned_stream_id: r.assigned_stream_id || null,
        login_history: r.login_history || null
      };
    }
    const newUser: UserRecord = {
      id: localState.users.length > 0 ? Math.max(...localState.users.map(u => u.id)) + 1 : 1,
      username,
      email,
      password_hash: passwordHash,
      role,
      created_at: new Date().toISOString(),
      status: 'enabled',
      assigned_stream_id: null,
      login_history: null
    };
    localState.users.push(newUser);
    saveLocalState();
    return newUser;
  },

  updateUser: async (id: number, updates: Partial<UserRecord>): Promise<UserRecord | null> => {
    if (usePostgres && pgPool) {
      const keys = Object.keys(updates);
      if (keys.length === 0) return null;

      const setClause = keys.map((key, index) => {
        const pgKey = key === 'password_hash' ? 'password_hash' :
                      key === 'assigned_stream_id' ? 'assigned_stream_id' :
                      key === 'login_history' ? 'login_history' : key;
        return `${pgKey} = $${index + 2}`;
      }).join(', ');

      const vals = keys.map(k => (updates as any)[k]);
      await pgPool.query(`UPDATE users SET ${setClause} WHERE id = $1`, [id, ...vals]);
      const res = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        username: r.username,
        email: r.email,
        password_hash: r.password_hash,
        role: r.role,
        created_at: r.created_at.toISOString(),
        status: r.status || 'enabled',
        assigned_stream_id: r.assigned_stream_id || null,
        login_history: r.login_history || null
      };
    }

    const index = localState.users.findIndex(u => u.id === id);
    if (index === -1) return null;
    localState.users[index] = { ...localState.users[index], ...updates };
    saveLocalState();
    return localState.users[index];
  },

  deleteUser: async (id: number): Promise<boolean> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('DELETE FROM users WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    }
    const lenBefore = localState.users.length;
    localState.users = localState.users.filter(u => u.id !== id);
    if (localState.users.length !== lenBefore) {
      saveLocalState();
      return true;
    }
    return false;
  },

  recordUserLogin: async (userId: number, ip: string): Promise<void> => {
    const timestamp = new Date().toISOString();
    const loginRecord = { timestamp, ip };

    let currentHistoryRaw: string | null = null;
    if (usePostgres && pgPool) {
      const res = await pgPool.query('SELECT login_history FROM users WHERE id = $1', [userId]);
      if (res.rows.length > 0) {
        currentHistoryRaw = res.rows[0].login_history;
      }
    } else {
      const user = localState.users.find(u => u.id === userId);
      if (user) {
        currentHistoryRaw = user.login_history || null;
      }
    }

    let historyList: any[] = [];
    if (currentHistoryRaw) {
      try {
        historyList = JSON.parse(currentHistoryRaw);
        if (!Array.isArray(historyList)) {
          historyList = [];
        }
      } catch (e) {
        historyList = [];
      }
    }
    historyList.unshift(loginRecord);
    if (historyList.length > 50) {
      historyList = historyList.slice(0, 50);
    }

    const updatedHistoryRaw = JSON.stringify(historyList);
    if (usePostgres && pgPool) {
      await pgPool.query('UPDATE users SET login_history = $1 WHERE id = $2', [updatedHistoryRaw, userId]);
    } else {
      const index = localState.users.findIndex(u => u.id === userId);
      if (index !== -1) {
        localState.users[index].login_history = updatedHistoryRaw;
        saveLocalState();
      }
    }
  },

  // STREAMS
  getStreams: async (): Promise<StreamRecord[]> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('SELECT * FROM streams ORDER BY start_time DESC, id DESC');
      return res.rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        title: r.title,
        broadcaster: r.broadcaster,
        streamKey: r.stream_key,
        status: r.status,
        scheduledStart: r.scheduled_start ? r.scheduled_start.toISOString() : undefined,
        rtmpUrl: r.rtmp_url,
        resolution: r.resolution,
        bitrate: r.bitrate,
        codec: r.codec,
        ingestIp: r.ingest_ip,
        viewers: r.viewers,
        startTime: r.start_time ? r.start_time.toISOString() : undefined,
        width: r.width,
        height: r.height,
        fps: r.fps,
        aspectRatio: r.aspect_ratio,
        videoCodec: r.video_codec,
        audioCodec: r.audio_codec,
        preset: r.preset,
        profile: r.profile,
        pixelFormat: r.pixel_format,
        enabledProfiles: r.enabled_profiles,
        gopSize: r.gop_size,
        bufferSize: r.buffer_size,
        maxBitrate: r.max_bitrate,
        scalingAlgorithm: r.scaling_algorithm,
        audioEnabled: r.audio_enabled,
        audioBitrate: r.audio_bitrate,
        audioSampleRate: r.audio_sample_rate,
        audioChannels: r.audio_channels,
        audioVolume: r.audio_volume,
        audioNormalize: r.audio_normalize,
        audioNoiseReduction: r.audio_noise_reduction,
        audioDelay: r.audio_delay,
        audioLanguage: r.audio_language,
        audioTrackSelection: r.audio_track_selection,
        audioPassthrough: r.audio_passthrough,
        audioTranscoding: r.audio_transcoding,
        profilesJson: r.profiles_json
      }));
    }
    return localState.streams;
  },

  getStreamByKey: async (streamKey: string): Promise<StreamRecord | null> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('SELECT * FROM streams WHERE stream_key = $1', [streamKey]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        userId: r.user_id,
        title: r.title,
        broadcaster: r.broadcaster,
        streamKey: r.stream_key,
        status: r.status,
        scheduledStart: r.scheduled_start ? r.scheduled_start.toISOString() : undefined,
        rtmpUrl: r.rtmp_url,
        resolution: r.resolution,
        bitrate: r.bitrate,
        codec: r.codec,
        ingestIp: r.ingest_ip,
        viewers: r.viewers,
        startTime: r.start_time ? r.start_time.toISOString() : undefined,
        width: r.width,
        height: r.height,
        fps: r.fps,
        aspectRatio: r.aspect_ratio,
        videoCodec: r.video_codec,
        audioCodec: r.audio_codec,
        preset: r.preset,
        profile: r.profile,
        pixelFormat: r.pixel_format,
        enabledProfiles: r.enabled_profiles,
        gopSize: r.gop_size,
        bufferSize: r.buffer_size,
        maxBitrate: r.max_bitrate,
        scalingAlgorithm: r.scaling_algorithm,
        audioEnabled: r.audio_enabled,
        audioBitrate: r.audio_bitrate,
        audioSampleRate: r.audio_sample_rate,
        audioChannels: r.audio_channels,
        audioVolume: r.audio_volume,
        audioNormalize: r.audio_normalize,
        audioNoiseReduction: r.audio_noise_reduction,
        audioDelay: r.audio_delay,
        audioLanguage: r.audio_language,
        audioTrackSelection: r.audio_track_selection,
        audioPassthrough: r.audio_passthrough,
        audioTranscoding: r.audio_transcoding,
        profilesJson: r.profiles_json
      };
    }
    return localState.streams.find(s => s.streamKey === streamKey) || null;
  },

  createStream: async (stream: Omit<StreamRecord, 'id' | 'viewers'>): Promise<StreamRecord> => {
    const id = Math.random().toString(36).substring(2, 11);
    if (usePostgres && pgPool) {
      await pgPool.query(
        `INSERT INTO streams 
         (id, user_id, title, broadcaster, stream_key, status, scheduled_start, rtmp_url, resolution, bitrate, codec, ingest_ip, viewers, start_time, width, height, fps, aspect_ratio, video_codec, audio_codec, preset, profile, pixel_format, enabled_profiles) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
        [
          id,
          stream.userId,
          stream.title,
          stream.broadcaster,
          stream.streamKey,
          stream.status,
          stream.scheduledStart ? new Date(stream.scheduledStart) : null,
          stream.rtmpUrl,
          stream.resolution,
          stream.bitrate,
          stream.codec,
          stream.ingestIp,
          0,
          stream.startTime ? new Date(stream.startTime) : null,
          stream.width ?? null,
          stream.height ?? null,
          stream.fps ?? null,
          stream.aspectRatio ?? null,
          stream.videoCodec ?? null,
          stream.audioCodec ?? null,
          stream.preset ?? null,
          stream.profile ?? null,
          stream.pixelFormat ?? null,
          stream.enabledProfiles ?? null
        ]
      );
      return { ...stream, id, viewers: 0 };
    }
    const newStream: StreamRecord = { ...stream, id, viewers: 0 };
    localState.streams.unshift(newStream);
    saveLocalState();
    return newStream;
  },

  updateStream: async (id: string, updates: Partial<StreamRecord>): Promise<StreamRecord | null> => {
    if (usePostgres && pgPool) {
      // Formulate dynamic SQL query
      const keys = Object.keys(updates);
      if (keys.length === 0) return null;
      
      const setClause = keys.map((key, index) => {
        const pgKey = key === 'userId' ? 'user_id' :
                      key === 'streamKey' ? 'stream_key' :
                      key === 'scheduledStart' ? 'scheduled_start' :
                      key === 'rtmpUrl' ? 'rtmp_url' :
                      key === 'ingestIp' ? 'ingest_ip' :
                      key === 'startTime' ? 'start_time' : key.replace(/([A-Z])/g, "_$1").toLowerCase();
        return `${pgKey} = $${index + 2}`;
      }).join(', ');

      const vals = keys.map(k => {
        const val = (updates as any)[k];
        if (k === 'startTime' || k === 'scheduledStart') {
          return val ? new Date(val) : null;
        }
        return val;
      });

      await pgPool.query(`UPDATE streams SET ${setClause} WHERE id = $1`, [id, ...vals]);
      const res = await pgPool.query('SELECT * FROM streams WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        userId: r.user_id,
        title: r.title,
        broadcaster: r.broadcaster,
        streamKey: r.stream_key,
        status: r.status,
        scheduledStart: r.scheduled_start ? r.scheduled_start.toISOString() : undefined,
        rtmpUrl: r.rtmp_url,
        resolution: r.resolution,
        bitrate: r.bitrate,
        codec: r.codec,
        ingestIp: r.ingest_ip,
        viewers: r.viewers,
        startTime: r.start_time ? r.start_time.toISOString() : undefined,
        width: r.width,
        height: r.height,
        fps: r.fps,
        aspectRatio: r.aspect_ratio,
        videoCodec: r.video_codec,
        audioCodec: r.audio_codec,
        preset: r.preset,
        profile: r.profile,
        pixelFormat: r.pixel_format,
        enabledProfiles: r.enabled_profiles,
        gopSize: r.gop_size,
        bufferSize: r.buffer_size,
        maxBitrate: r.max_bitrate,
        scalingAlgorithm: r.scaling_algorithm,
        audioEnabled: r.audio_enabled,
        audioBitrate: r.audio_bitrate,
        audioSampleRate: r.audio_sample_rate,
        audioChannels: r.audio_channels,
        audioVolume: r.audio_volume,
        audioNormalize: r.audio_normalize,
        audioNoiseReduction: r.audio_noise_reduction,
        audioDelay: r.audio_delay,
        audioLanguage: r.audio_language,
        audioTrackSelection: r.audio_track_selection,
        audioPassthrough: r.audio_passthrough,
        audioTranscoding: r.audio_transcoding,
        profilesJson: r.profiles_json
      };
    }

    const index = localState.streams.findIndex(s => s.id === id);
    if (index === -1) return null;
    localState.streams[index] = { ...localState.streams[index], ...updates };
    saveLocalState();
    return localState.streams[index];
  },

  deleteStream: async (id: string): Promise<boolean> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('DELETE FROM streams WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    }
    const initialLen = localState.streams.length;
    localState.streams = localState.streams.filter(s => s.id !== id);
    if (localState.streams.length !== initialLen) {
      saveLocalState();
      return true;
    }
    return false;
  },

  // --- DEVICES ---
  getDevices: async (): Promise<DeviceRecord[]> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('SELECT * FROM devices ORDER BY name ASC');
      return res.rows.map(r => ({
        id: r.id,
        name: r.name,
        location: r.location,
        description: r.description,
        os_version: r.os_version,
        player_version: r.player_version,
        ip_address: r.ip_address,
        mac_address: r.mac_address,
        last_seen: r.last_seen ? r.last_seen.toISOString() : undefined,
        online_status: r.online_status,
        current_stream_id: r.current_stream_id,
        current_stream_url: r.current_stream_url,
        current_resolution: r.current_resolution,
        current_volume: r.current_volume,
        current_playback_status: r.current_playback_status,
        pairing_code: r.pairing_code,
        paired: r.paired,
        token: r.token,
        cpu_usage: r.cpu_usage,
        ram_usage: r.ram_usage,
        temperature: r.temperature,
        network_speed: r.network_speed,
        screenshot_url: r.screenshot_url,
        screenshot_time: r.screenshot_time ? r.screenshot_time.toISOString() : undefined,
        brightness: r.brightness,
        rotation: r.rotation,
        player_settings: r.player_settings,
        network_settings: r.network_settings,
        client_version: r.client_version
      }));
    }
    return localState.devices;
  },

  getDevice: async (id: string): Promise<DeviceRecord | null> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('SELECT * FROM devices WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        name: r.name,
        location: r.location,
        description: r.description,
        os_version: r.os_version,
        player_version: r.player_version,
        ip_address: r.ip_address,
        mac_address: r.mac_address,
        last_seen: r.last_seen ? r.last_seen.toISOString() : undefined,
        online_status: r.online_status,
        current_stream_id: r.current_stream_id,
        current_stream_url: r.current_stream_url,
        current_resolution: r.current_resolution,
        current_volume: r.current_volume,
        current_playback_status: r.current_playback_status,
        pairing_code: r.pairing_code,
        paired: r.paired,
        token: r.token,
        cpu_usage: r.cpu_usage,
        ram_usage: r.ram_usage,
        temperature: r.temperature,
        network_speed: r.network_speed,
        screenshot_url: r.screenshot_url,
        screenshot_time: r.screenshot_time ? r.screenshot_time.toISOString() : undefined,
        brightness: r.brightness,
        rotation: r.rotation,
        player_settings: r.player_settings,
        network_settings: r.network_settings,
        client_version: r.client_version
      };
    }
    return localState.devices.find(d => d.id === id) || null;
  },

  getDeviceByPairingCode: async (code: string): Promise<DeviceRecord | null> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('SELECT * FROM devices WHERE pairing_code = $1', [code]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        name: r.name,
        location: r.location,
        description: r.description,
        os_version: r.os_version,
        player_version: r.player_version,
        ip_address: r.ip_address,
        mac_address: r.mac_address,
        last_seen: r.last_seen ? r.last_seen.toISOString() : undefined,
        online_status: r.online_status,
        current_stream_id: r.current_stream_id,
        current_stream_url: r.current_stream_url,
        current_resolution: r.current_resolution,
        current_volume: r.current_volume,
        current_playback_status: r.current_playback_status,
        pairing_code: r.pairing_code,
        paired: r.paired,
        token: r.token,
        cpu_usage: r.cpu_usage,
        ram_usage: r.ram_usage,
        temperature: r.temperature,
        network_speed: r.network_speed,
        screenshot_url: r.screenshot_url,
        screenshot_time: r.screenshot_time ? r.screenshot_time.toISOString() : undefined,
        brightness: r.brightness,
        rotation: r.rotation,
        player_settings: r.player_settings,
        network_settings: r.network_settings,
        client_version: r.client_version
      };
    }
    return localState.devices.find(d => d.pairing_code === code) || null;
  },

  getDeviceByToken: async (token: string): Promise<DeviceRecord | null> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('SELECT * FROM devices WHERE token = $1', [token]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        name: r.name,
        location: r.location,
        description: r.description,
        os_version: r.os_version,
        player_version: r.player_version,
        ip_address: r.ip_address,
        mac_address: r.mac_address,
        last_seen: r.last_seen ? r.last_seen.toISOString() : undefined,
        online_status: r.online_status,
        current_stream_id: r.current_stream_id,
        current_stream_url: r.current_stream_url,
        current_resolution: r.current_resolution,
        current_volume: r.current_volume,
        current_playback_status: r.current_playback_status,
        pairing_code: r.pairing_code,
        paired: r.paired,
        token: r.token,
        cpu_usage: r.cpu_usage,
        ram_usage: r.ram_usage,
        temperature: r.temperature,
        network_speed: r.network_speed,
        screenshot_url: r.screenshot_url,
        screenshot_time: r.screenshot_time ? r.screenshot_time.toISOString() : undefined,
        brightness: r.brightness,
        rotation: r.rotation,
        player_settings: r.player_settings,
        network_settings: r.network_settings,
        client_version: r.client_version
      };
    }
    return localState.devices.find(d => d.token === token) || null;
  },

   createDevice: async (device: Omit<DeviceRecord, 'id'>): Promise<DeviceRecord> => {
    const id = 'device_' + Math.random().toString(36).substring(2, 11);
    if (usePostgres && pgPool) {
      await pgPool.query(
        `INSERT INTO devices 
         (id, name, location, description, os_version, player_version, ip_address, mac_address, last_seen, online_status, current_stream_id, current_stream_url, current_resolution, current_volume, current_playback_status, pairing_code, paired, token, cpu_usage, ram_usage, temperature, network_speed, screenshot_url, screenshot_time, brightness, rotation, player_settings, network_settings, client_version) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)`,
        [
          id,
          device.name,
          device.location || null,
          device.description || null,
          device.os_version || null,
          device.player_version || null,
          device.ip_address || null,
          device.mac_address || null,
          device.last_seen ? new Date(device.last_seen) : null,
          device.online_status,
          device.current_stream_id || null,
          device.current_stream_url || null,
          device.current_resolution || null,
          device.current_volume,
          device.current_playback_status || null,
          device.pairing_code || null,
          device.paired,
          device.token || null,
          device.cpu_usage || null,
          device.ram_usage || null,
          device.temperature || null,
          device.network_speed || null,
          device.screenshot_url || null,
          device.screenshot_time ? new Date(device.screenshot_time) : null,
          device.brightness ?? 100,
          device.rotation ?? '0',
          device.player_settings || null,
          device.network_settings || null,
          device.client_version || '1.0.0'
        ]
      );
      return { ...device, id };
    }
    const newDevice: DeviceRecord = { ...device, id };
    localState.devices.push(newDevice);
    saveLocalState();
    return newDevice;
  },

  updateDevice: async (id: string, updates: Partial<DeviceRecord>): Promise<DeviceRecord | null> => {
    if (usePostgres && pgPool) {
      const keys = Object.keys(updates);
      if (keys.length === 0) return null;

      const setClause = keys.map((key, index) => {
        return `${key} = $${index + 2}`;
      }).join(', ');

      const vals = keys.map(k => {
        const val = (updates as any)[k];
        if (k === 'last_seen' || k === 'screenshot_time') {
          return val ? new Date(val) : null;
        }
        return val;
      });

      await pgPool.query(`UPDATE devices SET ${setClause} WHERE id = $1`, [id, ...vals]);
      const res = await pgPool.query('SELECT * FROM devices WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        name: r.name,
        location: r.location,
        description: r.description,
        os_version: r.os_version,
        player_version: r.player_version,
        ip_address: r.ip_address,
        mac_address: r.mac_address,
        last_seen: r.last_seen ? r.last_seen.toISOString() : undefined,
        online_status: r.online_status,
        current_stream_id: r.current_stream_id,
        current_stream_url: r.current_stream_url,
        current_resolution: r.current_resolution,
        current_volume: r.current_volume,
        current_playback_status: r.current_playback_status,
        pairing_code: r.pairing_code,
        paired: r.paired,
        token: r.token,
        cpu_usage: r.cpu_usage,
        ram_usage: r.ram_usage,
        temperature: r.temperature,
        network_speed: r.network_speed,
        screenshot_url: r.screenshot_url,
        screenshot_time: r.screenshot_time ? r.screenshot_time.toISOString() : undefined,
        brightness: r.brightness,
        rotation: r.rotation,
        player_settings: r.player_settings,
        network_settings: r.network_settings,
        client_version: r.client_version
      };
    }

    const index = localState.devices.findIndex(d => d.id === id);
    if (index === -1) return null;
    localState.devices[index] = { ...localState.devices[index], ...updates };
    saveLocalState();
    return localState.devices[index];
  },

  deleteDevice: async (id: string): Promise<boolean> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('DELETE FROM devices WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    }
    const initialLen = localState.devices.length;
    localState.devices = localState.devices.filter(d => d.id !== id);
    if (localState.devices.length !== initialLen) {
      saveLocalState();
      return true;
    }
    return false;
  },

  // --- DEVICE GROUPS ---
  getDeviceGroups: async (): Promise<DeviceGroupRecord[]> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('SELECT * FROM device_groups ORDER BY name ASC');
      return res.rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description
      }));
    }
    return localState.deviceGroups;
  },

  createDeviceGroup: async (group: Omit<DeviceGroupRecord, 'id'>): Promise<DeviceGroupRecord> => {
    const id = 'group_' + Math.random().toString(36).substring(2, 11);
    if (usePostgres && pgPool) {
      await pgPool.query(
        'INSERT INTO device_groups (id, name, description) VALUES ($1, $2, $3)',
        [id, group.name, group.description || null]
      );
      return { ...group, id };
    }
    const newGroup = { ...group, id };
    localState.deviceGroups.push(newGroup);
    saveLocalState();
    return newGroup;
  },

  updateDeviceGroup: async (id: string, updates: Partial<DeviceGroupRecord>): Promise<DeviceGroupRecord | null> => {
    if (usePostgres && pgPool) {
      const keys = Object.keys(updates);
      if (keys.length === 0) return null;

      const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
      const vals = keys.map(k => (updates as any)[k]);

      await pgPool.query(`UPDATE device_groups SET ${setClause} WHERE id = $1`, [id, ...vals]);
      const res = await pgPool.query('SELECT * FROM device_groups WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;
      return res.rows[0];
    }
    const idx = localState.deviceGroups.findIndex(g => g.id === id);
    if (idx === -1) return null;
    localState.deviceGroups[idx] = { ...localState.deviceGroups[idx], ...updates };
    saveLocalState();
    return localState.deviceGroups[idx];
  },

  deleteDeviceGroup: async (id: string): Promise<boolean> => {
    if (usePostgres && pgPool) {
      await pgPool.query('DELETE FROM device_groups WHERE id = $1', [id]);
      return true;
    }
    const initialLen = localState.deviceGroups.length;
    localState.deviceGroups = localState.deviceGroups.filter(g => g.id !== id);
    localState.deviceGroupMembers = localState.deviceGroupMembers.filter(m => m.group_id !== id);
    localState.deviceSchedules = localState.deviceSchedules.filter(s => s.group_id !== id);
    if (localState.deviceGroups.length !== initialLen) {
      saveLocalState();
      return true;
    }
    return false;
  },

  getGroupDevices: async (groupId: string): Promise<DeviceRecord[]> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query(
        `SELECT d.* FROM devices d 
         JOIN device_group_members m ON d.id = m.device_id 
         WHERE m.group_id = $1 ORDER BY d.name ASC`,
        [groupId]
      );
      return res.rows.map(r => ({
        id: r.id,
        name: r.name,
        location: r.location,
        description: r.description,
        os_version: r.os_version,
        player_version: r.player_version,
        ip_address: r.ip_address,
        mac_address: r.mac_address,
        last_seen: r.last_seen ? r.last_seen.toISOString() : undefined,
        online_status: r.online_status,
        current_stream_id: r.current_stream_id,
        current_stream_url: r.current_stream_url,
        current_resolution: r.current_resolution,
        current_volume: r.current_volume,
        current_playback_status: r.current_playback_status,
        pairing_code: r.pairing_code,
        paired: r.paired,
        token: r.token,
        cpu_usage: r.cpu_usage,
        ram_usage: r.ram_usage,
        temperature: r.temperature,
        network_speed: r.network_speed,
        screenshot_url: r.screenshot_url,
        screenshot_time: r.screenshot_time ? r.screenshot_time.toISOString() : undefined,
        brightness: r.brightness,
        rotation: r.rotation,
        player_settings: r.player_settings,
        network_settings: r.network_settings,
        client_version: r.client_version
      }));
    }
    const memberIds = localState.deviceGroupMembers
      .filter(m => m.group_id === groupId)
      .map(m => m.device_id);
    return localState.devices.filter(d => memberIds.includes(d.id));
  },

  addDeviceToGroup: async (groupId: string, deviceId: string): Promise<boolean> => {
    if (usePostgres && pgPool) {
      try {
        await pgPool.query(
          'INSERT INTO device_group_members (group_id, device_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [groupId, deviceId]
        );
        return true;
      } catch (e) {
        return false;
      }
    }
    const exists = localState.deviceGroupMembers.some(m => m.group_id === groupId && m.device_id === deviceId);
    if (!exists) {
      localState.deviceGroupMembers.push({ group_id: groupId, device_id: deviceId });
      saveLocalState();
    }
    return true;
  },

  removeDeviceFromGroup: async (groupId: string, deviceId: string): Promise<boolean> => {
    if (usePostgres && pgPool) {
      await pgPool.query(
        'DELETE FROM device_group_members WHERE group_id = $1 AND device_id = $2',
        [groupId, deviceId]
      );
      return true;
    }
    localState.deviceGroupMembers = localState.deviceGroupMembers.filter(m => !(m.group_id === groupId && m.device_id === deviceId));
    saveLocalState();
    return true;
  },

  // --- PLAYBACK HISTORY ---
  getPlaybackHistory: async (deviceId?: string): Promise<PlaybackHistoryRecord[]> => {
    if (usePostgres && pgPool) {
      const q = deviceId 
        ? ['SELECT * FROM playback_history WHERE device_id = $1 ORDER BY timestamp DESC LIMIT 100', [deviceId]]
        : ['SELECT * FROM playback_history ORDER BY timestamp DESC LIMIT 200', []];
      const res = await pgPool.query(q[0] as string, q[1] as any[]);
      return res.rows.map(r => ({
        id: r.id,
        device_id: r.device_id,
        stream_id: r.stream_id,
        stream_url: r.stream_url,
        action: r.action,
        timestamp: r.timestamp.toISOString()
      }));
    }
    let hist = localState.playbackHistory;
    if (deviceId) {
      hist = hist.filter(h => h.device_id === deviceId);
    }
    return hist.slice(0, 100);
  },

  addPlaybackHistory: async (history: Omit<PlaybackHistoryRecord, 'id' | 'timestamp'>): Promise<PlaybackHistoryRecord> => {
    const id = 'hist_' + Math.random().toString(36).substring(2, 11);
    const timestamp = new Date().toISOString();
    if (usePostgres && pgPool) {
      await pgPool.query(
        'INSERT INTO playback_history (id, device_id, stream_id, stream_url, action, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, history.device_id, history.stream_id || null, history.stream_url || null, history.action, new Date(timestamp)]
      );
      return { ...history, id, timestamp };
    }
    const newHist = { ...history, id, timestamp };
    localState.playbackHistory.unshift(newHist);
    if (localState.playbackHistory.length > 500) {
      localState.playbackHistory = localState.playbackHistory.slice(0, 500);
    }
    saveLocalState();
    return newHist;
  },

  // --- DEVICE LOGS ---
  getDeviceLogs: async (deviceId?: string): Promise<DeviceLogRecord[]> => {
    if (usePostgres && pgPool) {
      const q = deviceId
        ? ['SELECT * FROM device_logs WHERE device_id = $1 ORDER BY timestamp DESC LIMIT 100', [deviceId]]
        : ['SELECT * FROM device_logs ORDER BY timestamp DESC LIMIT 200', []];
      const res = await pgPool.query(q[0] as string, q[1] as any[]);
      return res.rows.map(r => ({
        id: r.id,
        device_id: r.device_id,
        level: r.level,
        message: r.message,
        timestamp: r.timestamp.toISOString()
      }));
    }
    let logs = localState.deviceLogs;
    if (deviceId) {
      logs = logs.filter(l => l.device_id === deviceId);
    }
    return logs.slice(0, 100);
  },

  addDeviceLog: async (deviceId: string, level: 'info' | 'warn' | 'error', message: string): Promise<DeviceLogRecord> => {
    const id = 'log_' + Math.random().toString(36).substring(2, 11);
    const timestamp = new Date().toISOString();
    if (usePostgres && pgPool) {
      await pgPool.query(
        'INSERT INTO device_logs (id, device_id, level, message, timestamp) VALUES ($1, $2, $3, $4, $5)',
        [id, deviceId, level, message, new Date(timestamp)]
      );
      return { id, device_id: deviceId, level, message, timestamp };
    }
    const newLog = { id, device_id: deviceId, level, message, timestamp };
    localState.deviceLogs.unshift(newLog);
    if (localState.deviceLogs.length > 500) {
      localState.deviceLogs = localState.deviceLogs.slice(0, 500);
    }
    saveLocalState();
    return newLog;
  },

  // --- DEVICE SCHEDULES ---
  getDeviceSchedules: async (deviceId?: string, groupId?: string): Promise<DeviceScheduleRecord[]> => {
    if (usePostgres && pgPool) {
      let q = 'SELECT * FROM device_schedules WHERE enabled = TRUE';
      const params = [];
      if (deviceId) {
        q += ' AND device_id = $1';
        params.push(deviceId);
      } else if (groupId) {
        q += ' AND group_id = $1';
        params.push(groupId);
      }
      const res = await pgPool.query(q, params);
      return res.rows.map(r => ({
        id: r.id,
        device_id: r.device_id,
        group_id: r.group_id,
        time: r.time,
        action: r.action,
        stream_id: r.stream_id,
        stream_url: r.stream_url,
        enabled: r.enabled
      }));
    }
    let scheds = localState.deviceSchedules;
    if (deviceId) {
      scheds = scheds.filter(s => s.device_id === deviceId);
    } else if (groupId) {
      scheds = scheds.filter(s => s.group_id === groupId);
    }
    return scheds;
  },

  createDeviceSchedule: async (sched: Omit<DeviceScheduleRecord, 'id'>): Promise<DeviceScheduleRecord> => {
    const id = 'sched_' + Math.random().toString(36).substring(2, 11);
    if (usePostgres && pgPool) {
      await pgPool.query(
        'INSERT INTO device_schedules (id, device_id, group_id, time, action, stream_id, stream_url, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, sched.device_id || null, sched.group_id || null, sched.time, sched.action, sched.stream_id || null, sched.stream_url || null, sched.enabled]
      );
      return { ...sched, id };
    }
    const newSched = { ...sched, id };
    localState.deviceSchedules.push(newSched);
    saveLocalState();
    return newSched;
  },

  deleteDeviceSchedule: async (id: string): Promise<boolean> => {
    if (usePostgres && pgPool) {
      const res = await pgPool.query('DELETE FROM device_schedules WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    }
    const initialLen = localState.deviceSchedules.length;
    localState.deviceSchedules = localState.deviceSchedules.filter(s => s.id !== id);
    if (localState.deviceSchedules.length !== initialLen) {
      saveLocalState();
      return true;
    }
    return false;
  },

  close: async (): Promise<void> => {
    if (pgPool) {
      await pgPool.end();
      console.log('[PostgreSQL] Database connection pool successfully closed.');
    }
  }

};
