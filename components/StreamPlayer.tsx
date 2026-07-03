
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause,
  Volume2, 
  VolumeX, 
  Users, 
  Radio, 
  Copy, 
  Check, 
  Lock, 
  Monitor, 
  Layers,
  X,
  Edit3,
  Trash2,
  ChevronDown,
  Wifi,
  Cloud,
  Headphones,
  Mic,
  ShieldCheck, 
  ShieldAlert,
  Server,
  Eye,
  EyeOff,
  Sliders,
  Zap,
  Cpu,
  Timer,
  Activity,
  ExternalLink,
  PlayCircle,
  Globe,
  Smartphone,
  Info,
  RefreshCcw,
  AlertTriangle,
  Calendar,
  Clock,
  Rocket,
  RotateCcw,
  Video,
  Square,
  FolderOpen,
  FolderSearch,
  Save,
  AlertCircle
} from 'lucide-react';
import { StreamSession } from '../types';

interface StreamPlayerProps {
  stream: StreamSession;
  onRemove?: () => void;
  onUpdateResolution?: (resolution: string) => void;
  onUpdateIpMode?: (mode: string) => void;
  onUpdateQuality?: (bitrate: number, codec: StreamSession['codec']) => void;
  onRegenerateKey?: () => void;
  onGoLive?: () => void;
  onRestartStream?: () => void;
  onEnable?: () => void;
  onDisable?: () => void;
  onEdit?: (updated: Partial<StreamSession>) => void;
  onCloneProfile?: (config: Partial<StreamSession>) => void;
  isAdmin?: boolean;
}

const getResolutionPreset = (resolution: string) => {
  const defaults: Record<string, { width: number; height: number; fps: number; videoBitrate: string; audioBitrate: string; aspectRatio: string; videoCodec: string; audioCodec: string; preset: string; profile: string; pixelFormat: string }> = {
    'Source (Original)': { width: 1920, height: 1080, fps: 30, videoBitrate: '6000k', audioBitrate: '128k', aspectRatio: '16:9', videoCodec: 'libx264', audioCodec: 'aac', preset: 'veryfast', profile: 'main', pixelFormat: 'yuv420p' },
    '4K': { width: 3840, height: 2160, fps: 60, videoBitrate: '12000k', audioBitrate: '256k', aspectRatio: '16:9', videoCodec: 'libx264', audioCodec: 'aac', preset: 'veryfast', profile: 'main', pixelFormat: 'yuv420p' },
    '2K': { width: 2560, height: 1440, fps: 60, videoBitrate: '8000k', audioBitrate: '192k', aspectRatio: '16:9', videoCodec: 'libx264', audioCodec: 'aac', preset: 'veryfast', profile: 'main', pixelFormat: 'yuv420p' },
    '1080p': { width: 1920, height: 1080, fps: 30, videoBitrate: '5000k', audioBitrate: '128k', aspectRatio: '16:9', videoCodec: 'libx264', audioCodec: 'aac', preset: 'veryfast', profile: 'main', pixelFormat: 'yuv420p' },
    '900p': { width: 1600, height: 900, fps: 30, videoBitrate: '4000k', audioBitrate: '128k', aspectRatio: '16:9', videoCodec: 'libx264', audioCodec: 'aac', preset: 'veryfast', profile: 'main', pixelFormat: 'yuv420p' },
    '720p': { width: 1280, height: 720, fps: 30, videoBitrate: '2500k', audioBitrate: '128k', aspectRatio: '16:9', videoCodec: 'libx264', audioCodec: 'aac', preset: 'veryfast', profile: 'main', pixelFormat: 'yuv420p' },
    '576p': { width: 1024, height: 576, fps: 30, videoBitrate: '1800k', audioBitrate: '96k', aspectRatio: '16:9', videoCodec: 'libx264', audioCodec: 'aac', preset: 'veryfast', profile: 'main', pixelFormat: 'yuv420p' },
    '480p': { width: 854, height: 480, fps: 30, videoBitrate: '1200k', audioBitrate: '96k', aspectRatio: '16:9', videoCodec: 'libx264', audioCodec: 'aac', preset: 'veryfast', profile: 'main', pixelFormat: 'yuv420p' },
    '360p': { width: 640, height: 360, fps: 30, videoBitrate: '800k', audioBitrate: '64k', aspectRatio: '16:9', videoCodec: 'libx264', audioCodec: 'aac', preset: 'veryfast', profile: 'main', pixelFormat: 'yuv420p' },
    '240p': { width: 426, height: 240, fps: 30, videoBitrate: '400k', audioBitrate: '64k', aspectRatio: '16:9', videoCodec: 'libx264', audioCodec: 'aac', preset: 'veryfast', profile: 'main', pixelFormat: 'yuv420p' },
    'Audio Only': { width: 0, height: 0, fps: 0, videoBitrate: '0k', audioBitrate: '128k', aspectRatio: 'none', videoCodec: 'none', audioCodec: 'aac', preset: 'veryfast', profile: 'main', pixelFormat: 'yuv420p' },
  };

  let lookupKey = resolution;
  if (resolution.includes('4K') || resolution === '4K (3840×2160)') lookupKey = '4K';
  else if (resolution.includes('2K') || resolution === '2K (2560×1440)') lookupKey = '2K';
  else if (resolution.includes('1080p') || resolution === '1080p (1920×1080)') lookupKey = '1080p';
  else if (resolution.includes('900p') || resolution === '900p (1600×900)') lookupKey = '900p';
  else if (resolution.includes('720p') || resolution === '720p (1280×720)') lookupKey = '720p';
  else if (resolution.includes('576p') || resolution === '576p (1024×576)') lookupKey = '576p';
  else if (resolution.includes('480p') || resolution === '480p (854×480)') lookupKey = '480p';
  else if (resolution.includes('360p') || resolution === '360p (640×360)') lookupKey = '360p';
  else if (resolution.includes('240p') || resolution === '240p (426×240)') lookupKey = '240p';
  else if (resolution.includes('Audio Only')) lookupKey = 'Audio Only';
  else if (resolution.includes('Source')) lookupKey = 'Source (Original)';

  return defaults[lookupKey] || defaults['1080p'];
};

const StreamPlayer: React.FC<StreamPlayerProps> = ({ 
  stream, 
  onRemove, 
  onUpdateResolution, 
  onUpdateIpMode,
  onUpdateQuality,
  onRegenerateKey,
  onGoLive,
  onRestartStream,
  onEnable,
  onDisable,
  onEdit,
  onCloneProfile,
  isAdmin = true
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPlayback, setCopiedPlayback] = useState<string | null>(null);
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [revealedPlaybacks, setRevealedPlaybacks] = useState<Record<string, boolean>>({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configTab, setConfigTab] = useState<'broadcast' | 'playback'>('broadcast');
  const [volume, setVolume] = useState(80);

  // Inline editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(stream.title);
  const [editBroadcaster, setEditBroadcaster] = useState(stream.broadcaster);
  useEffect(() => {
    setEditTitle(stream.title);
    setEditBroadcaster(stream.broadcaster);
  }, [stream.title, stream.broadcaster]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isConfirmingRegen, setIsConfirmingRegen] = useState(false);
  
  const [latency, setLatency] = useState(24);
  const [droppedFrames, setDroppedFrames] = useState(0.0);
  const [timeUntilStart, setTimeUntilStart] = useState<string>('');

  const [bitrate, setBitrate] = useState(stream.bitrate || 4500);
  const [codec, setCodec] = useState<StreamSession['codec']>(stream.codec || 'H.264');

  // Dynamic Custom Resolution states
  const [selectedResolution, setSelectedResolution] = useState(stream.resolution || '1080p');
  const [customWidth, setCustomWidth] = useState(stream.width || 1920);
  const [customHeight, setCustomHeight] = useState(stream.height || 1080);
  const [customFps, setCustomFps] = useState(stream.fps || 30);
  const [customBitrate, setCustomBitrate] = useState(stream.bitrate || 4500);
  const [customAudioBitrate, setCustomAudioBitrate] = useState(128);
  const [customAspectRatio, setCustomAspectRatio] = useState(stream.aspectRatio || '16:9');
  const [customVideoCodec, setCustomVideoCodec] = useState(stream.videoCodec || 'H.264');
  const [customAudioCodec, setCustomAudioCodec] = useState(stream.audioCodec || 'aac');
  const [customPreset, setCustomPreset] = useState(stream.preset || 'veryfast');
  const [customProfile, setCustomProfile] = useState(stream.profile || 'main');
  const [customPixelFormat, setCustomPixelFormat] = useState(stream.pixelFormat || 'yuv420p');
  const [customEnabledProfiles, setCustomEnabledProfiles] = useState<string[]>(() => {
    if (stream.enabledProfiles) {
      return stream.enabledProfiles.split(',').map(s => s.trim()).filter(Boolean);
    }
    return ['1080p', '720p', '480p', '360p'];
  });

  // Advanced custom video & audio states
  const [customGopSize, setCustomGopSize] = useState<number>(stream.gopSize || 60);
  const [customBufferSize, setCustomBufferSize] = useState<number>(stream.bufferSize || 9000);
  const [customMaxBitrate, setCustomMaxBitrate] = useState<number>(stream.maxBitrate || 5000);
  const [customScalingAlgorithm, setCustomScalingAlgorithm] = useState<string>(stream.scalingAlgorithm || 'bicubic');

  const [customAudioEnabled, setCustomAudioEnabled] = useState<boolean>(stream.audioEnabled !== false);
  const [customAudioSampleRate, setCustomAudioSampleRate] = useState<number>(stream.audioSampleRate || 44100);
  const [customAudioChannels, setCustomAudioChannels] = useState<string>(stream.audioChannels || 'stereo');
  const [customAudioVolume, setCustomAudioVolume] = useState<number>(stream.audioVolume !== undefined ? stream.audioVolume : 100);
  const [customAudioNormalize, setCustomAudioNormalize] = useState<boolean>(!!stream.audioNormalize);
  const [customAudioNoiseReduction, setCustomAudioNoiseReduction] = useState<boolean>(!!stream.audioNoiseReduction);
  const [customAudioDelay, setCustomAudioDelay] = useState<number>(stream.audioDelay || 0);
  const [customAudioLanguage, setCustomAudioLanguage] = useState<string>(stream.audioLanguage || 'eng');
  const [customAudioTrackSelection, setCustomAudioTrackSelection] = useState<string>(stream.audioTrackSelection || '0');
  const [customAudioPassthrough, setCustomAudioPassthrough] = useState<boolean>(!!stream.audioPassthrough);
  const [customAudioTranscoding, setCustomAudioTranscoding] = useState<boolean>(stream.audioTranscoding !== false);
  const [customProfilesJson, setCustomProfilesJson] = useState<string>(stream.profilesJson || '[]');

  // Resolution Profile definition & states
  const [profilesList, setProfilesList] = useState<any[]>(() => {
    try {
      const parsed = JSON.parse(stream.profilesJson || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {}
    return [
      {
        id: '1',
        enabled: true,
        name: '1080p Main',
        resolutionType: '1080p Full HD',
        width: 1920,
        height: 1080,
        fps: 30,
        videoCodec: 'H.264',
        bitrate: 4500,
        maxBitrate: 5000,
        bufferSize: 9000,
        aspectRatio: '16:9',
        scalingAlgorithm: 'bicubic',
        keyframeInterval: 60,
        pixelFormat: 'yuv420p',
        encoderPreset: 'veryfast',
        audioEnabled: true,
        audioCodec: 'aac',
        audioBitrate: 128,
        audioSampleRate: 44100,
        audioChannels: 'stereo',
        audioVolume: 100,
        audioNormalize: false
      },
      {
        id: '2',
        enabled: true,
        name: '720p Backup',
        resolutionType: '720p HD',
        width: 1280,
        height: 720,
        fps: 30,
        videoCodec: 'H.264',
        bitrate: 2500,
        maxBitrate: 3000,
        bufferSize: 5000,
        aspectRatio: '16:9',
        scalingAlgorithm: 'bicubic',
        keyframeInterval: 60,
        pixelFormat: 'yuv420p',
        encoderPreset: 'veryfast',
        audioEnabled: true,
        audioCodec: 'aac',
        audioBitrate: 96,
        audioSampleRate: 44100,
        audioChannels: 'stereo',
        audioVolume: 100,
        audioNormalize: false
      }
    ];
  });

  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [profileSortField, setProfileSortField] = useState<string>('name');
  const [profileSortOrder, setProfileSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [isProfileManagerExpanded, setIsProfileManagerExpanded] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isDeletingProfile, setIsDeletingProfile] = useState<string | null>(null);
  const [profileErrors, setProfileErrors] = useState<string[]>([]);

  useEffect(() => {
    setCustomProfilesJson(JSON.stringify(profilesList));
  }, [profilesList]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(stream.profilesJson || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        setProfilesList(parsed);
      }
    } catch (e) {}
  }, [stream.profilesJson]);

  // Collapsible panel active states
  const [activePanels, setActivePanels] = useState<Record<string, boolean>>({
    video: true,
    audio: false,
    profiles: false,
    advanced: false
  });

  const togglePanel = (panel: string) => {
    setActivePanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  // Preset management state
  interface StreamPreset {
    id: string;
    name: string;
    resolution: string;
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    audioBitrate: number;
    aspectRatio: string;
    videoCodec: string;
    audioCodec: string;
    preset: string;
    profile: string;
    pixelFormat: string;
    gopSize?: number;
    bufferSize?: number;
    maxBitrate?: number;
    scalingAlgorithm?: string;
    audioEnabled?: boolean;
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

  const [presets, setPresets] = useState<StreamPreset[]>(() => {
    try {
      const saved = localStorage.getItem('streampulse_presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newPresetName, setNewPresetName] = useState('');

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      alert('Please enter a name for the preset.');
      return;
    }
    const newPreset: StreamPreset = {
      id: Math.random().toString(36).substring(2, 9),
      name: newPresetName,
      resolution: selectedResolution,
      width: Number(customWidth),
      height: Number(customHeight),
      fps: Number(customFps),
      bitrate: Number(customBitrate),
      audioBitrate: Number(customAudioBitrate),
      aspectRatio: customAspectRatio,
      videoCodec: customVideoCodec,
      audioCodec: customAudioCodec,
      preset: customPreset,
      profile: customProfile,
      pixelFormat: customPixelFormat,
      gopSize: Number(customGopSize),
      bufferSize: Number(customBufferSize),
      maxBitrate: Number(customMaxBitrate),
      scalingAlgorithm: customScalingAlgorithm,
      audioEnabled: customAudioEnabled,
      audioSampleRate: Number(customAudioSampleRate),
      audioChannels: customAudioChannels,
      audioVolume: Number(customAudioVolume),
      audioNormalize: customAudioNormalize,
      audioNoiseReduction: customAudioNoiseReduction,
      audioDelay: Number(customAudioDelay),
      audioLanguage: customAudioLanguage,
      audioTrackSelection: customAudioTrackSelection,
      audioPassthrough: customAudioPassthrough,
      audioTranscoding: customAudioTranscoding,
      profilesJson: customProfilesJson
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('streampulse_presets', JSON.stringify(updated));
    setNewPresetName('');
    alert(`Preset "${newPreset.name}" saved successfully!`);
  };

  const handleLoadPreset = (preset: StreamPreset) => {
    setSelectedResolution(preset.resolution);
    setCustomWidth(preset.width);
    setCustomHeight(preset.height);
    setCustomFps(preset.fps);
    setCustomBitrate(preset.bitrate);
    setCustomAudioBitrate(preset.audioBitrate || 128);
    setCustomAspectRatio(preset.aspectRatio);
    setCustomVideoCodec(preset.videoCodec);
    setCustomAudioCodec(preset.audioCodec);
    setCustomPreset(preset.preset);
    setCustomProfile(preset.profile);
    setCustomPixelFormat(preset.pixelFormat);
    if (preset.gopSize !== undefined) setCustomGopSize(preset.gopSize);
    if (preset.bufferSize !== undefined) setCustomBufferSize(preset.bufferSize);
    if (preset.maxBitrate !== undefined) setCustomMaxBitrate(preset.maxBitrate);
    if (preset.scalingAlgorithm !== undefined) setCustomScalingAlgorithm(preset.scalingAlgorithm);
    if (preset.audioEnabled !== undefined) setCustomAudioEnabled(preset.audioEnabled);
    if (preset.audioSampleRate !== undefined) setCustomAudioSampleRate(preset.audioSampleRate);
    if (preset.audioChannels !== undefined) setCustomAudioChannels(preset.audioChannels);
    if (preset.audioVolume !== undefined) setCustomAudioVolume(preset.audioVolume);
    if (preset.audioNormalize !== undefined) setCustomAudioNormalize(preset.audioNormalize);
    if (preset.audioNoiseReduction !== undefined) setCustomAudioNoiseReduction(preset.audioNoiseReduction);
    if (preset.audioDelay !== undefined) setCustomAudioDelay(preset.audioDelay);
    if (preset.audioLanguage !== undefined) setCustomAudioLanguage(preset.audioLanguage);
    if (preset.audioTrackSelection !== undefined) setCustomAudioTrackSelection(preset.audioTrackSelection);
    if (preset.audioPassthrough !== undefined) setCustomAudioPassthrough(preset.audioPassthrough);
    if (preset.audioTranscoding !== undefined) setCustomAudioTranscoding(preset.audioTranscoding);
    if (preset.profilesJson !== undefined) setCustomProfilesJson(preset.profilesJson);
    alert(`Preset "${preset.name}" loaded successfully!`);
  };

  const handleDeletePreset = (id: string, name: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('streampulse_presets', JSON.stringify(updated));
    alert(`Preset "${name}" deleted.`);
  };

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  useEffect(() => {
    const errors: string[] = [];
    if (selectedResolution === 'Custom Resolution') {
      if (customWidth < 128 || customWidth > 7680) {
        errors.push('Width must be between 128 and 7680 (8K).');
      }
      if (customHeight < 128 || customHeight > 4320) {
        errors.push('Height must be between 128 and 4320 (8K).');
      }
      if (customFps < 1 || customFps > 240) {
        errors.push('FPS must be between 1 and 240.');
      }
      if (customBitrate < 50 || customBitrate > 100000) {
        errors.push('Video Bitrate must be between 50k and 100,000k.');
      }
    }
    if (customGopSize < 1 || customGopSize > 1000) {
      errors.push('GOP must be between 1 and 1000 frames.');
    }
    if (customBufferSize < 10 || customBufferSize > 500000) {
      errors.push('Buffer Size must be between 10k and 500,000k.');
    }
    if (customMaxBitrate < 50 || customMaxBitrate > 100000) {
      errors.push('Max Bitrate must be between 50k and 100,000k.');
    }
    if (customAudioEnabled) {
      if (customAudioVolume < 0 || customAudioVolume > 200) {
        errors.push('Audio Volume must be between 0% and 200%.');
      }
      if (customAudioDelay < 0 || customAudioDelay > 10000) {
        errors.push('Audio Delay must be between 0ms and 10000ms.');
      }
    }
    if (customVideoCodec === 'AV1' && customProfile === 'baseline') {
      errors.push('AV1 does not support baseline profile. Choose high or main.');
    }
    setValidationErrors(errors);
  }, [
    selectedResolution, customWidth, customHeight, customFps, customBitrate,
    customGopSize, customBufferSize, customMaxBitrate, customAudioEnabled,
    customAudioVolume, customAudioDelay, customVideoCodec, customProfile
  ]);

  // Live Server FFmpeg Command Preview
  const [previewCommand, setPreviewCommand] = useState<string>('');
  
  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('streampulse_jwt') || '';
        const res = await fetch('/api/streams/preview-command', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            resolution: selectedResolution,
            profilesJson: customProfilesJson,
            customData: {
              width: customWidth,
              height: customHeight,
              fps: customFps,
              bitrate: customBitrate,
              aspectRatio: customAspectRatio,
              videoCodec: customVideoCodec,
              audioCodec: customAudioCodec,
              preset: customPreset,
              profile: customProfile,
              pixelFormat: customPixelFormat,
              gopSize: customGopSize,
              bufferSize: customBufferSize,
              maxBitrate: customMaxBitrate,
              scalingAlgorithm: customScalingAlgorithm,
              audioEnabled: customAudioEnabled,
              audioBitrate: `${customAudioBitrate}k`,
              audioSampleRate: customAudioSampleRate,
              audioChannels: customAudioChannels,
              audioVolume: customAudioVolume,
              audioNormalize: customAudioNormalize,
              audioNoiseReduction: customAudioNoiseReduction,
              audioDelay: customAudioDelay,
              audioLanguage: customAudioLanguage,
              audioTrackSelection: customAudioTrackSelection,
              audioPassthrough: customAudioPassthrough,
              audioTranscoding: customAudioTranscoding
            }
          })
        });
        if (res.ok) {
          const data = await res.json();
          setPreviewCommand(data.command);
        }
      } catch (err) {
        console.error('Error fetching command preview:', err);
      }
    };
    
    const delayDebounce = setTimeout(() => {
      fetchPreview();
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [
    selectedResolution, customWidth, customHeight, customFps, customBitrate,
    customAspectRatio, customVideoCodec, customAudioCodec, customPreset,
    customProfile, customPixelFormat, customGopSize, customBufferSize,
    customMaxBitrate, customScalingAlgorithm, customAudioEnabled, customAudioBitrate,
    customAudioSampleRate, customAudioChannels, customAudioVolume, customAudioNormalize,
    customAudioNoiseReduction, customAudioDelay, customAudioLanguage,
    customAudioTrackSelection, customAudioPassthrough, customAudioTranscoding,
    customProfilesJson
  ]);

  useEffect(() => {
    setSelectedResolution(stream.resolution || '1080p');
    setCustomWidth(stream.width || 1920);
    setCustomHeight(stream.height || 1080);
    setCustomFps(stream.fps || 30);
    setCustomBitrate(stream.bitrate || 4500);
    setCustomAspectRatio(stream.aspectRatio || '16:9');
    setCustomVideoCodec(stream.videoCodec || 'H.264');
    setCustomAudioCodec(stream.audioCodec || 'aac');
    setCustomPreset(stream.preset || 'veryfast');
    setCustomProfile(stream.profile || 'main');
    setCustomPixelFormat(stream.pixelFormat || 'yuv420p');
    if (stream.enabledProfiles) {
      setCustomEnabledProfiles(stream.enabledProfiles.split(',').map(s => s.trim()).filter(Boolean));
    } else {
      setCustomEnabledProfiles(['1080p', '720p', '480p', '360p']);
    }

    setCustomGopSize(stream.gopSize || 60);
    setCustomBufferSize(stream.bufferSize || 9000);
    setCustomMaxBitrate(stream.maxBitrate || 5000);
    setCustomScalingAlgorithm(stream.scalingAlgorithm || 'bicubic');

    setCustomAudioEnabled(stream.audioEnabled !== false);
    const aBit = stream.audioBitrate ? parseInt(stream.audioBitrate) : 128;
    setCustomAudioBitrate(isNaN(aBit) ? 128 : aBit);
    setCustomAudioSampleRate(stream.audioSampleRate || 44100);
    setCustomAudioChannels(stream.audioChannels || 'stereo');
    setCustomAudioVolume(stream.audioVolume !== undefined ? stream.audioVolume : 100);
    setCustomAudioNormalize(!!stream.audioNormalize);
    setCustomAudioNoiseReduction(!!stream.audioNoiseReduction);
    setCustomAudioDelay(stream.audioDelay || 0);
    setCustomAudioLanguage(stream.audioLanguage || 'eng');
    setCustomAudioTrackSelection(stream.audioTrackSelection || '0');
    setCustomAudioPassthrough(!!stream.audioPassthrough);
    setCustomAudioTranscoding(stream.audioTranscoding !== false);
    setCustomProfilesJson(stream.profilesJson || '[]');
  }, [stream.id, stream.resolution, stream.width, stream.height, stream.fps, stream.bitrate, stream.gopSize, stream.bufferSize, stream.maxBitrate, stream.scalingAlgorithm, stream.audioEnabled, stream.audioBitrate, stream.audioSampleRate, stream.audioChannels, stream.audioVolume, stream.audioNormalize, stream.audioNoiseReduction, stream.audioDelay, stream.audioLanguage, stream.audioTrackSelection, stream.audioPassthrough, stream.audioTranscoding, stream.profilesJson]);

  const getEstimatedCpuUsage = (p: any): number => {
    if (Number(p.width) === 0) return 1; // Audio only uses almost 0% CPU
    const pixels = (Number(p.width) || 1280) * (Number(p.height) || 720);
    const fps = Number(p.fps) || 30;
    const codec = p.videoCodec || 'H.264';
    const preset = p.encoderPreset || 'veryfast';

    // Base usage for standard 1280x720 @ 30fps is around 5% CPU on medium preset
    const pixelFactor = pixels / (1280 * 720);
    const fpsFactor = fps / 30;

    let codecFactor = 1.0;
    if (codec === 'H.265' || codec === 'HEVC') {
      codecFactor = 1.8;
    } else if (codec === 'AV1') {
      codecFactor = 3.5;
    }

    let presetFactor = 0.7; // default for veryfast
    switch (preset) {
      case 'ultrafast': presetFactor = 0.3; break;
      case 'superfast': presetFactor = 0.5; break;
      case 'veryfast': presetFactor = 0.7; break;
      case 'faster': presetFactor = 0.85; break;
      case 'fast': presetFactor = 1.0; break;
      case 'medium': presetFactor = 1.3; break;
      case 'slow': presetFactor = 1.8; break;
      case 'slower': presetFactor = 2.5; break;
      case 'veryslow': presetFactor = 4.0; break;
    }

    const estimated = Math.round(5 * pixelFactor * fpsFactor * codecFactor * presetFactor);
    return Math.max(1, estimated);
  };

  const getEstimatedBitrate = (p: any): number => {
    const videoBit = Number(p.width) === 0 ? 0 : (Number(p.bitrate) || 2500);
    const audioBit = p.audioEnabled !== false ? (Number(p.audioBitrate) || 128) : 0;
    return videoBit + audioBit;
  };

  const validateProfile = (p: any, list: any[]): string[] => {
    const errors: string[] = [];
    if (!p.name || !p.name.trim()) {
      errors.push("Profile name cannot be empty.");
    }
    const isDuplicateName = list.some(item => item.id !== p.id && item.name.toLowerCase() === p.name.toLowerCase());
    if (isDuplicateName) {
      errors.push(`Profile name "${p.name}" is already in use.`);
    }
    if (isNaN(Number(p.width)) || Number(p.width) <= 0) {
      errors.push("Width must be a positive number.");
    }
    if (isNaN(Number(p.height)) || Number(p.height) <= 0) {
      errors.push("Height must be a positive number.");
    }
    if (isNaN(Number(p.fps)) || Number(p.fps) <= 0 || Number(p.fps) > 240) {
      errors.push("FPS must be between 1 and 240.");
    }
    if (isNaN(Number(p.bitrate)) || Number(p.bitrate) <= 0) {
      errors.push("Video bitrate must be positive.");
    }
    return errors;
  };

  const handleAddProfile = () => {
    const newId = String(Date.now());
    const nextNum = profilesList.length + 1;
    const newProfile = {
      id: newId,
      enabled: true,
      name: `Profile ${nextNum}`,
      resolutionType: '1080p Full HD',
      width: 1920,
      height: 1080,
      fps: 30,
      videoCodec: 'H.264',
      bitrate: 4500,
      maxBitrate: 5000,
      bufferSize: 9000,
      aspectRatio: '16:9',
      scalingAlgorithm: 'bicubic',
      keyframeInterval: 60,
      pixelFormat: 'yuv420p',
      encoderPreset: 'veryfast',
      audioEnabled: true,
      audioCodec: 'aac',
      audioBitrate: 128,
      audioSampleRate: 44100,
      audioChannels: 'stereo',
      audioVolume: 100,
      audioNormalize: false
    };
    setProfilesList(prev => [...prev, newProfile]);
  };

  const handleDuplicateProfile = (p: any) => {
    const newId = String(Date.now() + Math.random());
    const duplicated = {
      ...p,
      id: newId,
      name: `${p.name} (Copy)`
    };
    setProfilesList(prev => {
      const idx = prev.findIndex(item => item.id === p.id);
      if (idx !== -1) {
        const next = [...prev];
        next.splice(idx + 1, 0, duplicated);
        return next;
      }
      return [...prev, duplicated];
    });
  };

  const handleDeleteProfile = async (id: string, name: string) => {
    const isLastProfile = profilesList.length === 1;
    const confirmMessage = isLastProfile
      ? "This is the last Output Profile. Are you sure you want to delete it?"
      : `Are you sure you want to delete profile "${name}"?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeletingProfile(id);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('streampulse_jwt') || '';
      const res = await fetch(`/api/streams/${stream.id}/profiles/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        // Immediately update local state without requiring a page reload
        setProfilesList(data.profiles || []);
        
        // Notify parent about the updated profilesJson so UI stays fully in sync without reload
        if (onEdit) {
          onEdit({ profilesJson: JSON.stringify(data.profiles || []) });
        }
        
        alert('Profile deleted successfully.');
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete profile.');
      }
    } catch (err) {
      console.error('Error deleting profile:', err);
      alert('Failed to delete profile. Please try again.');
    } finally {
      setIsDeletingProfile(null);
    }
  };

  const handleToggleProfile = (id: string) => {
    setProfilesList(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const handleMoveProfile = (id: string, direction: 'up' | 'down') => {
    const index = profilesList.findIndex(p => p.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === profilesList.length - 1) return;

    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    const newList = [...profilesList];
    const temp = newList[index];
    newList[index] = newList[nextIndex];
    newList[nextIndex] = temp;
    setProfilesList(newList);
  };

  const handleSaveResolutionConfig = () => {
    const allErrors: string[] = [];
    profilesList.forEach(p => {
      const pErrors = validateProfile(p, profilesList);
      if (pErrors.length > 0) {
        allErrors.push(`[${p.name}]: ${pErrors.join(', ')}`);
      }
    });

    if (allErrors.length > 0) {
      alert(`Please fix profile validation errors first:\n- ${allErrors.join('\n- ')}`);
      return;
    }
    if (onEdit) {
      onEdit({
        resolution: selectedResolution,
        width: Number(customWidth),
        height: Number(customHeight),
        fps: Number(customFps),
        bitrate: Number(customBitrate),
        aspectRatio: customAspectRatio,
        videoCodec: customVideoCodec,
        audioCodec: customAudioCodec,
        preset: customPreset,
        profile: customProfile,
        pixelFormat: customPixelFormat,
        enabledProfiles: customEnabledProfiles.join(','),
        gopSize: Number(customGopSize),
        bufferSize: Number(customBufferSize),
        maxBitrate: Number(customMaxBitrate),
        scalingAlgorithm: customScalingAlgorithm,
        audioEnabled: customAudioEnabled,
        audioBitrate: `${customAudioBitrate}k`,
        audioSampleRate: Number(customAudioSampleRate),
        audioChannels: customAudioChannels,
        audioVolume: Number(customAudioVolume),
        audioNormalize: customAudioNormalize,
        audioNoiseReduction: customAudioNoiseReduction,
        audioDelay: Number(customAudioDelay),
        audioLanguage: customAudioLanguage,
        audioTrackSelection: customAudioTrackSelection,
        audioPassthrough: customAudioPassthrough,
        audioTranscoding: customAudioTranscoding,
        profilesJson: customProfilesJson
      });
    }
  };

  const handleResetResolutionConfig = () => {
    setSelectedResolution('1080p');
    setCustomWidth(1920);
    setCustomHeight(1080);
    setCustomFps(30);
    setCustomBitrate(4500);
    setCustomAudioBitrate(128);
    setCustomAspectRatio('16:9');
    setCustomVideoCodec('H.264');
    setCustomAudioCodec('aac');
    setCustomPreset('veryfast');
    setCustomProfile('main');
    setCustomPixelFormat('yuv420p');
    setCustomEnabledProfiles(['1080p', '720p', '480p', '360p']);
    setCustomGopSize(60);
    setCustomBufferSize(9000);
    setCustomMaxBitrate(5000);
    setCustomScalingAlgorithm('bicubic');
    setCustomAudioEnabled(true);
    setCustomAudioSampleRate(44100);
    setCustomAudioChannels('stereo');
    setCustomAudioVolume(100);
    setCustomAudioNormalize(false);
    setCustomAudioNoiseReduction(false);
    setCustomAudioDelay(0);
    setCustomAudioLanguage('eng');
    setCustomAudioTrackSelection('0');
    setCustomAudioPassthrough(false);
    setCustomAudioTranscoding(true);
    setCustomProfilesJson('[]');
  };

  const handleCopyResolutionConfig = () => {
    const configJson = JSON.stringify({
      resolution: selectedResolution,
      width: customWidth,
      height: customHeight,
      fps: customFps,
      bitrate: customBitrate,
      audioBitrate: customAudioBitrate,
      aspectRatio: customAspectRatio,
      videoCodec: customVideoCodec,
      audioCodec: customAudioCodec,
      preset: customPreset,
      profile: customProfile,
      pixelFormat: customPixelFormat,
      enabledProfiles: customEnabledProfiles
    }, null, 2);
    navigator.clipboard.writeText(configJson);
    alert('Resolution configuration JSON copied to clipboard!');
  };

  const handleTestResolutionConfig = async () => {
    setIsTesting(true);
    setTestReport(null);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/test/stream?streamKey=${stream.streamKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTestReport(data);
      } else {
        alert('Active backend validation failed or stream key offline.');
      }
    } catch (e) {
      console.error(e);
      alert('Error verifying stream configuration with diagnostics service.');
    } finally {
      setIsTesting(false);
    }
  };

  // Performance history for live graph (last 60 seconds)
  const [perfHistory, setPerfHistory] = useState<Array<{ time: number; bitrate: number; bandwidth: number }>>(() => {
    const initialHistory = [];
    const isLive = stream.status === 'live';
    const baseBitrate = stream.bitrate || 4500;
    
    for (let i = 59; i >= 0; i--) {
      if (isLive) {
        const variance = (Math.random() - 0.5) * 300;
        const currentB = Math.max(1000, Math.round(baseBitrate + variance));
        const overhead = 1.04 + (Math.random() * 0.03);
        const currentBandwidth = parseFloat(((currentB * overhead) / 1000).toFixed(2));
        initialHistory.push({
          time: i,
          bitrate: currentB,
          bandwidth: currentBandwidth
        });
      } else {
        initialHistory.push({
          time: i,
          bitrate: 0,
          bandwidth: 0
        });
      }
    }
    return initialHistory;
  });

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Custom Player and Diagnostics States & Refs
  const [playerProtocol, setPlayerProtocol] = useState<'hls' | 'dash'>('hls');
  const [qualityLevels, setQualityLevels] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<string>('Auto');
  const [testReport, setTestReport] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsInstanceRef = useRef<any>(null);
  const dashPlayerRef = useRef<any>(null);

  // Reset isPlaying to false initially to prevent browser autoplay blocks
  const [isPlaying, setIsPlaying] = useState(false);

  const loadScript = (url: string, id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }
      if (document.getElementById(id)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.id = id;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.body.appendChild(script);
    });
  };

  const runDiagnostics = async () => {
    setIsTesting(true);
    setTestReport(null);
    try {
      const response = await fetch(`/api/test/stream?streamKey=${stream.streamKey}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('streampulse_jwt')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setTestReport(data.report);
      } else {
        alert(data.error || 'Failed to run diagnostics.');
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to diagnostics API.');
    } finally {
      setIsTesting(false);
    }
  };

  // Derive alternative URLs
  const rtmpPlayback = `${stream.rtmpUrl}/${stream.streamKey}`;
  const baseHttp = stream.rtmpUrl.replace('rtmp://', 'http://').split('/')[0];
  
  // Dynamically resolve hostname & protocol so playback works flawlessly inside iframe / custom hostnames
  const currentHost = typeof window !== 'undefined' ? window.location.host : baseHttp;
  const currentProto = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  
  const hlsUrl = `${currentProto}//${currentHost}/hls/${stream.streamKey}/master.m3u8`;
  const dashUrl = `${currentProto}//${currentHost}/dash/${stream.streamKey}/manifest.mpd`;
  const embedUrl = `${currentProto}//${currentHost}/player/${stream.streamKey}`;

  // Interactive Player Lifecycle effect (instantiates Hls.js or Dash.js on the <video> target)
  useEffect(() => {
    if (!isPlaying || stream.status !== 'live' || !videoRef.current) return;

    let active = true;

    const initPlayer = async () => {
      // Clear existing players
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (dashPlayerRef.current) {
        dashPlayerRef.current.destroy();
        dashPlayerRef.current = null;
      }

      const video = videoRef.current;
      video.muted = volume === 0;
      video.volume = volume / 100;

      if (playerProtocol === 'hls') {
        try {
          await loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js', 'hls-js-cdn');
          if (!active) return;
          const Hls = (window as any).Hls;
          if (Hls && Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
            });
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hlsInstanceRef.current = hls;

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (!active) return;
              video.play().catch(e => console.log('Autoplay blocked:', e));
              const levels = hls.levels.map((l: any) => `${l.height}p`);
              setQualityLevels(['Auto', ...levels]);
            });

            hls.on(Hls.Events.ERROR, (event: any, data: any) => {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    break;
                }
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = hlsUrl;
            video.addEventListener('loadedmetadata', () => {
              if (active) video.play().catch(e => console.log('Autoplay blocked:', e));
            });
          }
        } catch (err) {
          console.error('HLS load error:', err);
        }
      } else {
        // MPEG-DASH Playback using dash.js
        try {
          await loadScript('https://cdn.jsdelivr.net/npm/dashjs@4.7.1/dist/dash.all.min.js', 'dash-js-cdn');
          if (!active) return;
          const dashjs = (window as any).dashjs;
          if (dashjs) {
            const player = dashjs.MediaPlayer().create();
            player.initialize(video, dashUrl, true);
            dashPlayerRef.current = player;
            
            player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
              if (!active) return;
              const tracks = player.getTracksFor('video');
              if (tracks && tracks.length > 0) {
                const bitrates = player.getBitrateInfoListFor('video').map((b: any) => `${b.height}p`);
                setQualityLevels(['Auto', ...bitrates]);
              }
            });
          }
        } catch (err) {
          console.error('DASH load error:', err);
        }
      }
    };

    initPlayer();

    return () => {
      active = false;
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (dashPlayerRef.current) {
        dashPlayerRef.current.destroy();
        dashPlayerRef.current = null;
      }
    };
  }, [isPlaying, playerProtocol, hlsUrl, dashUrl, stream.status]);

  // Adjust volume dynamically
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = volume === 0;
      videoRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Handle manual/auto quality switches
  const changePlayerQuality = (quality: string) => {
    setSelectedQuality(quality);
    if (playerProtocol === 'hls' && hlsInstanceRef.current) {
      const hls = hlsInstanceRef.current;
      if (quality === 'Auto') {
        hls.currentLevel = -1;
      } else {
        const height = parseInt(quality);
        const idx = hls.levels.findIndex((l: any) => l.height === height);
        if (idx !== -1) {
          hls.currentLevel = idx;
        }
      }
    } else if (playerProtocol === 'dash' && dashPlayerRef.current) {
      const player = dashPlayerRef.current;
      if (quality === 'Auto') {
        player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
      } else {
        player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
        const height = parseInt(quality);
        const levels = player.getBitrateInfoListFor('video');
        const idx = levels.findIndex((l: any) => l.height === height);
        if (idx !== -1) {
          player.setQualityFor('video', idx, true);
        }
      }
    }
  };

  useEffect(() => {
    let interval: number;
    if (stream.status === 'live' && isPlaying) {
      interval = window.setInterval(() => {
        const base = volume > 0 ? (volume / 100) * 40 : 0;
        const peak = volume > 0 ? Math.random() * (volume / 100) * 60 : 0;
        setAudioLevel(base + peak);

        if (isMonitoring) {
          setLatency(prev => {
            const jitter = (Math.random() - 0.5) * 12;
            return Math.max(15, Math.min(350, Math.round(prev + jitter)));
          });
          setDroppedFrames(prev => {
            const chance = Math.random();
            if (chance > 0.94) return Math.min(10.0, prev + 0.15);
            if (chance < 0.12) return Math.max(0.0, prev - 0.1);
            return prev;
          });
        }
      }, 100);
    } else {
      setAudioLevel(0);
    }
    return () => clearInterval(interval);
  }, [stream.status, isPlaying, volume, isMonitoring]);

  useEffect(() => {
    let intervalId: any;
    
    const updateHistory = () => {
      setPerfHistory(prev => {
        const isLive = stream.status === 'live' && isPlaying;
        const baseBitrate = bitrate || stream.bitrate || 4500;
        
        let newBitrate = 0;
        let newBandwidth = 0;
        
        if (isLive) {
          const variance = (Math.random() - 0.5) * 400; // +/- 200 Kbps fluctuation
          newBitrate = Math.max(1000, Math.round(baseBitrate + variance));
          const audioKbps = 128;
          const overhead = 1.05 + (Math.random() * 0.02); // 5-7% protocol overhead
          newBandwidth = parseFloat((((newBitrate + audioKbps) * overhead) / 1000).toFixed(2));
        }
        
        const nextHistory = [...prev.slice(1), {
          time: 0,
          bitrate: newBitrate,
          bandwidth: newBandwidth
        }];
        
        return nextHistory.map((pt, idx) => ({
          ...pt,
          time: 59 - idx
        }));
      });
    };

    updateHistory();
    intervalId = setInterval(updateHistory, 1000);
    
    return () => clearInterval(intervalId);
  }, [stream.status, isPlaying, bitrate, stream.bitrate]);

  useEffect(() => {
    if (stream.status === 'scheduled' && stream.scheduledStart) {
      const updateCountdown = () => {
        const now = new Date();
        const start = new Date(stream.scheduledStart!);
        const diff = start.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeUntilStart('Starting soon...');
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
          setTimeUntilStart(`${days}d ${hours}h`);
        } else if (hours > 0) {
          setTimeUntilStart(`${hours}h ${mins}m`);
        } else {
          setTimeUntilStart(`${mins}m remaining`);
        }
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 60000);
      return () => clearInterval(interval);
    }
  }, [stream.status, stream.scheduledStart]);

  const copyToClipboard = (text: string, type: 'url' | 'key' | 'rtmp' | 'hls' | 'dash' | 'embed' | 'vlc' | 'videojs') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedPlayback(type);
      setTimeout(() => setCopiedPlayback(null), 2000);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedPlaybacks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  const handleRegenClick = () => {
    if (onRegenerateKey) {
      onRegenerateKey();
      setIsConfirmingRegen(false);
    }
  };

  const handleRestartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMonitoring(false);
    setIsPlaying(true);
    setLatency(24);
    setDroppedFrames(0.0);
    onRestartStream?.();
  };

  const handleQualityUpdate = (newBitrate: number, newCodec: StreamSession['codec']) => {
    setBitrate(newBitrate);
    setCodec(newCodec);
    onUpdateQuality?.(newBitrate, newCodec);
  };

  const getLatencyColor = (val: number) => {
    if (val < 60) return 'text-emerald-400';
    if (val < 150) return 'text-amber-400';
    return 'text-red-500';
  };

  const getDroppedColor = (val: number) => {
    if (val < 0.5) return 'bg-emerald-500';
    if (val < 2.0) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const isLocal = stream.ingestIp === '127.0.0.1' || stream.ingestIp.startsWith('192.168.') || stream.ingestIp.startsWith('10.');

  return (
    <div className={`bg-zinc-900 rounded-xl overflow-hidden border transition-all group shadow-xl flex flex-col h-full relative ${isMonitoring ? 'ring-2 ring-blue-500 border-blue-500/50' : 'border-zinc-800 hover:border-zinc-700'} ${stream.status === 'scheduled' ? 'opacity-90' : ''}`}>
      {/* Video Container */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden shrink-0">
        {stream.status === 'live' ? (
          <div className="relative w-full h-full overflow-hidden">
            {isPlaying ? (
              <div className="relative w-full h-full bg-black group/player">
                <video 
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  playsInline
                  autoPlay
                  controls={false}
                />
                
                {/* Micro Ambient Shadow Overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 flex flex-col gap-2 opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 z-10">
                  {/* Quality select & protocol selectors */}
                  <div className="flex items-center justify-between">
                    <div className="flex bg-zinc-950/80 rounded border border-zinc-800 p-0.5 text-[8px] font-bold">
                      <button 
                        onClick={() => setPlayerProtocol('hls')}
                        className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${playerProtocol === 'hls' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        HLS
                      </button>
                      <button 
                        onClick={() => setPlayerProtocol('dash')}
                        className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${playerProtocol === 'dash' ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        DASH
                      </button>
                    </div>

                    {qualityLevels.length > 0 && (
                      <select 
                        value={selectedQuality}
                        onChange={(e) => changePlayerQuality(e.target.value)}
                        className="bg-zinc-950/95 border border-zinc-800 rounded text-[8px] font-bold px-1.5 py-0.5 text-zinc-300 outline-none cursor-pointer"
                      >
                        {qualityLevels.map(lvl => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Volume slider & protocol badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setIsPlaying(false)}
                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all cursor-pointer"
                        title="Stop playback"
                      >
                        <Pause className="w-3.5 h-3.5 fill-white" />
                      </button>
                      
                      <div className="flex items-center gap-1">
                        <Volume2 className="w-3 h-3 text-zinc-400" />
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={volume}
                          onChange={(e) => setVolume(parseInt(e.target.value))}
                          className="w-12 sm:w-16 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                    </div>

                    <span className="text-[8px] font-mono bg-red-600 text-white font-black px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse flex items-center gap-1">
                      <span className="w-1 h-1 bg-white rounded-full"></span>
                      LIVE • {playerProtocol.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <img 
                  src={stream.thumbnailUrl} 
                  alt={stream.title} 
                  className="w-full h-full object-cover transition-all duration-700 opacity-60 scale-100"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <button 
                    onClick={() => setIsPlaying(true)}
                    className="p-3.5 sm:p-4 bg-blue-600 hover:bg-blue-500 rounded-full text-white shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 group/playbtn border border-blue-400/20 cursor-pointer"
                    title="Start Playback"
                  >
                    <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-white ml-0.5 group-hover/playbtn:scale-105 transition-all" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : stream.status === 'scheduled' ? (
          <div className="relative w-full h-full overflow-hidden">
            <img 
              src={stream.thumbnailUrl} 
              alt={stream.title} 
              className="w-full h-full object-cover opacity-30 scale-100 grayscale-[0.8]"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-900/10 backdrop-blur-[2px]">
              <Calendar className="w-8 h-8 text-blue-400 mb-2 opacity-60" />
              <div className="px-3 py-1 bg-blue-500/20 rounded-full border border-blue-500/30">
                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.2em]">{timeUntilStart || 'Scheduled'}</span>
              </div>
              <p className="mt-2 text-[9px] text-zinc-500 font-medium">
                {new Date(stream.scheduledStart!).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        ) : stream.status === 'disabled' ? (
          <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center text-center p-4 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-10 h-10 mb-2 text-red-500 animate-pulse" />
            <span className="font-bold text-xs sm:text-sm tracking-wide uppercase text-red-500">Stream Disabled</span>
            <p className="mt-2 text-[10px] text-zinc-400 max-w-[220px] leading-relaxed">
              This stream has been disabled by the administrator.
            </p>
          </div>
        ) : (
          <div className="text-zinc-600 flex flex-col items-center">
            <Radio className="w-10 h-10 sm:w-12 sm:h-12 mb-2 opacity-20" />
            <span className="font-bold text-xs sm:text-sm tracking-widest uppercase text-zinc-700">Off-Air</span>
          </div>
        )}
        
        {/* Overlay Controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              {stream.status === 'live' && (
                <button 
                  onClick={handlePlayToggle}
                  className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                >
                  {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
                </button>
              )}
              
              {stream.status === 'scheduled' && onGoLive && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onGoLive(); }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/40 text-xs font-bold uppercase tracking-wider"
                  >
                    <Rocket className="w-4 h-4" /> Go Live Now
                  </button>
                  <button 
                    onClick={handleRestartClick}
                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                    title="Reset Internal States"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              )}

              {stream.status === 'live' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsMonitoring(!isMonitoring); }}
                  className={`p-2 rounded-full transition-all flex items-center gap-1 sm:gap-2 ${isMonitoring ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  <Headphones className="w-4 h-4 sm:w-5 sm:h-5" />
                  {isMonitoring && <span className="text-[8px] sm:text-[10px] font-bold pr-1 animate-in fade-in slide-in-from-left-1 uppercase">Monitor</span>}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
               {isAdmin && onRemove && (
                 <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  className="px-2 py-1 sm:px-3 sm:py-1.5 bg-red-600/10 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-all text-[9px] sm:text-[10px] font-bold uppercase tracking-tighter flex items-center gap-1.5"
                 >
                   <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                   Remove
                 </button>
               )}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5">
            {stream.status === 'live' && (
              <div className={`flex items-center gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded text-[8px] sm:text-[10px] font-bold tracking-widest uppercase shadow-lg transition-all duration-300 ${isPlaying ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)] animate-pulse' : 'bg-zinc-800 text-zinc-500'}`}>
                <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isPlaying ? 'bg-white animate-ping' : 'bg-zinc-600'}`} />
                {isPlaying ? 'LIVE' : 'PAUSE'}
              </div>
            )}
            {stream.status === 'scheduled' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 bg-blue-600/90 text-white rounded text-[8px] sm:text-[10px] font-bold tracking-widest uppercase shadow-lg border border-blue-400/20">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                SOON
              </div>
            )}
            {stream.status === 'disabled' ? (
              <div id={`badge-disabled-${stream.id}`} className="flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 bg-red-600/95 text-white rounded text-[8px] sm:text-[10px] font-bold tracking-widest uppercase shadow-lg border border-red-500/30">
                DISABLED
              </div>
            ) : (
              <div id={`badge-enabled-${stream.id}`} className="flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 bg-emerald-600/95 text-white rounded text-[8px] sm:text-[10px] font-bold tracking-widest uppercase shadow-lg border border-emerald-500/20">
                ENABLED
              </div>
            )}
            {isEncrypted && (
              <div className="flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 bg-emerald-600/90 text-white rounded text-[8px] sm:text-[10px] font-bold tracking-widest uppercase shadow-lg">
                <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                SECURE
              </div>
            )}
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[8px] sm:text-[9px] font-bold uppercase backdrop-blur-md border ${isLocal ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-blue-500/20 border-blue-500/40 text-blue-400'}`}>
            {isLocal ? <Wifi className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <Cloud className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
            {isLocal ? 'LAN' : 'CLOUD'}
          </div>
        </div>

        {/* Resolution Badge */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md rounded text-[9px] sm:text-[10px] font-bold text-zinc-300 flex items-center border border-white/10 overflow-hidden">
          {isAdmin && onUpdateResolution ? (
            <div className="relative group/res flex items-center px-2 py-0.5 sm:py-1 hover:bg-white/10 transition-colors cursor-pointer">
              <Monitor className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-400 mr-1 sm:mr-1.5" />
              <span>{stream.resolution}</span>
              <select 
                value={stream.resolution}
                onChange={(e) => onUpdateResolution(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer text-zinc-950"
              >
                <option value="Source (Original)">Source (Original)</option>
                <option value="4K (3840×2160)">4K (3840×2160)</option>
                <option value="2K (2560×1440)">2K (2560×1440)</option>
                <option value="1080p (1920×1080)">1080p (1920×1080)</option>
                <option value="900p (1600×900)">900p (1600×900)</option>
                <option value="720p (1280×720)">720p (1280×720)</option>
                <option value="576p (1024×576)">576p (1024×576)</option>
                <option value="480p (854×480)">480p (854×480)</option>
                <option value="360p (640×360)">360p (640×360)</option>
                <option value="240p (426×240)">240p (426×240)</option>
                <option value="Audio Only">Audio Only</option>
                <option value="Custom Resolution">Custom Resolution</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center px-2 py-0.5 sm:py-1">
              <Monitor className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-400 mr-1 sm:mr-1.5" />
              {stream.resolution}
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="p-3 sm:p-4 space-y-4 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-2">
          {isEditing ? (
            <div className="flex-1 space-y-2 border border-blue-500/30 p-2.5 rounded-lg bg-zinc-950/40">
              <div className="space-y-0.5">
                <label className="text-[8px] font-bold text-zinc-500 uppercase block">Edit Title</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-bold text-zinc-500 uppercase block">Edit Broadcaster</label>
                <input 
                  type="text" 
                  value={editBroadcaster}
                  onChange={(e) => setEditBroadcaster(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-1.5 justify-end pt-1">
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditTitle(stream.title);
                    setEditBroadcaster(stream.broadcaster);
                  }} 
                  className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded text-[9px] font-bold uppercase"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    onEdit?.({ title: editTitle, broadcaster: editBroadcaster });
                    setIsEditing(false);
                  }} 
                  className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9px] font-bold uppercase"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm sm:text-base line-clamp-1 text-zinc-100">{stream.title}</h3>
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                 <p className="text-[10px] sm:text-xs text-zinc-400 font-medium truncate max-w-[100px] sm:max-w-none">@{stream.broadcaster}</p>
                 <span className="hidden xs:inline w-1 h-1 bg-zinc-700 rounded-full"></span>
                 <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500">{stream.ingestIp}</span>
              </div>
            </div>
          )}
          <div className="flex flex-col items-end gap-1.5 sm:gap-2 shrink-0">
            {stream.status === 'live' && (
              <div className="flex items-center gap-1 text-zinc-400 bg-zinc-800 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold">
                <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-500" />
                <span>{stream.viewers >= 1000 ? (stream.viewers / 1000).toFixed(1) + 'k' : stream.viewers}</span>
              </div>
            )}
            
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`p-1 sm:p-1.5 rounded transition-all border ${showAdvanced ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Sliders className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
                <button 
                  onClick={() => setIsEncrypted(!isEncrypted)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[8px] sm:text-[9px] font-bold transition-all border ${isEncrypted ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                >
                  {isEncrypted ? <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ShieldAlert className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-50" />}
                  <span className="hidden xs:inline">{isEncrypted ? "SECURE" : "UNSEC"}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Advanced Panel */}
        {showAdvanced && (
          <div className="bg-zinc-950/80 rounded-lg p-2.5 sm:p-3 border border-blue-500/20 space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
               <h4 className="text-[9px] sm:text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                 <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Quality & State
               </h4>
               <button onClick={() => setShowAdvanced(false)} className="text-zinc-600 hover:text-zinc-400">
                 <X className="w-3 h-3" />
               </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase">
                   <label>Target Bitrate</label>
                   <span className="font-mono text-zinc-300">{bitrate}k</span>
                </div>
                <input 
                  type="range" min="1000" max="12000" step="500" value={bitrate}
                  onChange={(e) => handleQualityUpdate(parseInt(e.target.value), codec)}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                    <Cpu className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Codec
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['H.264', 'H.265', 'AV1'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => handleQualityUpdate(bitrate, c)}
                        className={`py-1 rounded text-[7px] sm:text-[8px] font-bold border transition-all ${codec === c ? 'bg-blue-600/20 border-blue-600/50 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                    <RotateCcw className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Controls
                  </label>
                  <button
                    onClick={handleRestartClick}
                    className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-[8px] sm:text-[9px] font-bold text-zinc-300 transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCcw className="w-2.5 h-2.5" /> Restart Stream
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audio/Status Panel */}
        <div className={`bg-zinc-950/50 rounded-lg p-2.5 sm:p-3 border transition-colors space-y-2.5 sm:space-y-3 ${isMonitoring ? 'border-blue-500/30' : 'border-zinc-800/50'}`}>
          {stream.status === 'scheduled' ? (
             <div className="flex flex-col gap-2 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] sm:text-[10px] font-bold text-zinc-500 uppercase">Release Schedule</span>
                  <span className="text-[8px] sm:text-[10px] font-mono text-blue-400">T-minus {timeUntilStart}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-1/3 animate-pulse" />
                  </div>
                  <Calendar className="w-3 h-3 text-zinc-600" />
                </div>
             </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Mic className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${isMonitoring ? 'text-blue-500' : 'text-zinc-500'}`} />
                  <span className={`text-[8px] sm:text-[10px] font-bold uppercase ${isMonitoring ? 'text-blue-400' : 'text-zinc-500'}`}>Audio Level</span>
                </div>
                <span className={`text-[9px] sm:text-[10px] font-mono ${audioLevel > 80 ? 'text-red-500' : audioLevel > 50 ? 'text-yellow-500' : 'text-emerald-500'}`}>
                  {Math.round(audioLevel)} dB
                </span>
              </div>
              
              <div className="h-1.5 sm:h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-zinc-800/80">
                 {Array.from({ length: 24 }).map((_, i) => (
                   <div key={i} className={`h-full flex-1 rounded-[1px] transition-all duration-75 ${i * 4 < audioLevel ? (i > 18 ? 'bg-red-500' : i > 12 ? 'bg-yellow-500' : 'bg-emerald-500') : 'bg-zinc-800'}`} />
                 ))}
              </div>

              {isMonitoring && (
                <>
                  <div className="flex items-center gap-6 pt-1 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 group/latency">
                      <Timer className={`w-3 h-3 ${getLatencyColor(latency)} transition-colors`} />
                      <div className="flex flex-col">
                        <span className="text-[6px] sm:text-[7px] font-bold text-zinc-500 uppercase tracking-tighter">Latency</span>
                        <span className={`text-[9px] sm:text-[10px] font-mono font-bold ${getLatencyColor(latency)} transition-colors`}>{latency}ms</span>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center gap-2 group/dropped">
                      <Activity className={`w-3 h-3 ${droppedFrames > 1.0 ? 'text-red-400' : 'text-emerald-400'} transition-colors`} />
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[6px] sm:text-[7px] font-bold text-zinc-500 uppercase tracking-tighter">Dropped Frames</span>
                          <span className={`text-[8px] sm:text-[9px] font-mono font-bold ${droppedFrames > 1.0 ? 'text-red-400' : 'text-zinc-300'}`}>{droppedFrames.toFixed(1)}%</span>
                        </div>
                        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getDroppedColor(droppedFrames)} transition-all duration-300`} 
                            style={{ width: `${Math.min(100, (droppedFrames / 5) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live Telemetry Performance Graph */}
                  {(() => {
                    const svgWidth = 360;
                    const svgHeight = 110;
                    const padding = { top: 15, right: 35, bottom: 20, left: 35 };

                    const plotWidth = svgWidth - padding.left - padding.right;
                    const plotHeight = svgHeight - padding.top - padding.bottom;

                    const maxB = Math.max(...perfHistory.map(d => d.bitrate), 2000);
                    const maxBand = Math.max(...perfHistory.map(d => d.bandwidth), 2.0);

                    const pointsBitrate = perfHistory.map((d, i) => {
                      const x = padding.left + (i / 59) * plotWidth;
                      const y = padding.top + plotHeight - (d.bitrate / maxB) * plotHeight;
                      return { x, y, val: d.bitrate };
                    });

                    const pointsBandwidth = perfHistory.map((d, i) => {
                      const x = padding.left + (i / 59) * plotWidth;
                      const y = padding.top + plotHeight - (d.bandwidth / maxBand) * plotHeight;
                      return { x, y, val: d.bandwidth };
                    });

                    const lineBitrateD = pointsBitrate.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                    const areaBitrateD = pointsBitrate.length > 0 
                      ? `${lineBitrateD} L ${pointsBitrate[pointsBitrate.length - 1].x.toFixed(1)} ${(padding.top + plotHeight).toFixed(1)} L ${pointsBitrate[0].x.toFixed(1)} ${(padding.top + plotHeight).toFixed(1)} Z`
                      : '';

                    const lineBandwidthD = pointsBandwidth.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                    const areaBandwidthD = pointsBandwidth.length > 0 
                      ? `${lineBandwidthD} L ${pointsBandwidth[pointsBandwidth.length - 1].x.toFixed(1)} ${(padding.top + plotHeight).toFixed(1)} L ${pointsBandwidth[0].x.toFixed(1)} ${(padding.top + plotHeight).toFixed(1)} Z`
                      : '';

                    const activePt = hoveredIdx !== null ? perfHistory[hoveredIdx] : perfHistory[perfHistory.length - 1];
                    const activeTimeLabel = hoveredIdx !== null ? `${hoveredIdx === 59 ? 'Live' : `-${59 - hoveredIdx}s`}` : 'Live';

                    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
                      const svg = e.currentTarget;
                      const rect = svg.getBoundingClientRect();
                      const clientX = e.clientX - rect.left;
                      const scaleX = svgWidth / rect.width;
                      const svgX = clientX * scaleX;
                      
                      const relativeX = svgX - padding.left;
                      const fraction = relativeX / plotWidth;
                      const index = Math.round(fraction * 59);
                      
                      if (index >= 0 && index <= 59) {
                        setHoveredIdx(index);
                      } else {
                        setHoveredIdx(null);
                      }
                    };

                    return (
                      <div className="mt-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80 p-3 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Activity className="w-3 h-3 text-blue-500 animate-pulse" /> Live Telemetry
                          </span>
                          <span className="text-[8px] sm:text-[9px] font-bold text-zinc-500 font-mono uppercase bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                            Time: {activeTimeLabel}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] bg-zinc-950/40 p-2 rounded-lg border border-zinc-900">
                          <div className="flex flex-col">
                            <span className="text-[7px] text-zinc-500 uppercase font-bold tracking-tight flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Bitrate
                            </span>
                            <span className="font-mono font-bold text-blue-400">
                              {activePt && activePt.bitrate ? `${activePt.bitrate.toLocaleString()} Kbps` : '0 Kbps'}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[7px] text-zinc-500 uppercase font-bold tracking-tight flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Bandwidth
                            </span>
                            <span className="font-mono font-bold text-emerald-400">
                              {activePt && activePt.bandwidth ? `${activePt.bandwidth.toFixed(2)} Mbps` : '0.00 Mbps'}
                            </span>
                          </div>
                        </div>

                        <div className="relative">
                          <svg 
                            viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                            className="w-full h-auto select-none overflow-visible"
                            onMouseMove={handleMouseMove}
                            onMouseLeave={() => setHoveredIdx(null)}
                          >
                            <defs>
                              <linearGradient id="bitrateGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                              </linearGradient>
                              <linearGradient id="bandwidthGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Y-Axis Gridlines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                              const y = padding.top + ratio * plotHeight;
                              return (
                                <line 
                                  key={ratio}
                                  x1={padding.left} 
                                  y1={y} 
                                  x2={svgWidth - padding.right} 
                                  y2={y} 
                                  stroke="#1f1f23" 
                                  strokeWidth="1" 
                                  strokeDasharray="2,2" 
                                />
                              );
                            })}

                            {/* Y-Axis Left (Bitrate) Labels */}
                            <text x={padding.left - 5} y={padding.top + 3} textAnchor="end" className="text-[7px] fill-zinc-600 font-mono">
                              {Math.round(maxB / 1000)}M
                            </text>
                            <text x={padding.left - 5} y={padding.top + plotHeight / 2 + 3} textAnchor="end" className="text-[7px] fill-zinc-600 font-mono">
                              {Math.round(maxB / 2000)}M
                            </text>
                            <text x={padding.left - 5} y={padding.top + plotHeight + 3} textAnchor="end" className="text-[7px] fill-zinc-600 font-mono">
                              0
                            </text>

                            {/* Y-Axis Right (Bandwidth) Labels */}
                            <text x={svgWidth - padding.right + 5} y={padding.top + 3} textAnchor="start" className="text-[7px] fill-zinc-600 font-mono">
                              {maxBand.toFixed(1)}M
                            </text>
                            <text x={svgWidth - padding.right + 5} y={padding.top + plotHeight / 2 + 3} textAnchor="start" className="text-[7px] fill-zinc-600 font-mono">
                              {(maxBand / 2).toFixed(1)}M
                            </text>
                            <text x={svgWidth - padding.right + 5} y={padding.top + plotHeight + 3} textAnchor="start" className="text-[7px] fill-zinc-600 font-mono">
                              0M
                            </text>

                            {/* X-Axis Labels */}
                            <text x={padding.left} y={svgHeight - 4} textAnchor="middle" className="text-[7px] fill-zinc-600 font-mono">-60s</text>
                            <text x={padding.left + plotWidth / 2} y={svgHeight - 4} textAnchor="middle" className="text-[7px] fill-zinc-600 font-mono">-30s</text>
                            <text x={svgWidth - padding.right} y={svgHeight - 4} textAnchor="middle" className="text-[7px] fill-blue-500 font-mono font-bold">LIVE</text>

                            {/* Bitrate Area & Line */}
                            {pointsBitrate.length > 0 && (
                              <>
                                <path d={areaBitrateD} fill="url(#bitrateGrad)" />
                                <path d={lineBitrateD} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </>
                            )}

                            {/* Bandwidth Area & Line */}
                            {pointsBandwidth.length > 0 && (
                              <>
                                <path d={areaBandwidthD} fill="url(#bandwidthGrad)" />
                                <path d={lineBandwidthD} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </>
                            )}

                            {/* Interactive Hover Vertical cursor and nodes */}
                            {hoveredIdx !== null && (
                              <>
                                {/* Cursor Line */}
                                <line 
                                  x1={padding.left + (hoveredIdx / 59) * plotWidth} 
                                  y1={padding.top} 
                                  x2={padding.left + (hoveredIdx / 59) * plotWidth} 
                                  y2={padding.top + plotHeight} 
                                  stroke="#4b5563" 
                                  strokeWidth="1" 
                                  strokeDasharray="3,3"
                                />
                                {/* Bitrate dot */}
                                <circle 
                                  cx={pointsBitrate[hoveredIdx].x} 
                                  cy={pointsBitrate[hoveredIdx].y} 
                                  r="3" 
                                  fill="#3b82f6" 
                                  stroke="#09090b" 
                                  strokeWidth="1.5" 
                                />
                                <circle 
                                  cx={pointsBitrate[hoveredIdx].x} 
                                  cy={pointsBitrate[hoveredIdx].y} 
                                  r="7" 
                                  fill="#3b82f6" 
                                  fillOpacity="0.2" 
                                />

                                {/* Bandwidth dot */}
                                <circle 
                                  cx={pointsBandwidth[hoveredIdx].x} 
                                  cy={pointsBandwidth[hoveredIdx].y} 
                                  r="3" 
                                  fill="#10b981" 
                                  stroke="#09090b" 
                                  strokeWidth="1.5" 
                                />
                                <circle 
                                  cx={pointsBandwidth[hoveredIdx].x} 
                                  cy={pointsBandwidth[hoveredIdx].y} 
                                  r="7" 
                                  fill="#10b981" 
                                  fillOpacity="0.2" 
                                />
                              </>
                            )}
                          </svg>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              <div className="flex items-center gap-2.5 pt-0.5">
                <button onClick={() => setVolume(v => v === 0 ? 80 : 0)} className="text-zinc-500 hover:text-white transition-colors">
                  {volume === 0 ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </button>
                <div className="flex-1">
                  <input 
                    type="range" min="0" max="100" value={volume}
                    onChange={(e) => setVolume(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Stream Control Buttons (Start Playback / Test Stream) */}
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-zinc-800/50">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={stream.status !== 'live'}
            className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isPlaying 
                ? 'bg-zinc-800 text-white' 
                : stream.status === 'live' 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg' 
                  : 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-850'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" /> {isPlaying ? 'Stop Player' : 'Play Live'}
          </button>
          <button 
            onClick={runDiagnostics}
            disabled={isTesting}
            className="px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-750"
          >
            {isTesting ? (
              <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            )}
            Verify / Test
          </button>
        </div>

        {/* Inline Live Stream Verification Diagnostic Results */}
        {testReport && (
          <div className="bg-zinc-950/90 rounded-lg p-3 border border-emerald-500/20 text-[10px] space-y-2 relative mt-2.5 mb-2 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center pb-1 border-b border-zinc-800/80">
              <span className="font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Diagnostic Results
              </span>
              <button onClick={() => setTestReport(null)} className="text-zinc-500 hover:text-white cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto no-scrollbar font-mono">
              {Object.entries(testReport).map(([testName, val]: any) => (
                <div key={testName} className="flex flex-col gap-0.5 bg-zinc-900/50 p-1.5 rounded border border-zinc-850">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-300 text-[9px] uppercase tracking-tighter">
                      {testName.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className={`px-1 rounded font-black text-[8px] ${val.status === 'PASS' ? 'bg-emerald-500/15 text-emerald-400' : val.status === 'WARN' ? 'bg-yellow-500/15 text-yellow-500' : 'bg-red-500/15 text-red-500'}`}>
                      {val.status}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-400 leading-normal font-sans">
                    {val.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Configuration Tabs */}
        <div className="mt-auto space-y-3 pt-3 border-t border-zinc-800/50">
            <div className="flex items-center gap-2 bg-zinc-950/40 p-1 rounded-lg border border-zinc-800/50">
              <button 
                onClick={() => setConfigTab('broadcast')}
                className={`flex-1 py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 ${configTab === 'broadcast' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Server className="w-3 h-3" /> Broadcast
              </button>
              <button 
                onClick={() => setConfigTab('playback')}
                className={`flex-1 py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 ${configTab === 'playback' ? 'bg-emerald-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <PlayCircle className="w-3 h-3" /> Playback
              </button>
            </div>

            {configTab === 'broadcast' ? (
              <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex justify-between items-center gap-2">
                   <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-wider truncate">Ingest Server</p>
                      {onUpdateIpMode && (
                        <div className="relative shrink-0">
                           <button className="text-zinc-600 hover:text-blue-500 p-0.5"><ChevronDown className="w-2.5 h-2.5" /></button>
                           <select 
                            onChange={(e) => onUpdateIpMode(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            defaultValue={isLocal ? "lan" : "auto"}
                           >
                              <option value="auto">Public</option>
                              <option value="lan">LAN</option>
                              <option value="loopback">Host (127.0.0.1)</option>
                           </select>
                        </div>
                      )}
                   </div>
                   <span className={`text-[7px] sm:text-[8px] font-bold px-1 py-0.5 rounded border shrink-0 ${isLocal ? 'border-orange-500/20 text-orange-500/60' : 'border-blue-500/20 text-blue-500/60'}`}>
                     {isLocal ? 'LAN NODE' : 'GLOBAL'}
                   </span>
                </div>
                
                <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] bg-black/60 p-1.5 sm:p-2 rounded-lg border border-zinc-800/80 overflow-hidden">
                          <code className="text-blue-400 truncate mr-1.5 font-mono select-all flex-1">{stream.rtmpUrl}</code>
                          <button 
                            onClick={() => copyToClipboard(stream.rtmpUrl, 'url')} 
                            className="text-zinc-500 hover:text-white bg-zinc-800/50 p-1.5 rounded-md shrink-0"
                          >
                            {copiedUrl ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                          </button>
                      </div>
                    </div>

                    <div className="space-y-1 relative">
                      <div className={`flex items-center justify-between text-[10px] sm:text-[11px] bg-black/60 p-1.5 sm:p-2 rounded-lg border overflow-hidden transition-colors ${isConfirmingRegen ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-800/80'}`}>
                          {isConfirmingRegen ? (
                            <div className="flex items-center justify-between w-full">
                               <div className="flex items-center gap-1.5 text-amber-500">
                                 <AlertTriangle className="w-3 h-3" />
                                 <span className="text-[9px] font-bold uppercase tracking-tighter">Regenerate Key?</span>
                               </div>
                               <div className="flex items-center gap-1.5">
                                 <button onClick={() => setIsConfirmingRegen(false)} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[9px] font-bold uppercase">Cancel</button>
                                 <button onClick={handleRegenClick} className="px-2 py-0.5 bg-amber-600 text-white rounded text-[9px] font-bold uppercase">Confirm</button>
                               </div>
                            </div>
                          ) : (
                            <>
                              <code className="text-amber-400/80 truncate mr-1.5 font-mono tracking-widest flex-1">
                                {showStreamKey ? stream.streamKey : '••••••••••••'}
                              </code>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => setShowStreamKey(!showStreamKey)} className="text-zinc-500 hover:text-white p-1" title="Toggle Visibility">
                                  {showStreamKey ? <EyeOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                                </button>
                                <button onClick={() => copyToClipboard(stream.streamKey, 'key')} className="text-zinc-500 hover:text-white p-1" title="Copy Key">
                                  {copiedKey ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                                </button>
                                {isAdmin && onRegenerateKey && (
                                  <button onClick={() => setIsConfirmingRegen(true)} className="text-zinc-500 hover:text-amber-500 p-1 transition-colors" title="Regenerate Key">
                                    <RefreshCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                      </div>
                    </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-300 max-h-[450px] overflow-y-auto pr-1 no-scrollbar">
                {/* Resolution Management Panel */}
                {isAdmin && (
                  <div className="bg-zinc-950/80 rounded-xl p-3 border border-zinc-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5" /> Stream Encoder Dashboard
                      </h4>
                      <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 rounded font-mono font-bold uppercase">Pro Transcoder</span>
                    </div>

                    {/* Resolution Target and Custom Fields Section */}
                    <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/60 space-y-3">
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">Resolution Target</label>
                          <select
                            value={selectedResolution}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedResolution(val);
                              // Automatically set matching defaults for built-in resolutions if selected
                              if (val !== 'Custom Resolution') {
                                const preset = getResolutionPreset(val);
                                setCustomWidth(preset.width);
                                setCustomHeight(preset.height);
                                setCustomFps(preset.fps);
                                setCustomBitrate(parseInt(preset.videoBitrate) || 2500);
                                setCustomAudioBitrate(parseInt(preset.audioBitrate) || 128);
                                setCustomAspectRatio(preset.aspectRatio);
                                setCustomVideoCodec(preset.videoCodec === 'libx264' ? 'H.264' : preset.videoCodec === 'libx265' ? 'H.265' : preset.videoCodec === 'libsvtav1' ? 'AV1' : 'H.264');
                                setCustomAudioCodec(preset.audioCodec);
                                setCustomPreset(preset.preset);
                                setCustomProfile(preset.profile);
                                setCustomPixelFormat(preset.pixelFormat);
                              }
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                          >
                            <option value="Source (Original)">Source (Original)</option>
                            <option value="4K (3840×2160)">4K (3840×2160)</option>
                            <option value="2K (2560×1440)">2K (2560×1440)</option>
                            <option value="1080p (1920×1080)">1080p (1920×1080)</option>
                            <option value="900p (1600×900)">900p (1600×900)</option>
                            <option value="720p (1280×720)">720p (1280×720)</option>
                            <option value="576p (1024×576)">576p (1024×576)</option>
                            <option value="480p (854×480)">480p (854×480)</option>
                            <option value="360p (640×360)">360p (640×360)</option>
                            <option value="240p (426×240)">240p (426×240)</option>
                            <option value="Audio Only">Audio Only</option>
                            <option value="Custom Resolution">Custom Resolution</option>
                          </select>
                        </div>
                        <div className="text-[10px] text-zinc-500 leading-tight">
                          Select the target output resolution for this stream's transcode pipeline. Customizing properties requires choosing <span className="text-blue-400">Custom Resolution</span>.
                        </div>
                      </div>

                      {/* Custom Resolution Fields - Shown only when 'Custom Resolution' is selected */}
                      {selectedResolution === 'Custom Resolution' && (
                        <div className="space-y-3 pt-3 border-t border-zinc-800/60 animate-in fade-in duration-300">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Width</label>
                              <input
                                type="number"
                                value={customWidth}
                                onChange={(e) => setCustomWidth(Number(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Height</label>
                              <input
                                type="number"
                                value={customHeight}
                                onChange={(e) => setCustomHeight(Number(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Frame Rate (FPS)</label>
                              <input
                                type="number"
                                value={customFps}
                                onChange={(e) => setCustomFps(Number(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Video Bitrate (kbps)</label>
                              <input
                                type="number"
                                value={customBitrate}
                                onChange={(e) => setCustomBitrate(Number(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Audio Bitrate (kbps)</label>
                              <input
                                type="number"
                                value={customAudioBitrate}
                                onChange={(e) => setCustomAudioBitrate(Number(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Aspect Ratio</label>
                              <input
                                type="text"
                                value={customAspectRatio}
                                onChange={(e) => setCustomAspectRatio(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
                                placeholder="16:9"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Video Codec</label>
                              <select
                                value={customVideoCodec}
                                onChange={(e) => setCustomVideoCodec(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                              >
                                <option value="H.264">H.264</option>
                                <option value="H.265">H.265</option>
                                <option value="AV1">AV1</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Audio Codec</label>
                              <select
                                value={customAudioCodec}
                                onChange={(e) => setCustomAudioCodec(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                              >
                                <option value="aac">aac</option>
                                <option value="mp3">mp3</option>
                                <option value="opus">opus</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Preset</label>
                              <select
                                value={customPreset}
                                onChange={(e) => setCustomPreset(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                              >
                                <option value="ultrafast">ultrafast</option>
                                <option value="superfast">superfast</option>
                                <option value="veryfast">veryfast</option>
                                <option value="faster">faster</option>
                                <option value="fast">fast</option>
                                <option value="medium">medium</option>
                                <option value="slow">slow</option>
                                <option value="slower">slower</option>
                                <option value="placebo">placebo</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Profile</label>
                              <select
                                value={customProfile}
                                onChange={(e) => setCustomProfile(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                              >
                                <option value="baseline">baseline</option>
                                <option value="main">main</option>
                                <option value="high">high</option>
                                <option value="main10">main10</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Pixel Format</label>
                              <select
                                value={customPixelFormat}
                                onChange={(e) => setCustomPixelFormat(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                              >
                                <option value="yuv420p">yuv420p</option>
                                <option value="yuv422p">yuv422p</option>
                                <option value="yuv444p">yuv444p</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Rendering general validation errors if any */}
                    {validationErrors.length > 0 && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 space-y-1 animate-in fade-in duration-200">
                        <span className="text-[8px] text-red-400 font-black uppercase tracking-wider block">Validation Errors</span>
                        <ul className="list-disc pl-3 text-[9px] text-red-300 space-y-0.5">
                          {validationErrors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Resolution Profile Manager (Collapsible) */}
                  <div className="bg-zinc-950/80 rounded-xl p-3 border border-zinc-800/80 space-y-3">
                    <div 
                      onClick={() => setIsProfileManagerExpanded(!isProfileManagerExpanded)}
                      className="flex items-center justify-between cursor-pointer select-none"
                    >
                      <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5" /> Resolution Profile Manager
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 rounded font-mono font-bold uppercase">Pro Transcoder</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${isProfileManagerExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {isProfileManagerExpanded && (
                      <div className="space-y-3 animate-in slide-in-from-top-1 duration-200">
                        {/* Search & Actions Bar */}
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-zinc-500">
                              <span className="text-[10px] font-bold">🔍</span>
                            </span>
                            <input
                              type="text"
                              placeholder="Search profiles..."
                              value={profileSearchQuery}
                              onChange={(e) => setProfileSearchQuery(e.target.value)}
                              className="bg-zinc-900 border border-zinc-800 text-[10px] rounded px-2 py-1 pl-7 text-zinc-100 w-full focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <button
                            onClick={handleAddProfile}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[8px] px-2 py-1.5 rounded uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1"
                          >
                            <span>➕ Add Output Profile</span>
                          </button>
                        </div>

                        {/* Profile Table */}
                        <div className="overflow-x-auto rounded-lg border border-zinc-800/60 bg-zinc-900/10">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-zinc-900/60 text-[8px] text-zinc-400 uppercase font-black border-b border-zinc-800/80">
                                <th 
                                  onClick={() => {
                                    setProfileSortField('enabled');
                                    setProfileSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="p-2 cursor-pointer hover:bg-zinc-800 hover:text-white transition-colors"
                                >
                                  State
                                </th>
                                <th 
                                  onClick={() => {
                                    setProfileSortField('name');
                                    setProfileSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="p-2 cursor-pointer hover:bg-zinc-800 hover:text-white transition-colors"
                                >
                                  Profile Name
                                </th>
                                <th 
                                  onClick={() => {
                                    setProfileSortField('resolutionType');
                                    setProfileSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="p-2 cursor-pointer hover:bg-zinc-800 hover:text-white transition-colors"
                                >
                                  Type
                                </th>
                                <th 
                                  onClick={() => {
                                    setProfileSortField('resolution');
                                    setProfileSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="p-2 cursor-pointer hover:bg-zinc-800 hover:text-white transition-colors"
                                >
                                  Resolution
                                </th>
                                <th 
                                  onClick={() => {
                                    setProfileSortField('fps');
                                    setProfileSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="p-2 cursor-pointer hover:bg-zinc-800 hover:text-white transition-colors"
                                >
                                  FPS
                                </th>
                                <th className="p-2">Codec</th>
                                <th 
                                  onClick={() => {
                                    setProfileSortField('bitrate');
                                    setProfileSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="p-2 cursor-pointer hover:bg-zinc-800 hover:text-white transition-colors"
                                >
                                  Bitrate
                                </th>
                                <th 
                                  onClick={() => {
                                    setProfileSortField('audioEnabled');
                                    setProfileSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="p-2 cursor-pointer hover:bg-zinc-800 hover:text-white transition-colors"
                                >
                                  Audio
                                </th>
                                <th className="p-2">Est. Metrics</th>
                                <th className="p-2 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/40 text-[10px]">
                              {([...profilesList]
                                .filter(p => {
                                  if (!profileSearchQuery) return true;
                                  const q = profileSearchQuery.toLowerCase();
                                  return (
                                    p.name.toLowerCase().includes(q) ||
                                    p.resolutionType.toLowerCase().includes(q) ||
                                    (p.videoCodec && p.videoCodec.toLowerCase().includes(q))
                                  );
                                })
                                .sort((a, b) => {
                                  let valA: any = a[profileSortField];
                                  let valB: any = b[profileSortField];

                                  if (profileSortField === 'estCpu') {
                                    valA = getEstimatedCpuUsage(a);
                                    valB = getEstimatedCpuUsage(b);
                                  } else if (profileSortField === 'estBitrate') {
                                    valA = getEstimatedBitrate(a);
                                    valB = getEstimatedBitrate(b);
                                  } else if (profileSortField === 'resolution') {
                                    valA = (Number(a.width) || 0) * (Number(a.height) || 0);
                                    valB = (Number(b.width) || 0) * (Number(b.height) || 0);
                                  }

                                  if (typeof valA === 'string') {
                                    return profileSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                  } else {
                                    return profileSortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
                                  }
                                })
                              ).map((p, idx) => {
                                const cpuUsage = getEstimatedCpuUsage(p);
                                const outBitrate = getEstimatedBitrate(p);
                                return (
                                  <tr 
                                    key={p.id}
                                    draggable
                                    onDragStart={() => setDraggedIndex(idx)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => {
                                      if (draggedIndex === null) return;
                                      const items = [...profilesList];
                                      const draggedItem = items[draggedIndex];
                                      items.splice(draggedIndex, 1);
                                      items.splice(idx, 0, draggedItem);
                                      setProfilesList(items);
                                      setDraggedIndex(null);
                                    }}
                                    className={`hover:bg-zinc-900/40 transition-colors border-l-2 cursor-grab active:cursor-grabbing ${p.enabled ? 'border-l-blue-500' : 'border-l-zinc-700 opacity-60'}`}
                                  >
                                    {/* Enable / Disable toggle */}
                                    <td className="p-2 select-none">
                                      <input 
                                        type="checkbox"
                                        checked={p.enabled}
                                        onChange={() => handleToggleProfile(p.id)}
                                        className="accent-blue-500 cursor-pointer w-3 h-3"
                                      />
                                    </td>

                                    {/* Profile Name */}
                                    <td className="p-2 font-bold text-zinc-100 truncate max-w-[100px]" title={p.name}>
                                      {p.name}
                                    </td>

                                    {/* Resolution Type */}
                                    <td className="p-2">
                                      <span className="text-[8px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-1 py-0.5 rounded uppercase font-mono font-bold">
                                        {p.resolutionType === 'Custom Resolution' ? 'Custom' : p.resolutionType.replace(' Full HD', '').replace(' HD', '')}
                                      </span>
                                    </td>

                                    {/* Dimensions */}
                                    <td className="p-2 font-mono text-zinc-300">
                                      {p.width === 0 ? 'Audio Only' : `${p.width}x${p.height}`}
                                    </td>

                                    {/* FPS */}
                                    <td className="p-2 font-mono text-zinc-400">
                                      {p.width === 0 ? '—' : `${p.fps} fps`}
                                    </td>

                                    {/* Video Codec */}
                                    <td className="p-2 font-mono text-zinc-400">
                                      {p.width === 0 ? '—' : (p.videoCodec || 'H.264')}
                                    </td>

                                    {/* Video Bitrate */}
                                    <td className="p-2 font-mono text-zinc-300">
                                      {p.width === 0 ? '—' : `${p.bitrate}k`}
                                    </td>

                                    {/* Audio Config */}
                                    <td className="p-2">
                                      {p.audioEnabled ? (
                                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 rounded uppercase font-bold font-mono">
                                          {p.audioCodec.toUpperCase()}:{p.audioBitrate}k
                                        </span>
                                      ) : (
                                        <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 rounded uppercase font-bold font-mono">
                                          Muted
                                        </span>
                                      )}
                                    </td>

                                    {/* Metrics estimation */}
                                    <td className="p-2 space-y-1">
                                      <div className="flex gap-1">
                                        <span className={`text-[8px] px-1 rounded font-bold font-mono uppercase ${cpuUsage > 30 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : cpuUsage > 15 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                          Est.CPU: {cpuUsage}%
                                        </span>
                                        <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 rounded font-bold font-mono uppercase">
                                          {outBitrate}k
                                        </span>
                                      </div>
                                    </td>

                                    {/* Actions cell */}
                                    <td className="p-2 text-right">
                                      <div className="flex gap-1 justify-end items-center">
                                        <button
                                          onClick={() => setEditingProfile(p)}
                                          className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                                          title="Edit settings"
                                        >
                                          <Sliders className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleDuplicateProfile(p)}
                                          className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-blue-400 transition-colors"
                                          title="Duplicate Profile"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteProfile(p.id, p.name)}
                                          disabled={isDeletingProfile !== null}
                                          className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                          title={isDeletingProfile === p.id ? "Deleting..." : "Delete profile"}
                                        >
                                          {isDeletingProfile === p.id ? (
                                            <span className="text-xs animate-pulse">⌛</span>
                                          ) : (
                                            <Trash2 className="w-3 h-3" />
                                          )}
                                        </button>
                                        <div className="flex flex-col gap-0.5">
                                          <button
                                            onClick={() => handleMoveProfile(p.id, 'up')}
                                            disabled={idx === 0}
                                            className="p-0.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white disabled:opacity-30"
                                            title="Move Up"
                                          >
                                            ▲
                                          </button>
                                          <button
                                            onClick={() => handleMoveProfile(p.id, 'down')}
                                            disabled={idx === profilesList.length - 1}
                                            className="p-0.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white disabled:opacity-30"
                                            title="Move Down"
                                          >
                                            ▼
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Edit Profile Modal Overlay */}
                  {editingProfile && (() => {
                    const validationErrors = validateProfile(editingProfile, profilesList);
                    return (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
                          {/* Modal Header */}
                          <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/60">
                            <div className="flex items-center gap-2">
                              <Monitor className="w-4 h-4 text-blue-500" />
                              <h3 className="text-sm font-bold text-zinc-100">Configure Profile: {editingProfile.name}</h3>
                            </div>
                            <button
                              onClick={() => setEditingProfile(null)}
                              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Modal Content */}
                          <div className="p-4 overflow-y-auto space-y-4 max-h-[60vh] no-scrollbar">
                            {/* Live error notifier */}
                            {validationErrors.length > 0 && (
                              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg text-[10px] space-y-1 font-mono">
                                <p className="font-bold uppercase tracking-wider flex items-center gap-1 text-red-400/90">
                                  ⚠️ Profile Validation Warnings:
                                </p>
                                {validationErrors.map((err, idx) => (
                                  <div key={idx} className="flex items-start gap-1">
                                    <span>•</span>
                                    <span>{err}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Section 1: General Specs */}
                            <div className="space-y-3 bg-zinc-900/20 p-3 rounded-lg border border-zinc-800/50">
                              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block border-b border-zinc-800 pb-1">Video Configuration</span>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[8px] text-zinc-500 font-bold uppercase">Profile Name</label>
                                  <input
                                    type="text"
                                    value={editingProfile.name}
                                    onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-blue-500 text-zinc-200"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] text-zinc-500 font-bold uppercase">Resolution Type</label>
                                  <select
                                    value={editingProfile.resolutionType}
                                    onChange={(e) => {
                                      const type = e.target.value;
                                      let w = editingProfile.width;
                                      let h = editingProfile.height;
                                      let fps = editingProfile.fps;
                                      let br = editingProfile.bitrate;
                                      let aspect = editingProfile.aspectRatio || '16:9';

                                      if (type === '720p HD') {
                                        w = 1280; h = 720; fps = 30; br = 2500; aspect = '16:9';
                                      } else if (type === '1080p Full HD') {
                                        w = 1920; h = 1080; fps = 30; br = 4500; aspect = '16:9';
                                      } else if (type === '2K QHD') {
                                        w = 2560; h = 1440; fps = 60; br = 8000; aspect = '16:9';
                                      } else if (type === '4K UHD') {
                                        w = 3840; h = 2160; fps = 60; br = 12000; aspect = '16:9';
                                      }

                                      setEditingProfile({
                                        ...editingProfile,
                                        resolutionType: type,
                                        width: w,
                                        height: h,
                                        fps: fps,
                                        bitrate: br,
                                        aspectRatio: aspect
                                      });
                                    }}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1.5 text-[11px] focus:outline-none focus:border-blue-500 text-zinc-300"
                                  >
                                    <option value="720p HD">720p HD</option>
                                    <option value="1080p Full HD">1080p Full HD</option>
                                    <option value="2K QHD">2K QHD</option>
                                    <option value="4K UHD">4K UHD</option>
                                    <option value="Custom Resolution">Custom Resolution</option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[8px] text-zinc-500 font-bold uppercase">Width</label>
                                  <input
                                    type="number"
                                    disabled={editingProfile.resolutionType !== 'Custom Resolution'}
                                    value={editingProfile.width}
                                    onChange={(e) => setEditingProfile({ ...editingProfile, width: Number(e.target.value) })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-500 text-zinc-200 disabled:opacity-40"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] text-zinc-500 font-bold uppercase">Height</label>
                                  <input
                                    type="number"
                                    disabled={editingProfile.resolutionType !== 'Custom Resolution'}
                                    value={editingProfile.height}
                                    onChange={(e) => setEditingProfile({ ...editingProfile, height: Number(e.target.value) })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-500 text-zinc-200 disabled:opacity-40"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] text-zinc-500 font-bold uppercase">FPS</label>
                                  <input
                                    type="number"
                                    disabled={editingProfile.resolutionType !== 'Custom Resolution'}
                                    value={editingProfile.fps}
                                    onChange={(e) => setEditingProfile({ ...editingProfile, fps: Number(e.target.value) })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-500 text-zinc-200 disabled:opacity-40"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[8px] text-zinc-500 font-bold uppercase">Video Codec</label>
                                  <select
                                    value={editingProfile.videoCodec}
                                    onChange={(e) => setEditingProfile({ ...editingProfile, videoCodec: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1.5 text-[11px] focus:outline-none focus:border-blue-500 text-zinc-300"
                                  >
                                    <option value="H.264">H.264 (libx264)</option>
                                    <option value="H.265">H.265 (libx265)</option>
                                    <option value="AV1">AV1 (libsvtav1)</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] text-zinc-500 font-bold uppercase">Video Bitrate (kbps)</label>
                                  <input
                                    type="number"
                                    value={editingProfile.bitrate}
                                    onChange={(e) => setEditingProfile({ ...editingProfile, bitrate: Number(e.target.value) })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-500 text-zinc-200"
                                  />
                                </div>
                              </div>

                              {editingProfile.resolutionType === 'Custom Resolution' && (
                                <div className="space-y-3 pt-2 border-t border-zinc-800/40 animate-in fade-in duration-200">
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-zinc-500 font-bold uppercase">Max Bitrate (kbps)</label>
                                      <input
                                        type="number"
                                        value={editingProfile.maxBitrate || ''}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, maxBitrate: Number(e.target.value) || undefined })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-500 text-zinc-200"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-zinc-500 font-bold uppercase">Buffer Size (kb)</label>
                                      <input
                                        type="number"
                                        value={editingProfile.bufferSize || ''}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, bufferSize: Number(e.target.value) || undefined })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-500 text-zinc-200"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-zinc-500 font-bold uppercase">Aspect Ratio</label>
                                      <select
                                        value={editingProfile.aspectRatio || '16:9'}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, aspectRatio: e.target.value })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1.5 text-[11px] focus:outline-none focus:border-blue-500 text-zinc-300"
                                      >
                                        <option value="16:9">16:9</option>
                                        <option value="4:3">4:3</option>
                                        <option value="21:9">21:9</option>
                                        <option value="1:1">1:1</option>
                                        <option value="custom">custom</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-zinc-500 font-bold uppercase">Scaling Algorithm</label>
                                      <select
                                        value={editingProfile.scalingAlgorithm || 'bicubic'}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, scalingAlgorithm: e.target.value })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1.5 text-[11px] focus:outline-none focus:border-blue-500 text-zinc-300"
                                      >
                                        <option value="bicubic">Bicubic</option>
                                        <option value="bilinear">Bilinear</option>
                                        <option value="lanczos">Lanczos</option>
                                        <option value="neighbor">Nearest</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-zinc-500 font-bold uppercase">Keyframe GOP Size</label>
                                      <input
                                        type="number"
                                        value={editingProfile.keyframeInterval || ''}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, keyframeInterval: Number(e.target.value) || undefined })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-500 text-zinc-200"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-zinc-500 font-bold uppercase">Pixel Format</label>
                                      <select
                                        value={editingProfile.pixelFormat || 'yuv420p'}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, pixelFormat: e.target.value })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1.5 text-[11px] focus:outline-none focus:border-blue-500 text-zinc-300"
                                      >
                                        <option value="yuv420p">yuv420p</option>
                                        <option value="yuv422p">yuv422p</option>
                                        <option value="yuv444p">yuv444p</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-zinc-500 font-bold uppercase">Encoder Preset</label>
                                      <select
                                        value={editingProfile.encoderPreset || 'veryfast'}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, encoderPreset: e.target.value })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1.5 text-[11px] focus:outline-none focus:border-blue-500 text-zinc-300"
                                      >
                                        <option value="ultrafast">ultrafast</option>
                                        <option value="superfast">superfast</option>
                                        <option value="veryfast">veryfast</option>
                                        <option value="faster">faster</option>
                                        <option value="fast">fast</option>
                                        <option value="medium">medium</option>
                                        <option value="slow">slow</option>
                                        <option value="slower">slower</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Section 2: Audio Config */}
                            <div className="space-y-3 bg-emerald-950/10 p-3 rounded-lg border border-emerald-900/30">
                              <div className="flex items-center justify-between border-b border-emerald-900/20 pb-1">
                                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block">Audio Stream Configuration</span>
                                <label className="flex items-center gap-1.5 text-[9px] text-emerald-400 uppercase font-bold cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={editingProfile.audioEnabled} 
                                    onChange={(e) => setEditingProfile({ ...editingProfile, audioEnabled: e.target.checked })} 
                                    className="accent-emerald-500 rounded"
                                  />
                                  Enable Audio
                                </label>
                              </div>

                              {editingProfile.audioEnabled && (
                                <div className="space-y-3 animate-in fade-in duration-200">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-zinc-500 font-bold uppercase">Audio Codec</label>
                                      <select
                                        value={editingProfile.audioCodec}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, audioCodec: e.target.value })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1.5 text-[11px] focus:outline-none focus:border-blue-500 text-zinc-300"
                                      >
                                        <option value="aac">AAC (LC)</option>
                                        <option value="opus">Opus</option>
                                        <option value="mp3">MP3 (lame)</option>
                                        <option value="pcm">PCM (Uncompressed)</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-zinc-500 font-bold uppercase">Audio Bitrate</label>
                                      <select
                                        value={editingProfile.audioBitrate}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, audioBitrate: Number(e.target.value) })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1.5 text-[11px] focus:outline-none focus:border-blue-500 text-zinc-300"
                                      >
                                        <option value="64">64 kbps</option>
                                        <option value="96">96 kbps</option>
                                        <option value="128">128 kbps</option>
                                        <option value="160">160 kbps</option>
                                        <option value="192">192 kbps</option>
                                        <option value="256">256 kbps</option>
                                        <option value="320">320 kbps</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-zinc-500 font-bold uppercase">Sample Rate</label>
                                      <select
                                        value={editingProfile.audioSampleRate}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, audioSampleRate: Number(e.target.value) })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1.5 text-[11px] focus:outline-none focus:border-blue-500 text-zinc-300"
                                      >
                                        <option value="32000">32000 Hz</option>
                                        <option value="44100">44100 Hz</option>
                                        <option value="48000">48000 Hz</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-zinc-500 font-bold uppercase">Channels</label>
                                      <select
                                        value={editingProfile.audioChannels}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, audioChannels: e.target.value })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1.5 text-[11px] focus:outline-none focus:border-blue-500 text-zinc-300"
                                      >
                                        <option value="mono">Mono (1.0)</option>
                                        <option value="stereo">Stereo (2.0)</option>
                                      </select>
                                    </div>
                                  </div>

                                  {/* Volume Slider & Normalize */}
                                  <div className="grid grid-cols-2 gap-3 items-center">
                                    <div className="space-y-1 bg-zinc-900/40 p-2 rounded border border-zinc-800/60">
                                      <div className="flex justify-between items-center text-[8px] text-zinc-400 font-bold uppercase">
                                        <span>Volume</span>
                                        <span className="text-emerald-400">{editingProfile.audioVolume}%</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="0" 
                                        max="200" 
                                        step="5"
                                        value={editingProfile.audioVolume} 
                                        onChange={(e) => setEditingProfile({ ...editingProfile, audioVolume: Number(e.target.value) })} 
                                        className="w-full accent-emerald-500 h-1 rounded bg-zinc-800 cursor-pointer"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="flex items-center gap-2 bg-zinc-900/40 p-3 rounded border border-zinc-800/60 cursor-pointer select-none">
                                        <input 
                                          type="checkbox" 
                                          checked={editingProfile.audioNormalize} 
                                          onChange={(e) => setEditingProfile({ ...editingProfile, audioNormalize: e.target.checked })} 
                                          className="accent-emerald-500"
                                        />
                                        <span className="text-[10px] text-zinc-300 font-bold uppercase">Normalize Audio</span>
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Modal Footer */}
                          <div className="p-4 border-t border-zinc-800 bg-zinc-900/40 flex justify-end gap-2 shrink-0">
                            <button
                              onClick={() => setEditingProfile(null)}
                              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[10px] font-bold uppercase transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={validationErrors.length > 0}
                              onClick={() => {
                                if (validationErrors.length > 0) return;
                                setProfilesList(prev => prev.map(p => p.id === editingProfile.id ? editingProfile : p));
                                setEditingProfile(null);
                              }}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Apply Changes
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* LIVE FFmpeg Command Preview */}
                  <div className="bg-black/90 p-2 rounded-lg border border-zinc-800 font-mono text-[9px] text-zinc-400 space-y-1">
                    <div className="flex items-center justify-between text-[8px] text-zinc-500 uppercase tracking-widest font-sans font-bold">
                      <span>FFmpeg Command Preview</span>
                      <span className="text-blue-400">Live Generated</span>
                    </div>
                    <div className="bg-zinc-950 p-2 rounded border border-zinc-900 overflow-x-auto whitespace-pre-wrap select-all font-mono text-blue-300 leading-relaxed max-h-[120px] no-scrollbar">
                      {previewCommand || 'ffmpeg -re ...'}
                    </div>
                  </div>

                  {/* Operations Buttons Grid */}
                  <div className="grid grid-cols-5 gap-1 pt-1.5">
                    <button
                      onClick={handleSaveResolutionConfig}
                      className="px-1.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded text-[8px] font-black uppercase tracking-tighter flex flex-col items-center justify-center gap-1 cursor-pointer hover:shadow"
                      title="Save Configuration"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </button>
                    <button
                      onClick={handleResetResolutionConfig}
                      className="px-1.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[8px] font-black uppercase tracking-tighter flex flex-col items-center justify-center gap-1 cursor-pointer"
                      title="Reset Default Settings"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                    <button
                      onClick={handleCopyResolutionConfig}
                      className="px-1.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[8px] font-black uppercase tracking-tighter flex flex-col items-center justify-center gap-1 cursor-pointer"
                      title="Copy JSON Config"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </button>
                    <button
                      onClick={() => onCloneProfile?.({
                        resolution: selectedResolution,
                        width: Number(customWidth),
                        height: Number(customHeight),
                        fps: Number(customFps),
                        bitrate: Number(customBitrate),
                        aspectRatio: customAspectRatio,
                        videoCodec: customVideoCodec,
                        audioCodec: customAudioCodec,
                        preset: customPreset,
                        profile: customProfile,
                        pixelFormat: customPixelFormat,
                        enabledProfiles: customEnabledProfiles.join(','),
                        gopSize: Number(customGopSize),
                        bufferSize: Number(customBufferSize),
                        maxBitrate: Number(customMaxBitrate),
                        scalingAlgorithm: customScalingAlgorithm,
                        audioEnabled: customAudioEnabled,
                        audioBitrate: `${customAudioBitrate}k`,
                        audioSampleRate: Number(customAudioSampleRate),
                        audioChannels: customAudioChannels,
                        audioVolume: Number(customAudioVolume),
                        audioNormalize: customAudioNormalize,
                        audioNoiseReduction: customAudioNoiseReduction,
                        audioDelay: Number(customAudioDelay),
                        audioLanguage: customAudioLanguage,
                        audioTrackSelection: customAudioTrackSelection,
                        audioPassthrough: customAudioPassthrough,
                        audioTranscoding: customAudioTranscoding,
                        profilesJson: customProfilesJson
                      })}
                      className="px-1.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[8px] font-black uppercase tracking-tighter flex flex-col items-center justify-center gap-1 cursor-pointer"
                      title="Clone Settings to All Stream Panels"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Clone
                    </button>
                    <button
                      onClick={handleTestResolutionConfig}
                      disabled={isTesting}
                      className="px-1.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-400 hover:text-white rounded text-[8px] font-black uppercase tracking-tighter flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                      title="Test active transcoding"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      {isTesting ? 'Verifying' : 'Test'}
                    </button>
                  </div>

                  {/* Active Validation Result Container */}
                  {testReport && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 space-y-1.5 animate-in fade-in duration-200 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-400 uppercase text-[8px]">Diagnostics Response</span>
                        <button onClick={() => setTestReport(null)} className="text-zinc-600 hover:text-zinc-400 font-bold uppercase text-[8px]">Dismiss</button>
                      </div>
                      <div className="space-y-1 font-mono text-[9px]">
                        {Object.entries(testReport).map(([service, val]: any) => (
                           <div key={service} className="flex justify-between items-center bg-black/30 px-1.5 py-0.5 rounded">
                             <span className="text-zinc-500">{service}:</span>
                             <span className={val.status === 'PASS' ? 'text-emerald-400' : val.status === 'FAIL' ? 'text-red-400' : 'text-amber-400'}>
                               {val.status} ({val.reason})
                             </span>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* RTMP Row */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] font-black bg-emerald-500 text-white px-1 rounded">RTMP</span>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Direct Access</p>
                    </div>
                    <span className="text-[7px] font-bold text-zinc-600 uppercase">OBS / VLC</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] bg-black/60 p-1.5 rounded-lg border border-zinc-800/80">
                      <code className="text-emerald-400 truncate mr-1.5 font-mono flex-1">
                        {revealedPlaybacks.rtmp ? rtmpPlayback : `rtmp://${currentHost}/live/••••••`}
                      </code>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleReveal('rtmp')} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
                          {revealedPlaybacks.rtmp ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button onClick={() => copyToClipboard(rtmpPlayback, 'rtmp')} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
                          {copiedPlayback === 'rtmp' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                  </div>
                </div>

                {/* HLS Row */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] font-black bg-blue-500 text-white px-1 rounded">HLS</span>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">HLS Playlist</p>
                    </div>
                    <span className="text-[7px] font-bold text-zinc-600 uppercase flex items-center gap-1"><Smartphone className="w-2.5 h-2.5" /> Mobile</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] bg-black/60 p-1.5 rounded-lg border border-zinc-800/80">
                      <code className="text-blue-400 truncate mr-1.5 font-mono flex-1">
                        {revealedPlaybacks.hls ? hlsUrl : `${currentProto}//${currentHost}/hls/••••••/master.m3u8`}
                      </code>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleReveal('hls')} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
                          {revealedPlaybacks.hls ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button onClick={() => copyToClipboard(hlsUrl, 'hls')} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
                          {copiedPlayback === 'hls' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                  </div>
                </div>

                {/* DASH Row */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] font-black bg-purple-500 text-white px-1 rounded">DASH</span>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">MPEG-DASH Manifest</p>
                    </div>
                    <span className="text-[7px] font-bold text-zinc-600 uppercase flex items-center gap-1"><Monitor className="w-2.5 h-2.5" /> Web Player</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] bg-black/60 p-1.5 rounded-lg border border-zinc-800/80">
                      <code className="text-purple-400 truncate mr-1.5 font-mono flex-1">
                        {revealedPlaybacks.dash ? dashUrl : `${currentProto}//${currentHost}/dash/••••••/manifest.mpd`}
                      </code>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleReveal('dash')} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
                          {revealedPlaybacks.dash ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button onClick={() => copyToClipboard(dashUrl, 'dash')} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
                          {copiedPlayback === 'dash' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                  </div>
                </div>

                {/* Embed URL Row */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] font-black bg-rose-500 text-white px-1 rounded">EMBED</span>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">iFrame Embed</p>
                    </div>
                    <span className="text-[7px] font-bold text-zinc-600 uppercase flex items-center gap-1"><Globe className="w-2.5 h-2.5" /> HTML</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] bg-black/60 p-1.5 rounded-lg border border-zinc-800/80">
                      <code className="text-rose-400 truncate mr-1.5 font-mono flex-1 select-all">
                        {`<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`}
                      </code>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyToClipboard(`<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`, 'embed')} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
                          {copiedPlayback === 'embed' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                  </div>
                </div>

                {/* VLC Row */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] font-black bg-amber-500 text-white px-1 rounded">VLC</span>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">VLC Player Target</p>
                    </div>
                    <span className="text-[7px] font-bold text-zinc-600 uppercase">Network Stream</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] bg-black/60 p-1.5 rounded-lg border border-zinc-800/80">
                      <code className="text-amber-400 truncate mr-1.5 font-mono flex-1">
                        {hlsUrl}
                      </code>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyToClipboard(hlsUrl, 'vlc')} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
                          {copiedPlayback === 'vlc' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                  </div>
                </div>

                {/* Video.js Row */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] font-black bg-indigo-500 text-white px-1 rounded">VIDEOJS</span>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Video.js Source config</p>
                    </div>
                    <span className="text-[7px] font-bold text-zinc-600 uppercase">JavaScript JSON</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] bg-black/60 p-1.5 rounded-lg border border-zinc-800/80">
                      <code className="text-indigo-400 truncate mr-1.5 font-mono flex-1">
                        {`{ src: "${hlsUrl}", type: "application/x-mpegURL" }`}
                      </code>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyToClipboard(`{ src: "${hlsUrl}", type: "application/x-mpegURL" }`, 'videojs')} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
                          {copiedPlayback === 'videojs' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-800/30 rounded border border-zinc-800/50">
                  <Info className="w-3 h-3 text-zinc-500 shrink-0" />
                  <p className="text-[8px] text-zinc-500 font-medium leading-tight">
                    HLS is recommended for VLC, Safari, and Mobile devices. Use DASH for professional web players like Shaka or Video.js.
                  </p>
                </div>
              </div>
            )}

            {/* Recording module removed */}

            {/* Administrator Controls */}
            {isAdmin && (onEnable || onDisable || onRemove || onEdit) && (
              <div id={`admin-controls-${stream.id}`} className="mt-4 pt-3 border-t border-zinc-800 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> Administrator Controls
                  </h4>
                  {stream.status === 'disabled' ? (
                    <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 rounded font-mono font-bold uppercase">Blocked</span>
                  ) : (
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 rounded font-mono font-bold uppercase">Active</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id={`btn-enable-${stream.id}`}
                    disabled={stream.status !== 'disabled'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnable?.();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      stream.status === 'disabled'
                        ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 cursor-pointer'
                        : 'bg-zinc-850 text-zinc-600 border border-zinc-900 cursor-not-allowed opacity-40'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" /> Enable
                  </button>
                  <button
                    id={`btn-disable-${stream.id}`}
                    disabled={stream.status === 'disabled'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDisable?.();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      stream.status !== 'disabled'
                        ? 'bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 cursor-pointer'
                        : 'bg-zinc-850 text-zinc-600 border border-zinc-900 cursor-not-allowed opacity-40'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" /> Disable
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id={`btn-edit-${stream.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-750 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    id={`btn-delete-${stream.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove?.();
                    }}
                    className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600 border border-red-500/20 text-red-400 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default StreamPlayer;
