
export interface StreamSession {
  id: string;
  title: string;
  broadcaster: string;
  viewers: number;
  status: 'live' | 'offline' | 'scheduled' | 'disabled';
  startTime: string;
  scheduledStart?: string; // ISO string for future streams
  rtmpUrl: string;
  streamKey: string;
  thumbnailUrl: string;
  resolution: string;
  ingestIp: string;
  bitrate?: number; // in Kbps
  codec?: string;
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

export interface StreamStats {
  cpuUsage: number;
  memoryUsage: number;
  activeStreams: number;
  totalBandwidth: string;
}

export interface ChatMessage {
  id: string;
  user: string;
  message: string;
  timestamp: string;
  isAi?: boolean;
}

export interface Device {
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

export interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  devices?: Device[];
}

export interface PlaybackHistory {
  id: string;
  device_id: string;
  stream_id?: string;
  stream_url?: string;
  action: string;
  timestamp: string;
}

export interface DeviceLog {
  id: string;
  device_id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface DeviceSchedule {
  id: string;
  device_id?: string;
  group_id?: string;
  time: string;
  action: 'play' | 'stop';
  stream_id?: string;
  stream_url?: string;
  enabled: boolean;
}
