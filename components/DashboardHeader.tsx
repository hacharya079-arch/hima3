
import React from 'react';
import { Activity, Server, Globe, Shield, Network } from 'lucide-react';

interface DashboardHeaderProps {
  publicIp?: string;
  localIp?: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ publicIp = '...', localIp = '...' }) => {
  return (
    <header className="bg-zinc-900/50 border-b border-zinc-800 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-8 py-3 sm:py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-blue-600/20 rounded-lg shrink-0">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">StreamPulse VPS</h1>
            <p className="text-[9px] sm:text-[10px] text-zinc-500 font-mono uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse"></span>
              <span className="truncate">Status: Operational</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar py-1 md:py-0">
          <div className="flex flex-col items-start md:items-end shrink-0">
            <span className="text-[8px] sm:text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Public IP</span>
            <span className="text-xs sm:text-sm font-medium flex items-center gap-1.5 text-blue-400 font-mono">
              <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              {publicIp}
            </span>
          </div>
          <div className="flex flex-col items-start md:items-end border-l border-zinc-800 pl-4 sm:pl-6 shrink-0">
            <span className="text-[8px] sm:text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Local IP</span>
            <span className="text-xs sm:text-sm font-medium flex items-center gap-1.5 text-orange-400 font-mono">
              <Network className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              {localIp}
            </span>
          </div>
          <div className="hidden xs:flex flex-col items-start md:items-end border-l border-zinc-800 pl-4 sm:pl-6 shrink-0">
            <span className="text-[8px] sm:text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Instance</span>
            <span className="text-xs sm:text-sm font-medium flex items-center gap-1.5">
              <Server className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-400" />
              4vCPU / 16GB
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
