import React, { useState, useEffect, useRef } from 'react';
import { 
  Monitor, 
  Tv, 
  Cpu, 
  Activity, 
  Wifi, 
  WifiOff,
  Clock, 
  Plus, 
  Trash2, 
  Play, 
  Square, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  RotateCcw, 
  Power, 
  Layers, 
  Calendar, 
  Camera, 
  FileText, 
  Check, 
  AlertCircle, 
  PlusCircle, 
  Server, 
  Settings, 
  Key,
  Copy,
  Terminal,
  Download,
  Sliders,
  ChevronRight,
  RefreshCw,
  Info,
  X
} from 'lucide-react';
import { Device, DeviceGroup, DeviceSchedule, DeviceLog, PlaybackHistory, StreamSession } from '../types';

interface DeviceManagerProps {
  token: string | null;
  streams: StreamSession[];
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({ token, streams }) => {
  // States
  const [devices, setDevices] = useState<Device[]>([]);
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [schedules, setSchedules] = useState<DeviceSchedule[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroup | null>(null);
  
  // Real-time Logs
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [history, setHistory] = useState<PlaybackHistory[]>([]);

  // Modals & Inputs
  const [pairingCode, setPairingCode] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceLocation, setNewDeviceLocation] = useState('');
  const [newDeviceDesc, setNewDeviceDesc] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [groupToDeleteId, setGroupToDeleteId] = useState<string | null>(null);

  // Editing states
  const [isEditingDevice, setIsEditingDevice] = useState(false);
  const [editDeviceName, setEditDeviceName] = useState('');
  const [editDeviceLocation, setEditDeviceLocation] = useState('');
  const [editDeviceDesc, setEditDeviceDesc] = useState('');

  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  
  // Schedule input
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedAction, setSchedAction] = useState<'play' | 'stop'>('play');
  const [schedStreamId, setSchedStreamId] = useState('');
  const [schedCustomUrl, setSchedCustomUrl] = useState('');

  // General Controls
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [customStreamUrl, setCustomStreamUrl] = useState('');
  const [volumeValue, setVolumeValue] = useState<number>(100);

  // Remote Configuration States
  const [brightnessValue, setBrightnessValue] = useState<number>(100);
  const [rotationValue, setRotationValue] = useState<string>('0');
  const [resolutionValue, setResolutionValue] = useState<string>('1920x1080');
  const [wifiSsid, setWifiSsid] = useState<string>('');
  const [wifiPassword, setWifiPassword] = useState<string>('');
  const [hwdecValue, setHwdecValue] = useState<string>('auto');
  const [cacheSizeValue, setCacheSizeValue] = useState<number>(32);
  const [audioDriverValue, setAudioDriverValue] = useState<string>('alsa');
  const [otaTargetVersion, setOtaTargetVersion] = useState<string>('1.1.0');

  // Active view tabs
  const [subTab, setSubTab] = useState<'all' | 'groups' | 'schedules' | 'docs'>('all');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Auto-clear status messages
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Fetch initial data
  const fetchData = async () => {
    if (!token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Fetch devices
      const devRes = await fetch('/api/devices', { headers });
      if (devRes.ok) {
        const devData = await devRes.json();
        setDevices(devData);
        if (devData.length > 0 && !selectedDevice) {
          setSelectedDevice(devData[0]);
        }
      }

      // Fetch groups
      const grpRes = await fetch('/api/device-groups', { headers });
      if (grpRes.ok) {
        const grpData = await grpRes.json();
        setGroups(grpData);
      }

      // Fetch schedules
      const schedRes = await fetch('/api/devices/schedules', { headers });
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        setSchedules(schedData);
      }
    } catch (err) {
      console.error('Error fetching device manager data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Fallback polling if WebSocket fails or lags
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // Establish real-time WebSocket connection for Dashboards
  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/dashboard-ws`;
    
    const connectWs = () => {
      console.log('[Dashboard WS] Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'device_status') {
            setDevices(prev => prev.map(d => d.id === msg.deviceId ? { ...d, online_status: msg.status } : d));
            if (selectedDevice?.id === msg.deviceId) {
              setSelectedDevice(prev => prev ? { ...prev, online_status: msg.status } : null);
            }
          } 
          
          else if (msg.type === 'device_heartbeat') {
            setDevices(prev => prev.map(d => d.id === msg.deviceId ? { ...d, ...msg.stats } : d));
            if (selectedDevice?.id === msg.deviceId) {
              setSelectedDevice(prev => prev ? { ...prev, ...msg.stats } : null);
            }
          } 
          
          else if (msg.type === 'device_paired') {
            setStatusMessage({ text: `Device "${msg.device.name}" successfully paired!`, type: 'success' });
            fetchData();
          } 
          
          else if (msg.type === 'device_log') {
            if (selectedDevice?.id === msg.deviceId) {
              setLogs(prev => [msg.log, ...prev].slice(0, 100));
            }
          } 
          
          else if (msg.type === 'device_playback_state') {
            setDevices(prev => prev.map(d => d.id === msg.deviceId ? { 
              ...d, 
              online_status: msg.status === 'playing' ? 'playing' : msg.status === 'buffering' ? 'buffering' : 'stopped',
              current_stream_id: msg.streamId,
              current_stream_url: msg.streamUrl
            } : d));
            
            if (selectedDevice?.id === msg.deviceId) {
              setSelectedDevice(prev => prev ? { 
                ...prev, 
                online_status: msg.status === 'playing' ? 'playing' : msg.status === 'buffering' ? 'buffering' : 'stopped',
                current_stream_id: msg.streamId,
                current_stream_url: msg.streamUrl
              } : null);
            }
          }
        } catch (err) {
          console.error('[Dashboard WS] Error parsing message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[Dashboard WS] Disconnected. Reconnecting in 3 seconds...');
        setTimeout(connectWs, 3000);
      };

      ws.onerror = (err) => {
        console.error('[Dashboard WS] Error:', err);
      };
    };

    connectWs();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [token, selectedDevice?.id]);

  // Fetch device specific logs and history when device selection changes
  useEffect(() => {
    if (!selectedDevice || !token) return;

    const fetchDeviceDetails = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Fetch logs
        const logsRes = await fetch(`/api/devices/${selectedDevice.id}/logs`, { headers });
        if (logsRes.ok) setLogs(await logsRes.json());

        // Fetch history
        const histRes = await fetch(`/api/devices/${selectedDevice.id}/history`, { headers });
        if (histRes.ok) setHistory(await histRes.json());

        setVolumeValue(selectedDevice.current_volume ?? 100);
        setBrightnessValue(selectedDevice.brightness ?? 100);
        setRotationValue(selectedDevice.rotation ?? '0');
        setResolutionValue(selectedDevice.current_resolution ?? '1920x1080');
        
        if (selectedDevice.network_settings) {
          try {
            const net = typeof selectedDevice.network_settings === 'string' ? JSON.parse(selectedDevice.network_settings) : selectedDevice.network_settings;
            setWifiSsid(net.ssid || '');
            setWifiPassword(net.password || '');
          } catch (err) {
            console.error('Error parsing network_settings:', err);
          }
        } else {
          setWifiSsid('');
          setWifiPassword('');
        }

        if (selectedDevice.player_settings) {
          try {
            const play = typeof selectedDevice.player_settings === 'string' ? JSON.parse(selectedDevice.player_settings) : selectedDevice.player_settings;
            setHwdecValue(play.hwdec || 'auto');
            setCacheSizeValue(play.cacheSize || 32);
            setAudioDriverValue(play.audioDriver || 'alsa');
          } catch (err) {
            console.error('Error parsing player_settings:', err);
          }
        } else {
          setHwdecValue('auto');
          setCacheSizeValue(32);
          setAudioDriverValue('alsa');
        }
      } catch (e) {
        console.error('Failed to load device detail logs/history:', e);
      }
    };

    fetchDeviceDetails();
  }, [selectedDevice?.id, token]);

  // API Call Helpers
  const sendCommand = async (deviceId: string, command: string, args?: any) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command, args })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: `Remote command "${command.toUpperCase()}" dispatched successfully.`, type: 'success' });
        fetchData();
      } else {
        setStatusMessage({ text: data.error || 'Failed to send remote command.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Network connection failure while dispatching command.', type: 'error' });
    }
  };

  const handleSaveRemoteConfig = async () => {
    if (!selectedDevice || !token) return;
    try {
      const res = await fetch(`/api/devices/${selectedDevice.id}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          brightness: brightnessValue,
          rotation: rotationValue,
          current_resolution: resolutionValue,
          current_volume: volumeValue,
          network_settings: { ssid: wifiSsid, password: wifiPassword },
          player_settings: { hwdec: hwdecValue, cacheSize: cacheSizeValue, audioDriver: audioDriverValue }
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: 'Remote configurations saved and dispatched to Raspberry Pi successfully.', type: 'success' });
        fetchData();
      } else {
        setStatusMessage({ text: data.error || 'Failed to apply remote configurations.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Error applying remote configurations.', type: 'error' });
    }
  };

  const handleTriggerOTAUpdate = async () => {
    if (!selectedDevice || !token) return;
    try {
      const res = await fetch(`/api/devices/${selectedDevice.id}/ota-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetVersion: otaTargetVersion,
          updateUrl: `${window.location.protocol}//${window.location.host}/streampulse-agent-latest.py`
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: `Remote OTA update triggered successfully for target version ${otaTargetVersion}!`, type: 'success' });
        fetchData();
      } else {
        setStatusMessage({ text: data.error || 'Failed to dispatch OTA update.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Error dispatching OTA update.', type: 'error' });
    }
  };

  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingCode) return;
    try {
      const res = await fetch('/api/devices/pair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          pairingCode,
          name: newDeviceName || undefined,
          location: newDeviceLocation || undefined,
          description: newDeviceDesc || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: 'Device successfully paired and authorized!', type: 'success' });
        setPairingCode('');
        setNewDeviceName('');
        setNewDeviceLocation('');
        setNewDeviceDesc('');
        fetchData();
      } else {
        setStatusMessage({ text: data.error || 'Invalid pairing code.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Pairing registration failed.', type: 'error' });
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm('Are you sure you want to de-register and remove this device? This will revoke its credentials.')) return;
    try {
      const res = await fetch(`/api/devices/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setStatusMessage({ text: 'Device removed successfully.', type: 'success' });
        setSelectedDevice(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlayStream = () => {
    if (!selectedDevice) return;
    
    let streamUrl = '';
    let streamId = '';

    if (selectedStreamId) {
      const found = streams.find(s => s.id === selectedStreamId);
      if (found) {
        streamUrl = found.rtmpUrl; // Ingest RTMP playback url
        streamId = found.id;
      }
    } else if (customStreamUrl) {
      streamUrl = customStreamUrl;
      streamId = 'custom';
    }

    if (!streamUrl) {
      setStatusMessage({ text: 'Please select a broadcast channel or provide a custom stream URL.', type: 'error' });
      return;
    }

    sendCommand(selectedDevice.id, 'play', { streamId, streamUrl });
  };

  // Group Creators
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName) return;
    try {
      const res = await fetch('/api/device-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newGroupName, description: newGroupDesc })
      });
      if (res.ok) {
        setStatusMessage({ text: `Group "${newGroupName}" created successfully.`, type: 'success' });
        setNewGroupName('');
        setNewGroupDesc('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !token) return;
    try {
      const res = await fetch(`/api/devices/${selectedDevice.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editDeviceName,
          location: editDeviceLocation,
          description: editDeviceDesc
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedDevice(updated);
        setStatusMessage({ text: 'Device updated successfully.', type: 'success' });
        setIsEditingDevice(false);
        fetchData();
      } else {
        setStatusMessage({ text: 'Failed to update device.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ text: 'Error updating device details.', type: 'error' });
    }
  };

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !token) return;
    try {
      const res = await fetch(`/api/device-groups/${selectedGroup.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editGroupName,
          description: editGroupDesc
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedGroup(updated);
        setStatusMessage({ text: 'Group updated successfully.', type: 'success' });
        setIsEditingGroup(false);
        fetchData();
      } else {
        setStatusMessage({ text: 'Failed to update group.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ text: 'Error updating group details.', type: 'error' });
    }
  };

  const handleAddDeviceToGroup = async (groupId: string, deviceId: string) => {
    try {
      const res = await fetch(`/api/device-groups/${groupId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ deviceId })
      });
      if (res.ok) {
        setStatusMessage({ text: 'Device added to group.', type: 'success' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveDeviceFromGroup = async (groupId: string, deviceId: string) => {
    try {
      const res = await fetch(`/api/device-groups/${groupId}/members/${deviceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setStatusMessage({ text: 'Device removed from group.', type: 'success' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const res = await fetch(`/api/device-groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setStatusMessage({ text: 'Group deleted successfully.', type: 'success' });
        setSelectedGroup(null);
        fetchData();
      } else {
        const errData = await res.json().catch(() => ({}));
        setStatusMessage({ text: errData.error || 'Failed to delete group.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ text: 'An unexpected error occurred while deleting the group.', type: 'error' });
    } finally {
      setGroupToDeleteId(null);
    }
  };

  const handleSendGroupCommand = async (groupId: string, command: string) => {
    let streamUrl = '';
    let streamId = '';

    if (command === 'play') {
      if (selectedStreamId) {
        const found = streams.find(s => s.id === selectedStreamId);
        if (found) {
          streamUrl = found.rtmpUrl;
          streamId = found.id;
        }
      } else if (customStreamUrl) {
        streamUrl = customStreamUrl;
        streamId = 'custom';
      }

      if (!streamUrl) {
        setStatusMessage({ text: 'Please select a broadcast channel for group playback.', type: 'error' });
        return;
      }
    }

    try {
      const res = await fetch(`/api/device-groups/${groupId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command, args: { streamId, streamUrl } })
      });
      if (res.ok) {
        setStatusMessage({ text: `Group broadcast command "${command.toUpperCase()}" sent successfully.`, type: 'success' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Schedules
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    let streamUrl = '';
    let streamId = '';

    if (schedAction === 'play') {
      if (schedStreamId) {
        const found = streams.find(s => s.id === schedStreamId);
        if (found) {
          streamUrl = found.rtmpUrl;
          streamId = found.id;
        }
      } else if (schedCustomUrl) {
        streamUrl = schedCustomUrl;
        streamId = 'custom';
      }
    }

    try {
      const body: any = {
        time: schedTime,
        action: schedAction,
        enabled: true
      };

      if (selectedDevice) {
        body.device_id = selectedDevice.id;
      } else if (selectedGroup) {
        body.group_id = selectedGroup.id;
      } else {
        setStatusMessage({ text: 'Please select a target device or group to attach schedule.', type: 'error' });
        return;
      }

      if (schedAction === 'play') {
        body.stream_id = streamId;
        body.stream_url = streamUrl;
      }

      const res = await fetch('/api/devices/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setStatusMessage({ text: 'Schedule created successfully.', type: 'success' });
        setSchedCustomUrl('');
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const res = await fetch(`/api/devices/schedules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setStatusMessage({ text: 'Schedule deleted.', type: 'success' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // UI Status color mapping
  const getStatusBadge = (status: Device['online_status']) => {
    switch (status) {
      case 'online':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>ONLINE</span>;
      case 'playing':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>PLAYING</span>;
      case 'buffering':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-spin"></span>BUFFERING</span>;
      case 'stopped':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-700/30 text-zinc-400 border border-zinc-700/50 flex items-center gap-1">STOPPED</span>;
      case 'offline':
      case 'disconnected':
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">OFFLINE</span>;
    }
  };

  // Pi Native Installation files
  const agentScriptCode = `#!/usr/bin/env python3
import os
import sys
import time
import json
import socket
import psutil
import urllib.request
import subprocess
import threading
import websockets
import asyncio

# Config settings
CONFIG_FILE = os.path.expanduser('~/.streampulse_config.json')
CORE_SERVER = "${window.location.protocol}//${window.location.host}"
WS_SERVER = "ws://${window.location.host}/api/device-ws" if "${window.location.protocol}" == "http:" else "wss://${window.location.host}/api/device-ws"

device_state = {
    "paired": False,
    "token": "",
    "device_id": "",
    "current_process": None,
    "current_stream_url": ""
}

def load_config():
    global device_state
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                saved = json.load(f)
                device_state.update(saved)
        except Exception as e:
            print(f"Error loading config: {e}")

def save_config():
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump({
                "paired": device_state["paired"],
                "token": device_state["token"],
                "device_id": device_state["device_id"]
            }, f)
    except Exception as e:
        print(f"Error saving config: {e}")

def get_mac_address():
    try:
        import uuid
        mac = ':'.join(['{:02x}'.format((uuid.getnode() >> ele) & 0xff) for ele in range(0,8*6,8)][::-1])
        return mac
    except:
        return "00:11:22:33:44:55"

def get_ip_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def get_cpu_temp():
    try:
        with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
            temp = float(f.read()) / 1000.0
            return round(temp, 1)
    except:
        return 42.5

# Device Actions / Receivers
def play_stream(url):
    stop_stream()
    print(f"Playing stream: {url}")
    try:
        # Launch mpv in fullscreen, no controls, optimized for low latency hardware acceleration on Pi
        cmd = ["mpv", "--fs", "--ontop", "--no-osc", "--no-osd-bar", "--cache=yes", "--cache-secs=5", url]
        process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        device_state["current_process"] = process
        device_state["current_stream_url"] = url
        return True
    except Exception as e:
        print(f"Failed to launch MPV: {e}")
        return False

def stop_stream():
    if device_state["current_process"]:
        try:
            device_state["current_process"].terminate()
            device_state["current_process"].wait(timeout=3)
        except:
            try:
                device_state["current_process"].kill()
            except:
                pass
        device_state["current_process"] = None
        device_state["current_stream_url"] = ""

async def register_device():
    mac = get_mac_address()
    ip = get_ip_address()
    hostname = socket.gethostname()
    
    payload = {
        "deviceId": device_state["device_id"],
        "name": f"StreamPulse Pi ({hostname})",
        "mac_address": mac,
        "os_version": "Raspbian GNU/Linux 12 (bookworm)",
        "player_version": "MPV 0.35.1",
        "ip_address": ip
    }
    
    while not device_state["paired"]:
        try:
            req = urllib.request.Request(
                f"{CORE_SERVER}/api/devices/register",
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req) as response:
                res = json.loads(response.read().decode())
                device_state["device_id"] = res["deviceId"]
                if res.get("paired"):
                    device_state["paired"] = True
                    device_state["token"] = res["token"]
                    save_config()
                    print("Device successfully paired!")
                    break
                else:
                    print(f"Awaiting activation. ENTER PAIRING CODE on StreamPulse Web Portal: {res['pairingCode']}")
                    time.sleep(10)
        except Exception as e:
            print(f"Error registering device. Server might be offline. Retrying in 10s... ({e})")
            time.sleep(10)

async def heartbeat_sender(websocket):
    while True:
        try:
            cpu = psutil.cpu_percent()
            ram = psutil.virtual_memory().percent
            temp = get_cpu_temp()
            
            # Simple bandwidth checker
            speed = f"{round(psutil.net_io_counters().bytes_sent / 1024 / 1024, 1)} Mbps"
            
            playback_status = "idle"
            if device_state["current_process"]:
                poll = device_state["current_process"].poll()
                if poll is None:
                    playback_status = "playing"
                else:
                    playback_status = "stopped"
                    device_state["current_process"] = None

            screenshot_b64 = ""
            # Take framebuffer screenshot (optional, requires scrot installed)
            if playback_status == "playing":
                try:
                    subprocess.run(["scrot", "-z", "/tmp/screen.jpg"], capture_output=True)
                    if os.path.exists("/tmp/screen.jpg"):
                        import base64
                        with open("/tmp/screen.jpg", "rb") as image_file:
                            screenshot_b64 = "data:image/jpeg;base64," + base64.b64encode(image_file.read()).decode('utf-8')
                except:
                    pass

            payload = {
                "type": "heartbeat",
                "cpu_usage": cpu,
                "ram_usage": ram,
                "temperature": temp,
                "network_speed": speed,
                "online_status": "playing" if playback_status == "playing" else "online",
                "current_playback_status": playback_status,
                "current_stream_url": device_state["current_stream_url"]
            }
            if screenshot_b64:
                payload["screenshot"] = screenshot_b64

            await websocket.send(json.dumps(payload))
            await asyncio.sleep(10)
        except Exception as e:
            print(f"Error sending heartbeat: {e}")
            break

async def ws_loop():
    uri = f"{WS_SERVER}?token={device_state['token']}"
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print("Connected to StreamPulse VPS Core WebSocket.")
                
                # Start heartbeat thread task
                heartbeat_task = asyncio.create_task(heartbeat_sender(websocket))
                
                async for message in websocket:
                    data = json.loads(message)
                    print(f"Received command: {data}")
                    
                    if data.get("type") == "command":
                        cmd = data.get("command")
                        args = data.get("args", {})
                        
                        if cmd == "play":
                            play_stream(args.get("streamUrl"))
                        elif cmd == "stop":
                            stop_stream()
                        elif cmd == "volume":
                            vol = args.get("volume", 100)
                            # Set system volume
                            subprocess.run(["amixer", "set", "Master", f"{vol}%"], capture_output=True)
                        elif cmd == "restart_player":
                            if device_state["current_stream_url"]:
                                play_stream(device_state["current_stream_url"])
                        elif cmd == "restart_device":
                            os.system("sudo reboot")
                        elif cmd == "shutdown_device":
                            os.system("sudo poweroff")

                    elif data.get("type") == "configure":
                        cfg = data.get("config", {})
                        if "volume" in cfg and cfg["volume"] is not None:
                            vol = cfg["volume"]
                            subprocess.run(["amixer", "set", "Master", f"{vol}%"], capture_output=True)
                        if "brightness" in cfg and cfg["brightness"] is not None:
                            bri = cfg["brightness"]
                            os.system(f"brightnessctl set {bri}% || echo {bri} > /sys/class/backlight/rpi_backlight/brightness || xrandr --brightness {bri/100.0}")
                        if "rotation" in cfg and cfg["rotation"] is not None:
                            rot = cfg["rotation"]
                            rot_map = {"0": "normal", "90": "right", "180": "inverted", "270": "left"}
                            os.system(f"xrandr --rotate {rot_map.get(rot, 'normal')}")
                        if "resolution" in cfg and cfg["resolution"] is not None:
                            res = cfg["resolution"]
                            os.system(f"xrandr -s {res}")
                        if "network_settings" in cfg and cfg["network_settings"] is not None:
                            net = cfg["network_settings"]
                            ssid = net.get("ssid")
                            pwd = net.get("password")
                            if ssid:
                                os.system(f"nmcli dev wifi connect '{ssid}' password '{pwd}'")
                        if "player_settings" in cfg and cfg["player_settings"] is not None:
                            print("Updated local player options configuration cache.")

                    elif data.get("type") == "ota_update":
                        target_ver = data.get("version", "1.1.0")
                        update_url = data.get("url")
                        if update_url:
                            print(f"Executing remote OTA update to v{target_ver} from {update_url}...")
                            try:
                                urllib.request.urlretrieve(update_url, "streampulse-agent-temp.py")
                                os.replace("streampulse-agent-temp.py", __file__)
                                print("OTA self-overwrite successful! Reloading process...")
                                os.execv(sys.executable, [sys.executable] + sys.argv)
                            except Exception as ota_err:
                                print(f"OTA update failed: {ota_err}")
                
                heartbeat_task.cancel()
        except Exception as e:
            print(f"WS Disconnected: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5)

async def main():
    load_config()
    await register_device()
    await ws_loop()

if __name__ == "__main__":
    asyncio.run(main())
`;

  const systemdServiceCode = `[Unit]
Description=StreamPulse Receiver Native Player Daemon
After=network.target sound.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/streampulse-agent.py
Restart=always
RestartSec=10
Environment=DISPLAY=:0

[Install]
WantedBy=graphical.target`;

  return (
    <div className="space-y-6">
      {/* Custom Delete Confirmation Modal */}
      {groupToDeleteId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-xl shrink-0 border border-red-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-100">Delete Device Group?</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Are you sure you want to delete this group? Connected displays will not be deleted, but they will be removed from this logical setup immediately.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-900">
              <button 
                type="button"
                onClick={() => setGroupToDeleteId(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors border border-zinc-800"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => handleDeleteGroup(groupToDeleteId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-red-950/30"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Device Modal */}
      {isEditingDevice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleEditDevice} className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl shrink-0 border border-blue-500/20">
                <Settings className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-100">Edit Device Details</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Modify metadata, naming structure, and location tags for this display receiver.
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Device Name</label>
                <input 
                  type="text" 
                  required
                  value={editDeviceName}
                  onChange={(e) => setEditDeviceName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Location Tag</label>
                <input 
                  type="text" 
                  value={editDeviceLocation}
                  onChange={(e) => setEditDeviceLocation(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Description</label>
                <textarea 
                  value={editDeviceDesc}
                  onChange={(e) => setEditDeviceDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none h-20 resize-none"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-900">
              <button 
                type="button"
                onClick={() => setIsEditingDevice(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors border border-zinc-800"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-blue-950/30"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Group Modal */}
      {isEditingGroup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleEditGroup} className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl shrink-0 border border-blue-500/20">
                <Settings className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-100">Edit Group Details</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Modify metadata, naming structure, and purpose tags for this logical monitors setup.
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Group Name</label>
                <input 
                  type="text" 
                  required
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Group Description</label>
                <textarea 
                  value={editGroupDesc}
                  onChange={(e) => setEditGroupDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none h-20 resize-none"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-900">
              <button 
                type="button"
                onClick={() => setIsEditingGroup(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors border border-zinc-800"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-blue-950/30"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-zinc-100">
            <Monitor className="w-6 h-6 text-blue-500 animate-pulse" /> RPi StreamPulse Receiver System
          </h2>
          <p className="text-xs text-zinc-500">Manage Raspberry Pi monitors, pair streaming boards, trigger schedules, and broadcast live video output.</p>
        </div>
        
        {/* Sub Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button 
            onClick={() => setSubTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${subTab === 'all' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          >
            <Monitor className="w-3.5 h-3.5" /> Receivers ({devices.length})
          </button>
          <button 
            onClick={() => setSubTab('groups')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${subTab === 'groups' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          >
            <Layers className="w-3.5 h-3.5" /> Monitor Groups ({groups.length})
          </button>
          <button 
            onClick={() => setSubTab('schedules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${subTab === 'schedules' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          >
            <Clock className="w-3.5 h-3.5" /> Automation Schedules ({schedules.length})
          </button>
          <button 
            onClick={() => setSubTab('docs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${subTab === 'docs' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          >
            <Terminal className="w-3.5 h-3.5" /> Pi Installer Setup
          </button>
        </div>
      </div>

      {/* Alert Banner / Status Message */}
      {statusMessage && (
        <div className={`p-4 border rounded-xl flex items-start gap-3 shadow-lg ${statusMessage.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {statusMessage.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <div>
            <p className="text-xs font-bold">{statusMessage.type === 'success' ? 'Operation Success' : 'Error Notice'}</p>
            <p className="text-xs mt-0.5">{statusMessage.text}</p>
          </div>
        </div>
      )}

      {/* SUB TAB 1: ALL RECEIVERS */}
      {subTab === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Device list & Pairing */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Pairing / Register Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-3 text-zinc-200">
                <Key className="w-4 h-4 text-orange-500" /> Pair New Board
              </h3>
              <p className="text-xs text-zinc-500 mb-4">Enter the 6-digit dynamic pairing code shown on your connected TV monitor after launching the native client software.</p>
              
              <form onSubmit={handlePairDevice} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono">Pairing Authorization Code</label>
                  <input 
                    type="text" 
                    required
                    maxLength={6}
                    placeholder="e.g. A7KD92" 
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                    className="w-full text-center bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-lg font-bold tracking-widest text-zinc-100 placeholder-zinc-700 focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Board Alias Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Lobby Left Panel" 
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Physical Location</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Reception Desk" 
                    value={newDeviceLocation}
                    onChange={(e) => setNewDeviceLocation(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={!pairingCode}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <PlusCircle className="w-4 h-4" /> Authenticate Receiver
                </button>
              </form>
            </div>

            {/* Device list sidebar */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Device Directory</h3>
                <span className="text-[10px] text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 font-mono">{devices.length} boards</span>
              </div>

              {devices.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 space-y-2 border border-dashed border-zinc-800 rounded-xl">
                  <Monitor className="w-8 h-8 text-zinc-700 mx-auto" />
                  <p className="text-xs font-medium">No streaming receivers paired.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
                  {devices.map(dev => (
                    <button
                      key={dev.id}
                      onClick={() => setSelectedDevice(dev)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${selectedDevice?.id === dev.id ? 'bg-blue-600/10 border-blue-500/30 shadow' : 'bg-zinc-950/30 border-zinc-800/60 hover:bg-zinc-900'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-zinc-100 truncate">{dev.name}</h4>
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">{dev.location || 'No location configured'}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {getStatusBadge(dev.online_status)}
                        <span className="text-[9px] font-mono text-zinc-600">{dev.ip_address || 'No IP'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Device controller workspace */}
          <div className="lg:col-span-8">
            {selectedDevice ? (
              <div className="space-y-6">
                
                {/* Device Title & Header */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5 mb-5">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-blue-600/15 rounded-xl border border-blue-500/20 text-blue-500">
                          <Monitor className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">{selectedDevice.name}</h3>
                          <p className="text-xs text-zinc-500 mt-0.5">Location: <span className="text-zinc-300 font-semibold">{selectedDevice.location || 'N/A'}</span> • {selectedDevice.description || 'Dedicated HDMI board'}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(selectedDevice.online_status)}
                      <button 
                        onClick={() => {
                          setEditDeviceName(selectedDevice.name);
                          setEditDeviceLocation(selectedDevice.location || '');
                          setEditDeviceDesc(selectedDevice.description || '');
                          setIsEditingDevice(true);
                        }}
                        className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/5 rounded-lg border border-zinc-800 transition-colors"
                        title="Edit Device"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteDevice(selectedDevice.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg border border-zinc-800 transition-colors"
                        title="Delete Device"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Remote Playback Assigner */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end bg-zinc-950/40 p-5 border border-zinc-800/80 rounded-xl mb-6">
                    <div className="md:col-span-5 space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Select Live Channel</label>
                      <select
                        value={selectedStreamId}
                        onChange={(e) => {
                          setSelectedStreamId(e.target.value);
                          setCustomStreamUrl('');
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      >
                        <option value="">-- Choose active stream --</option>
                        {streams.map(s => (
                          <option key={s.id} value={s.id}>{s.title} ({s.broadcaster}) [{s.status.toUpperCase()}]</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-5 space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Or Custom Stream URL (HLS / DASH / RTMP / MP4)</label>
                      <input 
                        type="text" 
                        placeholder="https://example.com/playlist.m3u8"
                        value={customStreamUrl}
                        onChange={(e) => {
                          setCustomStreamUrl(e.target.value);
                          setSelectedStreamId('');
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        onClick={handlePlayStream}
                        disabled={selectedDevice.online_status === 'offline'}
                        className="w-full h-9 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-green-950/20"
                      >
                        <Play className="w-3.5 h-3.5" /> CAST PLAY
                      </button>
                    </div>
                  </div>

                  {/* Remote Controllers & Diagnostics Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Remote Controller buttons */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-800/80 pb-2">
                        <Sliders className="w-3.5 h-3.5 text-blue-500" /> Deck Controllers
                      </h4>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <button
                          onClick={() => sendCommand(selectedDevice.id, 'resume')}
                          disabled={selectedDevice.online_status === 'offline'}
                          className="flex flex-col items-center justify-center p-3 bg-zinc-950/30 hover:bg-zinc-800 border border-zinc-800/80 rounded-xl transition-all disabled:opacity-40 text-zinc-200"
                        >
                          <Play className="w-5 h-5 text-green-500 mb-1" />
                          <span className="text-[10px] font-bold">Resume</span>
                        </button>
                        <button
                          onClick={() => sendCommand(selectedDevice.id, 'pause')}
                          disabled={selectedDevice.online_status === 'offline'}
                          className="flex flex-col items-center justify-center p-3 bg-zinc-950/30 hover:bg-zinc-800 border border-zinc-800/80 rounded-xl transition-all disabled:opacity-40 text-zinc-200"
                        >
                          <Pause className="w-5 h-5 text-amber-500 mb-1" />
                          <span className="text-[10px] font-bold">Pause</span>
                        </button>
                        <button
                          onClick={() => sendCommand(selectedDevice.id, 'stop')}
                          disabled={selectedDevice.online_status === 'offline'}
                          className="flex flex-col items-center justify-center p-3 bg-zinc-950/30 hover:bg-zinc-800 border border-zinc-800/80 rounded-xl transition-all disabled:opacity-40 text-zinc-200"
                        >
                          <Square className="w-5 h-5 text-red-500 mb-1" />
                          <span className="text-[10px] font-bold">Stop Stream</span>
                        </button>
                        <button
                          onClick={() => sendCommand(selectedDevice.id, 'volume', { volume: 0 })}
                          disabled={selectedDevice.online_status === 'offline'}
                          className="flex flex-col items-center justify-center p-3 bg-zinc-950/30 hover:bg-zinc-800 border border-zinc-800/80 rounded-xl transition-all disabled:opacity-40 text-zinc-200"
                        >
                          <VolumeX className="w-5 h-5 text-zinc-400 mb-1" />
                          <span className="text-[10px] font-bold">Mute HDMI</span>
                        </button>
                        <button
                          onClick={() => sendCommand(selectedDevice.id, 'volume', { volume: 100 })}
                          disabled={selectedDevice.online_status === 'offline'}
                          className="flex flex-col items-center justify-center p-3 bg-zinc-950/30 hover:bg-zinc-800 border border-zinc-800/80 rounded-xl transition-all disabled:opacity-40 text-zinc-200"
                        >
                          <Volume2 className="w-5 h-5 text-blue-400 mb-1" />
                          <span className="text-[10px] font-bold">Unmute Audio</span>
                        </button>
                        <button
                          onClick={() => sendCommand(selectedDevice.id, 'restart_player')}
                          disabled={selectedDevice.online_status === 'offline'}
                          className="flex flex-col items-center justify-center p-3 bg-zinc-950/30 hover:bg-zinc-800 border border-zinc-800/80 rounded-xl transition-all disabled:opacity-40 text-zinc-200"
                        >
                          <RotateCcw className="w-5 h-5 text-indigo-400 mb-1" />
                          <span className="text-[10px] font-bold">Reset Player</span>
                        </button>
                      </div>

                      {/* Hardware Controllers */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-zinc-800/60">
                        <button
                          onClick={() => sendCommand(selectedDevice.id, 'restart_device')}
                          disabled={selectedDevice.online_status === 'offline'}
                          className="flex items-center justify-center gap-2 py-2 px-3 bg-orange-600/10 hover:bg-orange-600/20 border border-orange-500/20 rounded-lg transition-all disabled:opacity-40 text-orange-400 font-semibold text-[11px]"
                        >
                          <Power className="w-3.5 h-3.5 animate-spin-slow" /> REBOOT PI
                        </button>
                        <button
                          onClick={() => sendCommand(selectedDevice.id, 'shutdown_device')}
                          disabled={selectedDevice.online_status === 'offline'}
                          className="flex items-center justify-center gap-2 py-2 px-3 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg transition-all disabled:opacity-40 text-red-400 font-semibold text-[11px]"
                        >
                          <Power className="w-3.5 h-3.5" /> SHUTDOWN PI
                        </button>
                      </div>

                      {/* Volume Slider */}
                      <div className="space-y-1.5 bg-zinc-950/30 p-3 rounded-lg border border-zinc-800">
                        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
                          <span>OUTPUT VOLUME</span>
                          <span>{volumeValue}%</span>
                        </div>
                        <input 
                          type="range" 
                          min={0}
                          max={100}
                          value={volumeValue}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setVolumeValue(val);
                            sendCommand(selectedDevice.id, 'volume', { volume: val });
                          }}
                          disabled={selectedDevice.online_status === 'offline'}
                          className="w-full accent-blue-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                        />
                      </div>
                    </div>

                    {/* Live Preview Screenshot */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between border-b border-zinc-800/80 pb-2">
                        <span className="flex items-center gap-1.5"><Camera className="w-3.5 h-3.5 text-emerald-500" /> HDMI Monitor Frame</span>
                        {selectedDevice.screenshot_time && (
                          <span className="text-[8px] text-zinc-600 font-mono">Updated: {new Date(selectedDevice.screenshot_time).toLocaleTimeString()}</span>
                        )}
                      </h4>
                      
                      <div className="aspect-video bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden relative group">
                        <img 
                          src={`/api/devices/${selectedDevice.id}/screenshot?t=${selectedDevice.screenshot_time || ''}`} 
                          alt="Device output preview"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60"></div>
                        <div className="absolute bottom-3 left-3 text-[10px] bg-zinc-900/90 text-zinc-300 px-2 py-0.5 rounded border border-zinc-800">
                          {selectedDevice.current_playback_status === 'playing' ? `Playing: ${selectedDevice.current_stream_id || 'Custom url'}` : 'Player Stopped'}
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

                {/* Pi Health Resource Diagnostics */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4 border-b border-zinc-800 pb-3 text-zinc-200">
                    <Cpu className="w-4 h-4 text-emerald-500" /> Pi Telemetry Diagnostics
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-950/30 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 font-bold block uppercase">CPU CORE LOAD</span>
                      <span className="text-lg font-bold text-zinc-100 font-mono mt-0.5 block">{selectedDevice.cpu_usage || 0}%</span>
                      <div className="h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${selectedDevice.cpu_usage || 0}%` }}></div>
                      </div>
                    </div>

                    <div className="bg-zinc-950/30 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 font-bold block uppercase">RAM ALLOCATION</span>
                      <span className="text-lg font-bold text-zinc-100 font-mono mt-0.5 block">{selectedDevice.ram_usage || 0}%</span>
                      <div className="h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-teal-500" style={{ width: `${selectedDevice.ram_usage || 0}%` }}></div>
                      </div>
                    </div>

                    <div className="bg-zinc-950/30 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 font-bold block uppercase">CORE TEMP</span>
                      <span className="text-lg font-bold text-zinc-100 font-mono mt-0.5 block">{selectedDevice.temperature || 0}°C</span>
                      <div className="h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: `${(selectedDevice.temperature || 30) * 1.2}%` }}></div>
                      </div>
                    </div>

                    <div className="bg-zinc-950/30 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 font-bold block uppercase">NETWORK SPEED</span>
                      <span className="text-sm font-bold text-zinc-100 font-mono mt-1.5 block truncate">{selectedDevice.network_speed || '0 Mbps'}</span>
                    </div>
                  </div>

                  {/* Hardware Diagnostics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-800/60 text-xs">
                    <div className="space-y-2 text-zinc-400 bg-zinc-950/20 p-3 rounded-xl border border-zinc-800/40">
                      <div className="flex justify-between"><span className="text-zinc-500">Board OS</span> <span className="font-mono text-zinc-300">{selectedDevice.os_version || 'Raspberry Pi OS'}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Player Engine</span> <span className="font-mono text-zinc-300">{selectedDevice.player_version || 'MPV fullscreen v0.35'}</span></div>
                    </div>
                    <div className="space-y-2 text-zinc-400 bg-zinc-950/20 p-3 rounded-xl border border-zinc-800/40">
                      <div className="flex justify-between"><span className="text-zinc-500">IP address</span> <span className="font-mono text-zinc-300">{selectedDevice.ip_address || 'Unknown'}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">MAC address</span> <span className="font-mono text-zinc-300">{selectedDevice.mac_address || 'Unknown'}</span></div>
                    </div>
                  </div>
                </div>

                {/* Remote Configuration & OTA Updates */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4 border-b border-zinc-800 pb-3 text-zinc-200">
                    <Settings className="w-4 h-4 text-blue-500" /> Remote Device Configuration & OTA Update
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Column 1: Remote Hardware Controls */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-800/60">
                        Hardware & Screen Controls
                      </h4>

                      {/* Brightness Control */}
                      <div className="space-y-1.5 bg-zinc-950/30 p-3 rounded-xl border border-zinc-800/40">
                        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
                          <span>SCREEN BRIGHTNESS</span>
                          <span>{brightnessValue}%</span>
                        </div>
                        <input 
                          type="range" 
                          min={10}
                          max={100}
                          value={brightnessValue}
                          onChange={(e) => setBrightnessValue(parseInt(e.target.value))}
                          disabled={selectedDevice.online_status === 'offline'}
                          className="w-full accent-blue-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                        />
                      </div>

                      {/* Screen Rotation & Resolution */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase">Screen Rotation</label>
                          <select
                            value={rotationValue}
                            onChange={(e) => setRotationValue(e.target.value)}
                            disabled={selectedDevice.online_status === 'offline'}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                          >
                            <option value="0">0° (Normal)</option>
                            <option value="90">90° (Rotate Right)</option>
                            <option value="180">180° (Upside Down)</option>
                            <option value="270">270° (Rotate Left)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase">Resolution Target</label>
                          <select
                            value={resolutionValue}
                            onChange={(e) => setResolutionValue(e.target.value)}
                            disabled={selectedDevice.online_status === 'offline'}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                          >
                            <option value="1920x1080">1920x1080 @ 60Hz</option>
                            <option value="1280x720">1280x720 @ 60Hz</option>
                            <option value="3840x2160">3840x2160 @ 30Hz</option>
                            <option value="720x480">720x480 (Analog AV)</option>
                          </select>
                        </div>
                      </div>

                      {/* Wi-Fi Credential Management */}
                      <div className="space-y-3 bg-zinc-950/20 p-4 rounded-xl border border-zinc-800/50">
                        <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wider">Wi-Fi Network Configuration</span>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] text-zinc-500 uppercase">SSID Name</label>
                            <input 
                              type="text"
                              placeholder="Office_Guest_WiFi"
                              value={wifiSsid}
                              onChange={(e) => setWifiSsid(e.target.value)}
                              disabled={selectedDevice.online_status === 'offline'}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-zinc-500 uppercase">Passphrase</label>
                            <input 
                              type="password"
                              placeholder="••••••••"
                              value={wifiPassword}
                              onChange={(e) => setWifiPassword(e.target.value)}
                              disabled={selectedDevice.online_status === 'offline'}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Column 2: Player Settings & OTA */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-800/60">
                        Player Settings & OTA Updates
                      </h4>

                      {/* MPV Player Config */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 uppercase">Video Hwdec</label>
                          <select
                            value={hwdecValue}
                            onChange={(e) => setHwdecValue(e.target.value)}
                            disabled={selectedDevice.online_status === 'offline'}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-[10px] text-zinc-200 focus:ring-1 focus:ring-blue-500 outline-none"
                          >
                            <option value="auto">Auto-detect</option>
                            <option value="mmal">MMAL (Pi 3)</option>
                            <option value="v4l2m2m-copy">V4L2 (Pi 4/5)</option>
                            <option value="no">Disable</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 uppercase">Cache Size (MB)</label>
                          <input 
                            type="number"
                            min={8}
                            max={512}
                            value={cacheSizeValue}
                            onChange={(e) => setCacheSizeValue(parseInt(e.target.value) || 32)}
                            disabled={selectedDevice.online_status === 'offline'}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-[10px] text-zinc-200 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 uppercase">Audio Driver</label>
                          <select
                            value={audioDriverValue}
                            onChange={(e) => setAudioDriverValue(e.target.value)}
                            disabled={selectedDevice.online_status === 'offline'}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-[10px] text-zinc-200 focus:ring-1 focus:ring-blue-500 outline-none"
                          >
                            <option value="alsa">ALSA (HDMI/Jack)</option>
                            <option value="pulse">PulseAudio</option>
                            <option value="jack">JACK Audio</option>
                          </select>
                        </div>
                      </div>

                      {/* OTA Update Block */}
                      <div className="space-y-3 bg-blue-950/10 border border-blue-900/30 p-4 rounded-xl">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-blue-400 block uppercase tracking-wider">Remote OTA Software Update</span>
                          <span className="text-[9px] font-mono text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded">Active: v{selectedDevice.client_version || '1.0.0'}</span>
                        </div>
                        
                        <div className="flex gap-2 items-center">
                          <select
                            value={otaTargetVersion}
                            onChange={(e) => setOtaTargetVersion(e.target.value)}
                            disabled={selectedDevice.online_status === 'offline'}
                            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:ring-2 focus:ring-blue-500/50 outline-none font-mono"
                          >
                            <option value="1.0.0">v1.0.0 (LTS Release)</option>
                            <option value="1.1.0">v1.1.0 (Remote config update)</option>
                            <option value="1.2.0-beta">v1.2.0-beta (Experimental)</option>
                          </select>

                          <button
                            type="button"
                            onClick={handleTriggerOTAUpdate}
                            disabled={selectedDevice.online_status === 'offline'}
                            className="flex-1 h-8 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 disabled:opacity-40"
                          >
                            <RefreshCw className="w-3 h-3" /> TRIGGER OTA UPGRADE
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>

                  {/* Apply Button */}
                  <div className="mt-5 pt-4 border-t border-zinc-800/80 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveRemoteConfig}
                      disabled={selectedDevice.online_status === 'offline'}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg disabled:opacity-40"
                    >
                      <Check className="w-4 h-4" /> Save & Broadcast Configurations
                    </button>
                  </div>
                </div>

                {/* Device Console Logs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Native Client Logs */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-800 pb-2 mb-3">
                      <FileText className="w-3.5 h-3.5 text-zinc-400" /> Receiver Terminal Logs
                    </h4>
                    
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[10px] space-y-2 text-zinc-400">
                      {logs.length === 0 ? (
                        <div className="text-zinc-700 py-12 text-center">No terminal logging registered.</div>
                      ) : (
                        logs.map((l) => (
                          <div key={l.id} className="flex gap-2">
                            <span className="text-zinc-600 shrink-0">[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                            <span className={l.level === 'error' ? 'text-red-400 font-bold' : l.level === 'warn' ? 'text-amber-400 font-bold' : 'text-zinc-300'}>{l.message}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Playback History */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-800 pb-2 mb-3">
                      <Activity className="w-3.5 h-3.5 text-blue-500" /> Playback Session History
                    </h4>
                    
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[10px] space-y-2.5 text-zinc-400">
                      {history.length === 0 ? (
                        <div className="text-zinc-700 py-12 text-center">No historical cast play logs.</div>
                      ) : (
                        history.map((h) => (
                          <div key={h.id} className="flex items-start justify-between gap-3 border-b border-zinc-900 pb-1.5">
                            <div>
                              <span className="text-blue-400 font-bold">[{h.action.toUpperCase()}]</span>
                              <p className="text-[9px] text-zinc-500 truncate mt-0.5">{h.stream_url || 'No Media url'}</p>
                            </div>
                            <span className="text-zinc-600 text-[9px] shrink-0">{new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-16 text-center text-zinc-500 space-y-4 shadow-lg">
                <Monitor className="w-16 h-16 text-zinc-800 mx-auto animate-pulse" />
                <h3 className="text-lg font-bold text-zinc-300">Workspace Selection</h3>
                <p className="text-sm max-w-md mx-auto text-zinc-500">Pair a Raspberry Pi board or select an active authenticated monitor receiver from the directory sidebar to access diagnostics and remote controls.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* SUB TAB 2: MONITOR GROUPS */}
      {subTab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Group */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-3 text-zinc-200">
                <Plus className="w-4 h-4 text-blue-500" /> Create Monitor Group
              </h3>
              <p className="text-xs text-zinc-500 mb-4">Create logical setups such as "Office TVs", "Reception Screens" to cast content across multiple displays with 1-click.</p>
              
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Group Title</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Reception screens" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Purpose / Description</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Primary front desk displays" 
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={!newGroupName}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <PlusCircle className="w-4 h-4" /> Deploy Group
                </button>
              </form>
            </div>
            
            {/* Group listing directory */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">Group Directory</h3>
              {groups.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
                  <Layers className="w-8 h-8 text-zinc-700 mx-auto" />
                  <p className="text-xs font-medium mt-1">No groups configured.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groups.map(grp => (
                    <button
                      key={grp.id}
                      onClick={() => setSelectedGroup(grp)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${selectedGroup?.id === grp.id ? 'bg-blue-600/10 border-blue-500/30' : 'bg-zinc-950/30 border-zinc-800/60 hover:bg-zinc-900'}`}
                    >
                      <div>
                        <h4 className="text-xs font-bold text-zinc-100">{grp.name}</h4>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{grp.description || 'No description'}</p>
                      </div>
                      <span className="text-[9px] bg-zinc-950 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800 font-mono">{(grp.devices || []).length} boards</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Group Panel Workspace */}
          <div className="lg:col-span-8">
            {selectedGroup ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-6">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100">{selectedGroup.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{selectedGroup.description || 'Logical display setup'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setEditGroupName(selectedGroup.name);
                        setEditGroupDesc(selectedGroup.description || '');
                        setIsEditingGroup(true);
                      }}
                      className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/5 rounded-lg border border-zinc-800 transition-colors"
                      title="Rename/Edit Group"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setGroupToDeleteId(selectedGroup.id)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg border border-zinc-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Group playcaster */}
                <div className="bg-zinc-950/40 p-5 border border-zinc-800/80 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-green-500" /> Group Playcast Broadcaster
                  </h4>
                  <p className="text-xs text-zinc-500">Casting video feeds to a group triggers synchronous, instant fullscreen stream play on ALL online boards within the group.</p>

                  <div className="grid grid-cols-1 md:grid-cols-10 gap-4 items-end">
                    <div className="md:col-span-4 space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Select Live Channel</label>
                      <select
                        value={selectedStreamId}
                        onChange={(e) => {
                          setSelectedStreamId(e.target.value);
                          setCustomStreamUrl('');
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      >
                        <option value="">-- Choose active stream --</option>
                        {streams.map(s => (
                          <option key={s.id} value={s.id}>{s.title} ({s.broadcaster})</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-4 space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Or Custom Stream URL</label>
                      <input 
                        type="text" 
                        placeholder="https://example.com/stream.m3u8"
                        value={customStreamUrl}
                        onChange={(e) => {
                          setCustomStreamUrl(e.target.value);
                          setSelectedStreamId('');
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        onClick={() => handleSendGroupCommand(selectedGroup.id, 'play')}
                        className="w-full h-9 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow"
                      >
                        <Play className="w-3.5 h-3.5" /> CAST PLAY
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-900">
                    <button
                      onClick={() => handleSendGroupCommand(selectedGroup.id, 'stop')}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold flex items-center gap-1 border border-zinc-800"
                    >
                      <Square className="w-3.5 h-3.5 text-red-500" /> Stop Feeds
                    </button>
                    <button
                      onClick={() => handleSendGroupCommand(selectedGroup.id, 'pause')}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold flex items-center gap-1 border border-zinc-800"
                    >
                      <Pause className="w-3.5 h-3.5 text-amber-500" /> Pause Feeds
                    </button>
                    <button
                      onClick={() => handleSendGroupCommand(selectedGroup.id, 'resume')}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold flex items-center gap-1 border border-zinc-800"
                    >
                      <Play className="w-3.5 h-3.5 text-green-500" /> Resume Playback
                    </button>
                  </div>
                </div>

                {/* Member Management */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-2">Group Display Members</h4>
                  
                  {/* Non-members adder */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-zinc-500">Quick add board:</span>
                    <div className="flex gap-2">
                      {devices.filter(d => !(selectedGroup.devices || []).some(md => md.id === d.id)).length === 0 ? (
                        <span className="text-xs text-zinc-600 font-medium italic">All boards are already members of this group.</span>
                      ) : (
                        devices.filter(d => !(selectedGroup.devices || []).some(md => md.id === d.id)).map(dev => (
                          <button
                            key={dev.id}
                            onClick={() => handleAddDeviceToGroup(selectedGroup.id, dev.id)}
                            className="px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg text-[10px] font-bold border border-blue-500/20 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> {dev.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Group Members List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(selectedGroup.devices || []).length === 0 ? (
                      <div className="col-span-2 text-center py-12 text-zinc-600 bg-zinc-950/20 border border-zinc-800/40 rounded-xl">
                        No active members. Use the "Quick Add" buttons above.
                      </div>
                    ) : (
                      (selectedGroup.devices || []).map(member => (
                        <div key={member.id} className="p-3 bg-zinc-950/30 border border-zinc-800/80 rounded-xl flex items-center justify-between gap-3">
                          <div>
                            <h5 className="text-xs font-bold text-zinc-200">{member.name}</h5>
                            <span className="text-[9px] text-zinc-500 mt-0.5 block">{member.location || 'N/A'}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveDeviceFromGroup(selectedGroup.id, member.id)}
                            className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Remove from Group"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-16 text-center text-zinc-500 space-y-4 shadow-lg">
                <Layers className="w-16 h-16 text-zinc-800 mx-auto animate-pulse" />
                <h3 className="text-lg font-bold text-zinc-300">Display Group Workspace</h3>
                <p className="text-sm max-w-md mx-auto text-zinc-500">Deploy monitor groups or choose a layout directory from the sidebar to cast sync feeds instantly.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB TAB 3: AUTOMATION SCHEDULER */}
      {subTab === 'schedules' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Create Automation Schedule */}
          <div className="lg:col-span-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-3 text-zinc-200">
                <Clock className="w-4 h-4 text-orange-500" /> Configure Cron Scheduler
              </h3>
              <p className="text-xs text-zinc-500 mb-4">Set time-based automation scripts (e.g. Play stream A at 09:00, stop at 18:00).</p>

              <form onSubmit={handleCreateSchedule} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Trigger Time (24h format)</label>
                  <input 
                    type="time" 
                    required
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Trigger Action</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSchedAction('play')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${schedAction === 'play' ? 'bg-green-600/10 border-green-500/30 text-green-400' : 'bg-zinc-950/20 border-zinc-800/80 text-zinc-400 hover:bg-zinc-900'}`}
                    >
                      Play Stream
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchedAction('stop')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${schedAction === 'stop' ? 'bg-red-600/10 border-red-500/30 text-red-400' : 'bg-zinc-950/20 border-zinc-800/80 text-zinc-400 hover:bg-zinc-900'}`}
                    >
                      Stop Stream
                    </button>
                  </div>
                </div>

                {schedAction === 'play' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Target Channel Feed</label>
                      <select
                        value={schedStreamId}
                        onChange={(e) => {
                          setSchedStreamId(e.target.value);
                          setSchedCustomUrl('');
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      >
                        <option value="">-- Choose active stream --</option>
                        {streams.map(s => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Or Custom Stream URL</label>
                      <input 
                        type="text" 
                        placeholder="https://example.com/stream.m3u8"
                        value={schedCustomUrl}
                        onChange={(e) => {
                          setSchedCustomUrl(e.target.value);
                          setSchedStreamId('');
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      />
                    </div>
                  </>
                )}

                <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded-xl space-y-2">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase block">Target Recipient</span>
                  {selectedDevice ? (
                    <div className="text-xs text-zinc-300 flex items-center gap-2"><Monitor className="w-3.5 h-3.5 text-blue-500" /> Active Board: <span className="text-blue-400 font-bold">{selectedDevice.name}</span></div>
                  ) : selectedGroup ? (
                    <div className="text-xs text-zinc-300 flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-emerald-500" /> Active Group: <span className="text-emerald-400 font-bold">{selectedGroup.name}</span></div>
                  ) : (
                    <div className="text-[10px] text-amber-500 font-bold flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Please select a device or group from other tabs first.</div>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={(!selectedDevice && !selectedGroup)}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <PlusCircle className="w-4 h-4" /> Schedule Task
                </button>
              </form>
            </div>
          </div>

          {/* Active Schedules Directory */}
          <div className="lg:col-span-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-6">
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2 border-b border-zinc-800 pb-3">
                <Clock className="w-4 h-4 text-blue-500" /> Active Automated Chronometers
              </h3>

              {schedules.length === 0 ? (
                <div className="text-center py-16 text-zinc-600 bg-zinc-950/20 border border-dashed border-zinc-800 rounded-xl">
                  <Clock className="w-12 h-12 text-zinc-800 mx-auto mb-2" />
                  <p className="text-sm">No automated schedules configured.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {schedules.map(sc => {
                    const targetName = sc.device_id 
                      ? (devices.find(d => d.id === sc.device_id)?.name || 'Monitor Board')
                      : (groups.find(g => g.id === sc.group_id)?.name || 'Display Group');
                    
                    return (
                      <div key={sc.id} className="p-4 bg-zinc-950/30 border border-zinc-800/80 rounded-xl flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-zinc-100 font-mono bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">{sc.time}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${sc.action === 'play' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{sc.action.toUpperCase()}</span>
                          </div>
                          
                          <div className="space-y-1">
                            <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                              {sc.device_id ? <Monitor className="w-3 h-3 text-blue-500" /> : <Layers className="w-3 h-3 text-emerald-500" />}
                              Target: <span className="font-semibold text-zinc-200">{targetName}</span>
                            </p>
                            {sc.action === 'play' && (
                              <p className="text-[9px] text-zinc-500 font-mono truncate max-w-[240px]">Feeds: {sc.stream_url || 'Active selected channel'}</p>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteSchedule(sc.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded border border-zinc-800/40 transition-colors shrink-0"
                          title="Delete Schedule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* SUB TAB 4: PI INSTALLER DOCUMENTS */}
      {subTab === 'docs' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-6">
            <div>
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2 border-b border-zinc-800 pb-3">
                <Terminal className="w-4 h-4 text-blue-500" /> Raspberry Pi Native Client Deployment Guide
              </h3>
              <p className="text-xs text-zinc-500 mt-2">To connect physical TVs or monitor panels to your StreamPulse VPS core streaming environment, configure the boards using our lightweight native player agent. **No heavy chromium browser, electron or extra CPU memory footprint is used.**</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Step checklist */}
              <div className="lg:col-span-4 space-y-4 text-xs text-zinc-400">
                <div className="p-4 bg-zinc-950/30 border border-zinc-800 rounded-xl space-y-3">
                  <h4 className="font-bold text-zinc-200 uppercase tracking-wide">Prerequisites on Pi</h4>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li>Raspberry Pi 3, 4, or 5 (Any model)</li>
                    <li>Raspberry Pi OS (Bookworm preferred)</li>
                    <li>Internet connection on the Board</li>
                    <li>Active HDMI display hooked up</li>
                  </ul>
                </div>

                <div className="p-4 bg-zinc-950/30 border border-zinc-800 rounded-xl space-y-3">
                  <h4 className="font-bold text-zinc-200 uppercase tracking-wide flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5 text-blue-500" /> CLI Core Dependencies</h4>
                  <p className="text-[11px] text-zinc-500">Run this single terminal command on the Raspberry Pi to bootstrap system players and audio mixers:</p>
                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 font-mono text-[10px] text-blue-400 select-all">
                    sudo apt update && sudo apt install -y python3-pip python3-psutil mpv scrot alsa-utils
                  </div>
                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 font-mono text-[10px] text-blue-400 select-all">
                    pip3 install websockets --break-system-packages
                  </div>
                </div>
              </div>

              {/* Source code viewer */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Agent.py File */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-zinc-900 px-4 py-2 border border-zinc-800 rounded-t-xl">
                    <span className="text-xs font-bold text-zinc-300 font-mono">/home/pi/streampulse-agent.py</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(agentScriptCode);
                        alert('Copied Python Agent script to clipboard!');
                      }}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-bold flex items-center gap-1 border border-zinc-700"
                    >
                      <Copy className="w-3 h-3" /> Copy Script
                    </button>
                  </div>
                  <pre className="bg-zinc-950 border-x border-b border-zinc-800 p-4 rounded-b-xl max-h-[350px] overflow-y-auto font-mono text-[10px] text-zinc-400 leading-relaxed no-scrollbar select-all">
                    {agentScriptCode}
                  </pre>
                </div>

                {/* Systemd service File */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-zinc-900 px-4 py-2 border border-zinc-800 rounded-t-xl">
                    <span className="text-xs font-bold text-zinc-300 font-mono">/etc/systemd/system/streampulse-agent.service</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(systemdServiceCode);
                        alert('Copied Systemd Unit to clipboard!');
                      }}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-bold flex items-center gap-1 border border-zinc-700"
                    >
                      <Copy className="w-3 h-3" /> Copy Service
                    </button>
                  </div>
                  <pre className="bg-zinc-950 border-x border-b border-zinc-800 p-4 rounded-b-xl font-mono text-[10px] text-zinc-400 leading-relaxed select-all">
                    {systemdServiceCode}
                  </pre>
                </div>

                {/* Run / Enable guide */}
                <div className="bg-zinc-950/40 border border-zinc-800 p-5 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-widest flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-green-500" /> Start & Enable Daemon (Run on boot)
                  </h4>
                  <p className="text-xs text-zinc-500">Enable the service in systemctl to start the stream receiver automatically on Raspberry Pi bootup:</p>
                  
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 font-mono text-[10px] text-zinc-300 space-y-1.5 select-all">
                    <div># Reload systemd and enable daemon</div>
                    <div className="text-blue-400">sudo systemctl daemon-reload</div>
                    <div className="text-blue-400">sudo systemctl enable streampulse-agent.service</div>
                    <div className="text-blue-400 font-semibold">sudo systemctl start streampulse-agent.service</div>
                    <div className="mt-2 text-zinc-600"># Verify logs and status</div>
                    <div className="text-zinc-500">sudo systemctl status streampulse-agent.service</div>
                    <div className="text-zinc-500">tail -f /home/pi/streampulse.log</div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
