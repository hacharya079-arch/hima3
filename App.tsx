import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  Tv, 
  Users, 
  Cpu, 
  HardDrive, 
  CloudRain, 
  RefreshCcw,
  Plus,
  MessageSquare,
  Key,
  Globe,
  Monitor,
  Edit3,
  Wifi,
  Laptop,
  AlertTriangle,
  X,
  Network,
  Terminal,
  Image as ImageIcon,
  Sparkles,
  Calendar,
  Clock,
  ListRestart,
  LogOut,
  User,
  Shield,
  Download,
  Trash2,
  PlayCircle,
  Play,
  Video,
  FileText,
  ServerCrash,
  FolderOpen,
  FolderSearch,
  Save,
  CheckCircle2,
  RotateCcw,
  Check,
  AlertCircle,
  Activity,
  Headphones,
  ChevronDown
} from 'lucide-react';
import DashboardHeader from './components/DashboardHeader';
import StreamPlayer from './components/StreamPlayer';
import DeploymentGuide from './components/DeploymentGuide';
import { StreamTestHub } from './components/StreamTestHub';
import { DeviceManager } from './components/DeviceManager';
import { StreamSession, StreamStats, ChatMessage } from './types';

export type IPMode = 'auto' | 'lan' | 'loopback' | 'manual';

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('streampulse_jwt'));
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'streams' | 'deploy' | 'infra' | 'settings' | 'stream_test' | 'devices' | 'users'>('dashboard');
  const [streams, setStreams] = useState<StreamSession[]>([]);
  
  const [detectedPublicIp, setDetectedPublicIp] = useState<string>('Detecting...');
  const [detectedLanIp, setDetectedLanIp] = useState<string>('Detecting...');
  const [manualIp, setManualIp] = useState<string>('');
  const [creationIpMode, setCreationIpMode] = useState<IPMode>('auto');
  const [confirmRemovalId, setConfirmRemovalId] = useState<string | null>(null);
  const [actionLogs, setActionLogs] = useState<any[]>([]);

  const [stats, setStats] = useState<any>({
    cpuUsage: 8.5,
    cpuCores: 4,
    cpuModel: 'Intel Xeon Platinum vCPU',
    memoryUsage: 2.1,
    memoryTotal: 16,
    memoryUsagePct: 13.1,
    activeStreams: 0,
    totalBandwidth: '0.0 Mbps',
    diskUsagePct: 34.2,
    uptime: 124502,
    networkTx: '0 KB/s',
    networkRx: '0 KB/s',
    dockerContainers: []
  });

  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [newStreamData, setNewStreamData] = useState({ 
    title: '', 
    broadcaster: '', 
    streamKey: '',
    thumbnailUrl: '',
    resolution: '1080p' as StreamSession['resolution'],
    isScheduled: false,
    scheduledDate: '',
    scheduledTime: '',
    audioCodec: 'aac',
    audioBitrate: '128k',
    audioSampleRate: '44100',
    audioChannels: 'stereo',
    audioNormalize: false,
    audioDelay: 0
  });

  const [isAudioSettingsExpanded, setIsAudioSettingsExpanded] = useState(false);

  // Auth States
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // User Management State Hooks
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAssignedStreamId, setNewAssignedStreamId] = useState('');
  const [createUserSuccess, setCreateUserSuccess] = useState('');

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editStatus, setEditStatus] = useState<'enabled' | 'disabled'>('enabled');
  const [editAssignedStreamId, setEditAssignedStreamId] = useState('');
  const [viewingHistoryUser, setViewingHistoryUser] = useState<any | null>(null);

  // Infrapage config tab states
  const [selectedFileKey, setSelectedFileKey] = useState<'docker-compose' | 'nginx' | 'nginx-rtmp' | 'transcode' | 'schema'>('docker-compose');
  // No recording state

  // File content definitions to preview
  const fileContents = {
    'docker-compose': `version: '3.8'
services:
  streampulse:
    build:
      context: ..
      dockerfile: vps-deployment/Dockerfile
    container_name: streampulse_manager
    ports:
      - "1935:1935" # RTMP ingest port
      - "80:80"     # HTTP reverse proxy
      - "443:443"   # HTTPS SSL reverse proxy
      - "3000:3000" # Direct Node manager interface
    environment:
      - NODE_ENV=production
      - JWT_SECRET=change_this_to_a_secure_random_key_in_production_129841824
      - DB_HOST=postgres_db
      - DB_PORT=5432
      - DB_USER=streampulse_admin
      - DB_PASSWORD=streampulse_secure_db_pass_19824
      - DB_NAME=streampulse
    volumes:
      - hls_storage:/var/www/hls
      - certbot_conf:/etc/letsencrypt
      - certbot_www:/var/www/certbot
    depends_on:
      - postgres_db
    restart: always

  postgres_db:
    image: postgres:16-alpine
    container_name: streampulse_db
    environment:
      - POSTGRES_DB=streampulse
      - POSTGRES_USER=streampulse_admin
      - POSTGRES_PASSWORD=streampulse_secure_db_pass_19824
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: always`,
    'nginx': `user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    server {
        listen 80;
        server_name streampulse.yourdomain.com;
        location / {
            return 301 https://$host$request_uri;
        }
    }`,
    'nginx-rtmp': `rtmp {
    server {
        listen 1935; # Standard RTMP port
        chunk_size 4096;

        # Primary Live Stream application
        application live {
            live on;
            record off;

            # Hand over incoming RTMP stream to FFmpeg for dynamic Multi-Bitrate HLS Transcoding
            exec_push /usr/local/bin/transcode.sh $name;
        }
    }
}`,
    'transcode': `#!/bin/bash
STREAM_KEY=$1
HLS_PATH="/var/www/hls/\${STREAM_KEY}"
RTMP_INPUT="rtmp://localhost/live/\${STREAM_KEY}"

mkdir -p "\${HLS_PATH}"

# FFmpeg Multi-Bitrate HLS Transcoder
ffmpeg -i "\${RTMP_INPUT}" \\
  -filter_complex "[v:0]split=4[v1080][v720][v480][v360]" \\
  -map "[v1080]" -c:v:0 libx264 -preset veryfast -b:v:0 6000k -maxrate:v:0 6000k -bufsize:v:0 12000k -g 60 -keyint_min 60 -sc_threshold 0 \\
  -map "[v720]"  -c:v:1 libx264 -preset veryfast -b:v:1 3500k -maxrate:v:1 3500k -bufsize:v:1 7000k  -g 60 -keyint_min 60 -sc_threshold 0 \\
  -map "[v480]"  -c:v:2 libx264 -preset veryfast -b:v:2 1500k -maxrate:v:2 1500k -bufsize:v:2 3000k  -g 60 -keyint_min 60 -sc_threshold 0 \\
  -map "[v360]"  -c:v:3 libx264 -preset veryfast -b:v:3 800k  -maxrate:v:3 800k  -bufsize:v:3 1600k  -g 60 -keyint_min 60 -sc_threshold 0 \\
  -map a:0 -c:a:0 aac -b:a:0 192k -ac 2 \\
  -map a:0 -c:a:1 aac -b:a:1 128k -ac 2 \\
  -map a:0 -c:a:2 aac -b:a:2 96k  -ac 2 \\
  -map a:0 -c:a:3 aac -b:a:3 64k  -ac 2 \\
  -f hls -hls_time 4 -hls_playlist_type event -master_pl_name master.m3u8 \\
  -hls_segment_filename "\${HLS_PATH}/v%v/file%03d.ts" \\
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3" \\
  "\${HLS_PATH}/v%v/index.m3u8" > /var/log/nginx/transcode_\${STREAM_KEY}.log 2>&1 &`,
    'schema': `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);`
  };

  const MIN_SCHEDULE_DATE = '2026-01-01';
  const MAX_SCHEDULE_DATE = '2027-12-31';

  const getEffectiveIp = (mode: IPMode) => {
    switch (mode) {
      case 'lan': return detectedLanIp;
      case 'loopback': return '127.0.0.1';
      case 'manual': return manualIp || '0.0.0.0';
      default: return detectedPublicIp;
    }
  };

  // Auth APIs
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const url = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = authMode === 'login' ? { username, password } : { username, email, password, role: 'admin' };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('streampulse_jwt', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setUsername('');
      setPassword('');
      setEmail('');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('streampulse_jwt');
    setToken(null);
    setCurrentUser(null);
  };

  // Load Current User Profile
  useEffect(() => {
    if (!token) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) {
          handleLogout();
          return;
        }
        const data = await res.json();
        if (res.ok) {
          setCurrentUser(data);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };
    fetchProfile();
  }, [token]);

  // Load IP and Server Stats / Streams / Recordings
  useEffect(() => {
    const detectPublicIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setDetectedPublicIp(data.ip);
      } catch (e) {
        setDetectedPublicIp('154.12.88.2');
      }
    };

    const detectLanIp = () => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("");
      pc.createOffer().then(pc.setLocalDescription.bind(pc));
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        const myIP = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(ice.candidate.candidate)?.[1];
        if (myIP) {
          setDetectedLanIp(myIP);
          pc.onicecandidate = null;
        }
      };
      setTimeout(() => {
        setDetectedLanIp(prev => prev === 'Detecting...' ? '192.168.1.100' : prev);
      }, 2000);
    };

    detectPublicIp();
    detectLanIp();
  }, []);

  // Fetch Streams, Stats, and Recordings from REST API
  const fetchStreams = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/streams', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setStreams(data);
    } catch (err) {
      console.error('Error fetching streams:', err);
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    if (!token || !currentUser || currentUser.role !== 'admin') return;
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUsersList(data);
      } else {
        setUsersError(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      setUsersError('Network error while fetching users');
    } finally {
      setUsersLoading(false);
    }
  }, [token, currentUser]);

  useEffect(() => {
    if (activeTab === 'users' && currentUser?.role === 'admin') {
      fetchUsers();
    }
  }, [activeTab, fetchUsers, currentUser]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newEmail || !newPassword) {
      setUsersError('Please fill out all required fields');
      return;
    }
    setUsersError(null);
    setCreateUserSuccess('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUsername,
          email: newEmail,
          password: newPassword,
          assigned_stream_id: newAssignedStreamId || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCreateUserSuccess('Channel User created successfully!');
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        setNewAssignedStreamId('');
        fetchUsers();
      } else {
        setUsersError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setUsersError('Network error while creating user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    setUsersError(null);
    try {
      const body: any = {
        username: editUsername,
        email: editEmail,
        status: editStatus,
        assigned_stream_id: editAssignedStreamId || null
      };
      if (editPassword) {
        body.password = editPassword;
      }
      const res = await fetch(`/api/users/${editingUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setEditingUserId(null);
        setEditPassword('');
        fetchUsers();
      } else {
        setUsersError(data.error || 'Failed to update user');
      }
    } catch (err) {
      setUsersError('Network error while updating user');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this channel user?')) return;
    setUsersError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        setUsersError(data.error || 'Failed to delete user');
      }
    } catch (err) {
      setUsersError('Network error while deleting user');
    }
  };

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/system/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (err) {
      console.error('Error fetching server stats:', err);
    }
  }, [token]);

  const fetchActionLogs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/system/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setActionLogs(data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchStreams();
    fetchStats();
    fetchActionLogs();

    // Poll server statistics, streams, and logs every 3 seconds
    const interval = setInterval(() => {
      fetchStreams();
      fetchStats();
      fetchActionLogs();
    }, 3000);

    return () => clearInterval(interval);
  }, [token, fetchStreams, fetchStats, fetchActionLogs]);

  // Handle Stream Creation via API
  const handleCreateStream = async () => {
    if (!newStreamData.title || !newStreamData.broadcaster) return;
    
    setIsGeneratingKey(true);
    const scheduledStart = newStreamData.isScheduled ? `${newStreamData.scheduledDate}T${newStreamData.scheduledTime}:00` : undefined;

    try {
      const res = await fetch('/api/streams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newStreamData.title,
          broadcaster: newStreamData.broadcaster,
          resolution: newStreamData.resolution,
          scheduledStart,
          audioCodec: newStreamData.audioCodec,
          audioBitrate: newStreamData.audioBitrate,
          audioSampleRate: Number(newStreamData.audioSampleRate),
          audioChannels: newStreamData.audioChannels,
          audioNormalize: newStreamData.audioNormalize,
          audioDelay: Number(newStreamData.audioDelay)
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create stream');
      }

      const createdStream = await res.json();
      setStreams(prev => [createdStream, ...prev]);

      // Reset form
      setNewStreamData({ 
        title: '', 
        broadcaster: '', 
        streamKey: '', 
        thumbnailUrl: '', 
        resolution: '1080p',
        isScheduled: false,
        scheduledDate: '',
        scheduledTime: '',
        audioCodec: 'aac',
        audioBitrate: '128k',
        audioSampleRate: '44100',
        audioChannels: 'stereo',
        audioNormalize: false,
        audioDelay: 0
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleConfirmRemoval = async () => {
    if (confirmRemovalId) {
      try {
        const res = await fetch(`/api/streams/${confirmRemovalId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setStreams(prev => prev.filter(s => s.id !== confirmRemovalId));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setConfirmRemovalId(null);
      }
    }
  };

  const handleUpdateResolution = async (id: string, resolution: string) => {
    try {
      const res = await fetch(`/api/streams/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resolution })
      });
      if (res.ok) {
        const updated = await res.json();
        setStreams(prev => prev.map(s => s.id === id ? updated : s));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloneProfile = async (sourceId: string, config: Partial<StreamSession>) => {
    try {
      const otherStreams = streams.filter(s => s.id !== sourceId);
      for (const other of otherStreams) {
        await fetch(`/api/streams/${other.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(config)
        });
      }
      setStreams(prev => prev.map(s => s.id !== sourceId ? { ...s, ...config } : s));
      alert('Resolution configuration cloned successfully to all other panels!');
    } catch (err) {
      console.error(err);
      alert('Failed to clone configuration to all panels.');
    }
  };

  const handleUpdateQuality = async (id: string, bitrate: number, codec: string) => {
    try {
      const res = await fetch(`/api/streams/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bitrate, codec })
      });
      if (res.ok) {
        const updated = await res.json();
        setStreams(prev => prev.map(s => s.id === id ? updated : s));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEnableStream = async (id: string) => {
    try {
      const res = await fetch(`/api/streams/${id}/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const updated = await res.json();
        setStreams(prev => prev.map(s => s.id === id ? updated : s));
        fetchActionLogs();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to enable stream');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisableStream = async (id: string) => {
    try {
      const res = await fetch(`/api/streams/${id}/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const updated = await res.json();
        setStreams(prev => prev.map(s => s.id === id ? updated : s));
        fetchActionLogs();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to disable stream');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Recording control handlers removed

  const handleEditStream = async (id: string, fields: Partial<StreamSession>) => {
    try {
      const res = await fetch(`/api/streams/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(fields)
      });
      if (res.ok) {
        const updated = await res.json();
        setStreams(prev => prev.map(s => s.id === id ? updated : s));
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to update stream metadata');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegenerateKey = async (id: string) => {
    try {
      const res = await fetch(`/api/streams/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setStreams(prev => prev.map(s => s.id === id ? updated : s));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGoLive = async (id: string) => {
    try {
      const res = await fetch(`/api/streams/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'live' })
      });
      if (res.ok) {
        const updated = await res.json();
        setStreams(prev => prev.map(s => s.id === id ? updated : s));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestartStream = async (id: string) => {
    try {
      const res = await fetch(`/api/streams/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'offline' })
      });
      if (res.ok) {
        const updated = await res.json();
        setStreams(prev => prev.map(s => s.id === id ? updated : s));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete recording handler removed

  const copyConfigToClipboard = (txt: string) => {
    navigator.clipboard.writeText(txt);
    alert('Configuration code copied to clipboard!');
  };

  const downloadAllConfigs = () => {
    // Generate simple text index of files for user download fallback
    const boundary = "========================================\n";
    let outputText = "STREAMPULSE DEPLOYMENT CONFIGURATIONS PACK\n\n";
    Object.entries(fileContents).forEach(([k, v]) => {
      outputText += `${boundary}FILE: ${k}\n${boundary}${v}\n\n`;
    });
    const blob = new Blob([outputText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'streampulse-vps-configs.txt';
    a.click();
  };

  const NavItems = () => {
    const isAdmin = currentUser?.role === 'admin';
    return (
      <>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:bg-zinc-900'}`}
        >
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          <span className="truncate">{isAdmin ? 'Admin Dashboard' : 'My Channel'}</span>
        </button>
        {isAdmin && (
          <>
            <button 
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:bg-zinc-900'}`}
            >
              <Users className="w-5 h-5 shrink-0" />
              <span className="truncate">User Manager</span>
            </button>
            <button 
              onClick={() => setActiveTab('devices')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'devices' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:bg-zinc-900'}`}
            >
              <Monitor className="w-5 h-5 shrink-0" />
              <span className="truncate">Device Manager</span>
            </button>
            <button 
              onClick={() => setActiveTab('streams')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'streams' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:bg-zinc-900'}`}
            >
              <Tv className="w-5 h-5 shrink-0" />
              <span className="truncate">Public Viewers</span>
            </button>
            <button 
              onClick={() => setActiveTab('stream_test')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'stream_test' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:bg-zinc-900'}`}
            >
              <Activity className="w-5 h-5 shrink-0" />
              <span className="truncate">Stream Test Hub</span>
            </button>
            <button 
              onClick={() => setActiveTab('deploy')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'deploy' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:bg-zinc-900'}`}
            >
              <Terminal className="w-5 h-5 shrink-0" />
              <span className="truncate">VPS Setup Guide</span>
            </button>
            <button 
              onClick={() => setActiveTab('infra')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'infra' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:bg-zinc-900'}`}
            >
              <Settings className="w-5 h-5 shrink-0" />
              <span className="truncate">Docker configs</span>
            </button>
          </>
        )}
      </>
    );
  };

  // Unauthenticated login overlay
  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-teal-500 to-orange-500"></div>
          
          <div className="flex flex-col items-center mb-8">
            <div className="p-3 bg-blue-600/10 rounded-xl mb-3 border border-blue-500/20">
              <Shield className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">StreamPulse Admin</h1>
            <p className="text-xs text-zinc-500 uppercase font-mono tracking-widest mt-1">VPS RTMP Control Panel</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {authError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Username</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100"
              />
            </div>

            {authMode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@streampulse.io" 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100"
              />
            </div>

            <button 
              type="submit"
              disabled={authLoading}
              className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 mt-2"
            >
              {authLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : authMode === 'login' ? 'Sign In' : 'Create Administrator Account'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-800 text-center text-xs text-zinc-500">
            {authMode === 'login' ? (
              <p>Don't have an administrator account? <button onClick={() => { setAuthMode('register'); setAuthError(null); }} className="text-blue-400 font-bold hover:underline">Register VPS</button></p>
            ) : (
              <p>Already have an administrator account? <button onClick={() => { setAuthMode('login'); setAuthError(null); }} className="text-blue-400 font-bold hover:underline">Sign In</button></p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const liveStreams = streams.filter(s => s.status === 'live');
  const scheduledStreams = streams.filter(s => s.status === 'scheduled');

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-x-hidden pb-20 lg:pb-0">
      <DashboardHeader publicIp={detectedPublicIp} localIp={detectedLanIp} />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar Desktop Nav */}
        <aside className="w-64 shrink-0 hidden lg:flex flex-col gap-2">
          {currentUser && (
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4 mb-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600/15 rounded-full flex items-center justify-center border border-blue-500/20 shrink-0">
                <User className="w-4 h-4 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-zinc-100 truncate">{currentUser.username}</h4>
                <p className="text-[10px] text-zinc-500 capitalize">{currentUser.role} Account</p>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          <NavItems />

          {currentUser?.role === 'admin' && (
            <>
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <h4 className="px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Detected Addresses</h4>
                <div className="px-4 mb-6 space-y-3">
                  <div className="flex flex-col gap-1 text-xs text-zinc-300 bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      <span className="font-mono text-[11px] truncate">{detectedPublicIp}</span>
                    </div>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-tighter font-bold">Public Node</span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-zinc-300 bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Network className="w-3.5 h-3.5 text-orange-500" />
                      <span className="font-mono text-[11px] truncate">{detectedLanIp}</span>
                    </div>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-tighter font-bold">Local LAN IP</span>
                  </div>
                </div>

                <h4 className="px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Server Resources</h4>
                <div className="px-4 space-y-4">
                   <div>
                     <div className="flex justify-between text-xs mb-1.5">
                       <span className="text-zinc-400 flex items-center gap-1"><Cpu className="w-3 h-3"/> CPU ({stats.cpuCores} Cores)</span>
                       <span className="text-zinc-200">{stats.cpuUsage?.toFixed(1)}%</span>
                     </div>
                     <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${stats.cpuUsage}%` }} />
                     </div>
                     <span className="text-[9px] text-zinc-600 block mt-1 truncate">{stats.cpuModel}</span>
                   </div>
                   <div>
                     <div className="flex justify-between text-xs mb-1.5">
                       <span className="text-zinc-400 flex items-center gap-1"><HardDrive className="w-3 h-3"/> RAM</span>
                       <span className="text-zinc-200">{stats.memoryUsage?.toFixed(1)} GB / {stats.memoryTotal?.toFixed(1)} GB</span>
                     </div>
                     <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${stats.memoryUsagePct}%` }} />
                     </div>
                   </div>
                   <div>
                     <div className="flex justify-between text-xs mb-1.5">
                       <span className="text-zinc-400 flex items-center gap-1"><LayoutDashboard className="w-3 h-3"/> Disk Storage</span>
                       <span className="text-zinc-200">{stats.diskUsagePct}%</span>
                     </div>
                     <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${stats.diskUsagePct}%` }} />
                     </div>
                   </div>
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Content Area */}
        <div className="flex-1 space-y-8 min-w-0">
          {activeTab === 'dashboard' && (
            <>
              {currentUser?.role === 'admin' && (
                <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-blue-500" />
                  <h2 className="text-xl font-bold">Create Ingest Point</h2>
                </div>
                  <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                     <button 
                        onClick={() => setNewStreamData(prev => ({ ...prev, isScheduled: false }))}
                        className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${!newStreamData.isScheduled ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                     >
                       Now
                     </button>
                     <button 
                        onClick={() => setNewStreamData(prev => ({ ...prev, isScheduled: true }))}
                        className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${newStreamData.isScheduled ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                     >
                       Later
                     </button>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Broadcaster Handle</label>
                      <input 
                        type="text" placeholder="e.g. dev_alex" value={newStreamData.broadcaster}
                        onChange={(e) => setNewStreamData(prev => ({ ...prev, broadcaster: e.target.value }))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Broadcast Title</label>
                      <input 
                        type="text" placeholder="e.g. High Performance Coding" value={newStreamData.title}
                        onChange={(e) => setNewStreamData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Resolution Target</label>
                      <select 
                        value={newStreamData.resolution}
                        onChange={(e) => setNewStreamData(prev => ({ ...prev, resolution: e.target.value as StreamSession['resolution'] }))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      >
                        <option value="720p">720p HD</option>
                        <option value="1080p">1080p FHD</option>
                        <option value="2K">2K QHD</option>
                        <option value="4K">4K UHD</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Ingest VPS Network</label>
                      <select 
                        value={creationIpMode}
                        onChange={(e) => setCreationIpMode(e.target.value as IPMode)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      >
                        <option value="auto">Public WAN ({detectedPublicIp})</option>
                        <option value="lan">LAN Local ({detectedLanIp})</option>
                        <option value="loopback">Host Loopback (127.0.0.1)</option>
                        <option value="manual">Manual Override</option>
                      </select>
                    </div>

                    {creationIpMode === 'manual' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Manual IPv4 Address</label>
                        <input 
                          type="text" placeholder="e.g. 154.12.88.2" value={manualIp}
                          onChange={(e) => setManualIp(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100"
                        />
                      </div>
                    )}
                  </div>

                  {/* Dedicated Audio Settings Collapsible Panel */}
                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
                    <button 
                      type="button"
                      onClick={() => setIsAudioSettingsExpanded(prev => !prev)} 
                      className="w-full px-4 py-3 flex justify-between items-center text-xs font-bold text-zinc-300 uppercase tracking-wider bg-zinc-900/60 hover:bg-zinc-900/80 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Headphones className="w-4 h-4 text-emerald-400" /> 
                        <span>Audio Transcoder Settings</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${isAudioSettingsExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isAudioSettingsExpanded && (
                      <div className="p-4 bg-zinc-950/40 border-t border-zinc-800 space-y-4 animate-in slide-in-from-top-1 duration-200">
                        {/* Audio Codec & Bitrate */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Audio Codec</label>
                            <select 
                              value={newStreamData.audioCodec}
                              onChange={(e) => setNewStreamData(prev => ({ ...prev, audioCodec: e.target.value }))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                            >
                              <option value="aac">AAC (Advanced Audio Coding)</option>
                              <option value="mp3">MP3 (MPEG Layer 3)</option>
                              <option value="opus">Opus (Low Latency/Speech/Music)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Audio Bitrate</label>
                            <select 
                              value={newStreamData.audioBitrate}
                              onChange={(e) => setNewStreamData(prev => ({ ...prev, audioBitrate: e.target.value }))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                            >
                              <option value="64k">64 kbps (Low Bandwidth)</option>
                              <option value="96k">96 kbps (Standard Mobile)</option>
                              <option value="128k">128 kbps (Standard Quality)</option>
                              <option value="192k">192 kbps (High Quality)</option>
                              <option value="256k">256 kbps (Studio Quality)</option>
                              <option value="320k">320 kbps (Audiophile Quality)</option>
                            </select>
                          </div>
                        </div>

                        {/* Sample Rate & Channel Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Sample Rate Configuration</label>
                            <select 
                              value={newStreamData.audioSampleRate}
                              onChange={(e) => setNewStreamData(prev => ({ ...prev, audioSampleRate: e.target.value }))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                            >
                              <option value="32000">32,000 Hz (FM Radio)</option>
                              <option value="44100">44,100 Hz (CD Audio)</option>
                              <option value="48000">48,000 Hz (Professional Studio)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Channel Layout</label>
                            <select 
                              value={newStreamData.audioChannels}
                              onChange={(e) => setNewStreamData(prev => ({ ...prev, audioChannels: e.target.value }))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                            >
                              <option value="mono">Mono (1.0)</option>
                              <option value="stereo">Stereo (2.0)</option>
                              <option value="5.1">5.1 Surround Sound</option>
                              <option value="7.1">7.1 Surround Sound</option>
                            </select>
                          </div>
                        </div>

                        {/* Volume Normalization & Delay Controls */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                          <div className="space-y-1.5 flex flex-col justify-center h-full pt-1">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Volume Normalization</span>
                            <label className="flex items-center gap-3 bg-zinc-950/60 border border-zinc-800 rounded-lg px-4 py-2.5 cursor-pointer select-none text-zinc-300 hover:bg-zinc-950 hover:text-zinc-100 transition-colors">
                              <input 
                                type="checkbox"
                                checked={newStreamData.audioNormalize}
                                onChange={(e) => setNewStreamData(prev => ({ ...prev, audioNormalize: e.target.checked }))}
                                className="w-4 h-4 rounded border-zinc-800 text-emerald-500 accent-emerald-500 cursor-pointer"
                              />
                              <div className="flex flex-col">
                                <span className="text-xs font-bold uppercase tracking-wider">Loudness Normalization</span>
                                <span className="text-[9px] text-zinc-500">Apply EBU R128 loudness standard</span>
                              </div>
                            </label>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Audio Sync Delay (ms)</label>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                min="0" 
                                max="10000" 
                                step="10"
                                value={newStreamData.audioDelay}
                                onChange={(e) => setNewStreamData(prev => ({ ...prev, audioDelay: parseInt(e.target.value, 10) || 0 }))}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100 font-mono"
                              />
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide shrink-0 bg-zinc-900 border border-zinc-800 px-2.5 py-2 rounded-lg">
                                Milliseconds
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {newStreamData.isScheduled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-2">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-blue-500" /> Start Date
                          </label>
                          <input 
                            type="date" 
                            value={newStreamData.scheduledDate}
                            min={MIN_SCHEDULE_DATE}
                            max={MAX_SCHEDULE_DATE}
                            onChange={(e) => setNewStreamData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100"
                          />
                          <p className="text-[8px] text-zinc-500 font-medium px-1">Allowed window: {MIN_SCHEDULE_DATE} to {MAX_SCHEDULE_DATE}</p>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                            <Clock className="w-3 h-3 text-blue-500" /> Start Time
                          </label>
                          <input 
                            type="time" value={newStreamData.scheduledTime}
                            onChange={(e) => setNewStreamData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100"
                          />
                       </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button 
                      onClick={handleCreateStream}
                      disabled={isGeneratingKey || !newStreamData.title || !newStreamData.broadcaster || (newStreamData.isScheduled && (!newStreamData.scheduledDate || !newStreamData.scheduledTime))}
                      className="w-full md:w-48 h-[42px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      {isGeneratingKey ? <><RefreshCcw className="w-4 h-4 animate-spin" /> Processing...</> : 
                        newStreamData.isScheduled ? <><Calendar className="w-4 h-4" /> Schedule Stream</> : <><Plus className="w-4 h-4" /> Create Stream</>}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-zinc-950/50 border border-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[11px] text-zinc-400">Ingest point URL: </span>
                  </div>
                  <span className="text-[11px] font-mono text-blue-400 font-bold truncate">rtmp://{getEffectiveIp(creationIpMode)}/live</span>
                </div>
              </section>
              )}

              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv className="w-5 h-5 text-red-500" />
                    <h2 className="text-xl font-bold">Manage Active Broadcasts</h2>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                      {liveStreams.length} Live
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      {scheduledStreams.length} Scheduled
                    </div>
                  </div>
                </div>
                
                {streams.length === 0 ? (
                  <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-12 text-center text-zinc-500 space-y-4">
                    <Tv className="w-12 h-12 text-zinc-700 mx-auto" />
                    <p className="text-sm font-semibold">No broadcasts configured yet. Use the tool above to add your first RTMP ingest point!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                    {streams.map(stream => (
                      <StreamPlayer 
                        key={stream.id} stream={stream} 
                        onRemove={() => setConfirmRemovalId(stream.id)}
                        onUpdateResolution={(res) => handleUpdateResolution(stream.id, res)}
                        onUpdateIpMode={(mode) => handleUpdateResolution(stream.id, stream.resolution)} // Fallback update
                        onUpdateQuality={(bitrate, codec) => handleUpdateQuality(stream.id, bitrate, codec)}
                        onRegenerateKey={() => handleRegenerateKey(stream.id)}
                        onGoLive={() => handleGoLive(stream.id)}
                        onRestartStream={() => handleRestartStream(stream.id)}
                        onEnable={() => handleEnableStream(stream.id)}
                        onDisable={() => handleDisableStream(stream.id)}
                        onEdit={(updated) => handleEditStream(stream.id, updated)}
                        onCloneProfile={(config) => handleCloneProfile(stream.id, config)}
                        isAdmin={currentUser?.role === 'admin'}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Administrator Audit Log */}
              {currentUser?.role === 'admin' && (
                <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-zinc-400" /> Administrator Audit Logs
                    </h3>
                    <button 
                      onClick={fetchActionLogs}
                      className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                      title="Refresh logs"
                    >
                      <RefreshCcw className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="bg-zinc-950 rounded-xl border border-zinc-800/80 divide-y divide-zinc-850 max-h-[250px] overflow-y-auto pr-1 text-xs font-mono">
                    {actionLogs.length === 0 ? (
                      <div className="p-4 text-center text-zinc-500 font-sans">
                        No stream state modifications recorded.
                      </div>
                    ) : (
                      actionLogs.map((log) => (
                        <div key={log.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-zinc-900/40 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                log.action === 'enable' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                log.action === 'disable' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                log.action === 'disabled_reject' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-zinc-800 text-zinc-400'
                              }`}>
                                {log.action}
                              </span>
                              <span className="text-zinc-300 font-bold">"{log.streamTitle}"</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                              {log.details}
                            </p>
                          </div>
                          <div className="text-[10px] text-zinc-500 text-right shrink-0 flex flex-col sm:items-end gap-0.5 font-sans">
                            <span className="font-mono text-zinc-400">By: <strong className="text-zinc-300">{log.user}</strong></span>
                            <span>IP: {log.ip}</span>
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === 'users' && currentUser?.role === 'admin' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  <Users className="w-8 h-8 text-blue-500" /> Channel User Accounts
                </h2>
                <p className="text-zinc-400 text-sm">Create and manage dedicated logins, reset passwords, enable/disable access, and assign accounts to specific channels.</p>
              </div>

              {usersError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  {usersError}
                </div>
              )}

              {createUserSuccess && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  {createUserSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Create User Card */}
                <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-sm h-fit">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-zinc-400" /> Create Channel Login
                  </h3>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Username</label>
                      <input 
                        type="text" required value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="e.g. broadcaster_alpha"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100 font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Email Address</label>
                      <input 
                        type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="e.g. broadcaster@streampulse.io"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100 font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Password</label>
                      <input 
                        type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100 font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Assign Channel</label>
                      <select 
                        value={newAssignedStreamId} onChange={(e) => setNewAssignedStreamId(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-100 font-medium"
                      >
                        <option value="">-- No Channel Assigned --</option>
                        {streams.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.title} (@{s.broadcaster})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm shadow-lg shadow-blue-900/25">
                      Create Login Account
                    </button>
                  </form>
                </div>

                {/* Users List Directory */}
                <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-sm">
                  <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
                    <span>Active Directory</span>
                    <button onClick={fetchUsers} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors">
                      <RefreshCcw className="w-4 h-4" />
                    </button>
                  </h3>

                  {usersLoading ? (
                    <div className="p-8 text-center text-zinc-500">Loading directory...</div>
                  ) : usersList.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">No channel users found.</div>
                  ) : (
                    <div className="space-y-4">
                      {usersList.map((user) => {
                        const assignedStream = streams.find(s => s.id === user.assigned_stream_id);
                        const isEditing = editingUserId === user.id;

                        return (
                          <div key={user.id} className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-zinc-100">{user.username}</span>
                                  {user.role === 'admin' && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">ADMIN</span>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${user.status === 'disabled' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                    {user.status || 'enabled'}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400">{user.email}</p>
                              </div>

                              {user.role !== 'admin' && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button 
                                    onClick={() => {
                                      setEditingUserId(user.id);
                                      setEditUsername(user.username);
                                      setEditEmail(user.email);
                                      setEditStatus(user.status || 'enabled');
                                      setEditAssignedStreamId(user.assigned_stream_id || '');
                                    }}
                                    className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-lg transition-all"
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="px-2.5 py-1 text-xs bg-red-950/40 hover:bg-red-900/30 text-red-400 border border-red-900/20 font-bold rounded-lg transition-all"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-zinc-900">
                              <div>
                                <span className="text-zinc-500 font-bold uppercase text-[9px] block mb-0.5">Assigned Channel</span>
                                <span className={assignedStream ? 'text-blue-400 font-semibold' : 'text-zinc-500 italic font-medium'}>
                                  {assignedStream ? `${assignedStream.title} (@${assignedStream.broadcaster})` : 'Unassigned'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="text-zinc-500 font-bold uppercase text-[9px] block mb-0.5">Login History</span>
                                  <span className="text-zinc-400 font-medium">
                                    {user.login_history && user.login_history.length > 0 
                                      ? `${user.login_history.length} logins recorded` 
                                      : 'No login records'}
                                  </span>
                                </div>
                                {user.login_history && user.login_history.length > 0 && (
                                  <button 
                                    onClick={() => setViewingHistoryUser(viewingHistoryUser?.id === user.id ? null : user)}
                                    className="text-xs text-blue-500 hover:underline font-bold"
                                  >
                                    {viewingHistoryUser?.id === user.id ? 'Hide Logs' : 'View Logs'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Viewing Login History Dropdown */}
                            {viewingHistoryUser?.id === user.id && (
                              <div className="mt-3 p-3 bg-zinc-950 border border-zinc-900 rounded-lg max-h-[150px] overflow-y-auto space-y-1.5 text-[11px] font-mono">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-sans">Recent Logins (IP & Time)</p>
                                {user.login_history.map((log: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-zinc-400 border-b border-zinc-900/50 pb-1 last:border-0 last:pb-0">
                                    <span>IP: {log.ip || 'Unknown'}</span>
                                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline Edit Form */}
                            {isEditing && (
                              <form onSubmit={handleUpdateUser} className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
                                <div className="flex justify-between items-center mb-1">
                                  <h4 className="text-xs font-bold text-zinc-300">Edit User Account: {user.username}</h4>
                                  <button type="button" onClick={() => setEditingUserId(null)} className="text-zinc-500 hover:text-zinc-300">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-zinc-500 uppercase">Username</label>
                                    <input 
                                      type="text" required value={editUsername} onChange={(e) => setEditUsername(e.target.value)}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-zinc-500 uppercase">Email</label>
                                    <input 
                                      type="email" required value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-zinc-500 uppercase">Reset Password (Optional)</label>
                                    <input 
                                      type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
                                      placeholder="Leave blank to keep same"
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-zinc-500 uppercase">Account Status</label>
                                    <select 
                                      value={editStatus} onChange={(e: any) => setEditStatus(e.target.value)}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none"
                                    >
                                      <option value="enabled">Enabled</option>
                                      <option value="disabled">Disabled</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[9px] font-bold text-zinc-500 uppercase">Assign Channel</label>
                                    <select 
                                      value={editAssignedStreamId} onChange={(e) => setEditAssignedStreamId(e.target.value)}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none"
                                    >
                                      <option value="">-- No Channel Assigned --</option>
                                      {streams.map(s => (
                                        <option key={s.id} value={s.id}>
                                          {s.title} (@{s.broadcaster})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                  <button type="button" onClick={() => setEditingUserId(null)} className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold rounded-lg">
                                    Cancel
                                  </button>
                                  <button type="submit" className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg">
                                    Save Changes
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'streams' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl sm:text-3xl font-bold">Public Stream Portal</h2>
                <p className="text-zinc-400 text-sm">Real-time broadcast monitoring hub for multi-player stream execution.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {streams.map(stream => (
                  <StreamPlayer 
                    key={stream.id} 
                    stream={stream} 
                    onEdit={(updated) => handleEditStream(stream.id, updated)}
                    onCloneProfile={(config) => handleCloneProfile(stream.id, config)}
                    isAdmin={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recordings list removed */}

          {activeTab === 'deploy' && <DeploymentGuide />}

          {activeTab === 'stream_test' && (
            <StreamTestHub streams={streams} />
          )}

          {activeTab === 'infra' && (
            <div className="space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">VPS Container Configurations</h2>
                    <p className="text-zinc-400 text-sm">Inspect and download optimized docker and server config files for Ubuntu deployment.</p>
                  </div>
                  <button 
                    onClick={downloadAllConfigs}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all"
                  >
                    <Download className="w-4 h-4" /> Download Complete Pack
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-4">
                  <button 
                    onClick={() => setSelectedFileKey('docker-compose')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedFileKey === 'docker-compose' ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                  >
                    docker-compose.yml
                  </button>
                  <button 
                    onClick={() => setSelectedFileKey('nginx')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedFileKey === 'nginx' ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                  >
                    nginx.conf
                  </button>
                  <button 
                    onClick={() => setSelectedFileKey('nginx-rtmp')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedFileKey === 'nginx-rtmp' ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                  >
                    nginx-rtmp.conf
                  </button>
                  <button 
                    onClick={() => setSelectedFileKey('transcode')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedFileKey === 'transcode' ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                  >
                    transcode.sh (FFmpeg)
                  </button>
                  <button 
                    onClick={() => setSelectedFileKey('schema')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedFileKey === 'schema' ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                  >
                    Postgres Schema
                  </button>
                </div>

                <div className="relative">
                  <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-x-auto text-[11px] sm:text-xs font-mono text-zinc-300 max-h-[420px] scrollbar-thin">
                    {fileContents[selectedFileKey]}
                  </pre>
                  <button 
                    onClick={() => copyConfigToClipboard(fileContents[selectedFileKey])}
                    className="absolute top-3 right-3 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[10px] font-bold text-zinc-400 transition-colors"
                  >
                    Copy Code
                  </button>
                </div>
              </div>

              {/* Server Diagnostics & Docker Health monitor */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-lg font-bold">VPS Container Health Logs</h3>
                  <p className="text-zinc-400 text-sm">Real-time statuses of the primary Docker orchestrations.</p>
                </div>

                <div className="space-y-3">
                  {stats.dockerContainers?.length === 0 ? (
                    <div className="p-4 text-center text-zinc-500 border border-zinc-800 rounded-xl text-xs">
                      No containers detected. Run `docker compose up` to orchestrate services.
                    </div>
                  ) : (
                    stats.dockerContainers?.map((c: any, idx: number) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${c.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
                          <div>
                            <h4 className="text-xs font-bold text-zinc-200 font-mono">{c.name}</h4>
                            <p className="text-[10px] text-zinc-500">Image: {c.image}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-zinc-900 border border-zinc-850 rounded text-zinc-400 truncate">
                          {c.uptime}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'devices' && (
            <DeviceManager token={token} streams={streams} />
          )}

          {activeTab === 'settings' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8 space-y-8">
               <div>
                  <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Global Infrastructure</h2>
                  <p className="text-zinc-400 text-sm">VPS network definitions and defaults.</p>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-blue-500" /> Network Overrides
                    </h3>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-zinc-500 uppercase">Public IPv4 Address</label>
                         <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs sm:text-sm font-mono text-blue-400 truncate">{detectedPublicIp}</div>
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-bold text-zinc-500 uppercase">IP Override</label>
                         <input 
                            type="text" value={manualIp} onChange={(e) => setManualIp(e.target.value)}
                            placeholder="e.g. 154.12.88.2"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-amber-400 outline-none focus:ring-2 focus:ring-amber-500/30"
                         />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-emerald-500" /> Default Quality
                    </h3>
                    <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                       <p className="text-sm font-bold">Global Target Resolution</p>
                       <div className="flex flex-wrap gap-2">
                         {['720p', '1080p', '2K', '4K'].map(res => (
                           <button 
                             key={res}
                             className={`px-3 py-1 rounded border text-[10px] font-bold ${res === '1080p' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                           >
                             {res}
                           </button>
                         ))}
                       </div>
                    </div>

                    {/* Recording settings removed */}
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Navigation */}
      {currentUser?.role === 'admin' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-around px-2 py-3 lg:hidden z-[60] shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'dashboard' ? 'text-blue-500' : 'text-zinc-500'}`}>
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase">Admin</span>
        </button>
        <button onClick={() => setActiveTab('devices')} className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'devices' ? 'text-blue-500' : 'text-zinc-500'}`}>
          <Monitor className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase">Devices</span>
        </button>
        <button onClick={() => setActiveTab('streams')} className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'streams' ? 'text-blue-500' : 'text-zinc-500'}`}>
          <Tv className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase">Streams</span>
        </button>
        <button onClick={() => setActiveTab('stream_test')} className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'stream_test' ? 'text-blue-500' : 'text-zinc-500'}`}>
          <Activity className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase">Test</span>
        </button>
        <button onClick={() => setActiveTab('deploy')} className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'deploy' ? 'text-blue-500' : 'text-zinc-500'}`}>
          <Terminal className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase">Setup</span>
        </button>
        <button onClick={() => setActiveTab('infra')} className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'infra' ? 'text-blue-500' : 'text-zinc-500'}`}>
          <Settings className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase">Configs</span>
        </button>
      </nav>
      )}

      {confirmRemovalId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setConfirmRemovalId(null)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-red-600/20 rounded-full mb-6">
                <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Remove Access?</h3>
              <p className="text-zinc-400 text-sm mb-8">
                Clear RTMP credentials for <span className="text-zinc-100 font-bold">@{streams.find(s => s.id === confirmRemovalId)?.broadcaster}</span>?
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmRemovalId(null)} className="flex-1 px-4 py-3 bg-zinc-800 text-zinc-100 font-bold rounded-xl">Cancel</button>
                <button onClick={handleConfirmRemoval} className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl">Remove</button>
              </div>
            </div>
            <button onClick={() => setConfirmRemovalId(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      <footer className="hidden sm:block border-t border-zinc-900 bg-zinc-950/50 py-8 px-8 text-center mt-auto">
        <p className="text-xs text-zinc-500">© 2026 StreamPulse Media Systems. Professional RTMP Distribution Hub.</p>
      </footer>
    </div>
  );
};

export default App;
