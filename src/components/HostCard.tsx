import React from 'react';
import { Server, Edit3, Trash2, Cpu, HardDrive, MemoryStick, Layers, Wifi, WifiOff } from 'lucide-react';
import { HostMachine } from '../types';

interface HostCardProps {
  host: HostMachine;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onForceRefreshState: () => void;
  currentUserRole?: 'admin' | 'viewer' | null;
}

function MetricBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-[#2d2d2d] h-[3px] rounded-none overflow-hidden">
      <div className={`h-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function HostCard({ host, isActive, onSelect, onEdit, onDelete, currentUserRole }: HostCardProps) {
  const stats = host.simulatedStats || { cpu: 12, ram: 1.8, disk: 25, dockerContainersCount: 0, openPorts: [22] };
  const cpuPct = stats.cpu;
  const ramGB = stats.ram;
  const diskPct = stats.disk;
  const containers = stats.dockerContainersCount;
  const ports = stats.openPorts || [];

  const cpuBarColor = cpuPct > 85 ? 'bg-[#da1e28]' : cpuPct > 65 ? 'bg-[#f1c21b]' : 'bg-[#24a148]';

  return (
    <div
      onClick={onSelect}
      className={`relative flex flex-col border transition-all duration-200 cursor-pointer select-none group h-full ${
        isActive
          ? 'bg-[#1e2533] border-[#0f62fe] shadow-[0_0_0_1px_#0f62fe22]'
          : 'bg-[#262626] border-[#393939] hover:border-[#525252] hover:bg-[#2a2a2a]'
      }`}
    >
      {/* Top accent bar */}
      <div className={`h-[2px] w-full ${isActive ? 'bg-[#0f62fe]' : 'bg-[#393939] group-hover:bg-[#525252] transition-colors'}`} />

      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-none border shrink-0 ${isActive ? 'bg-[#0f62fe]/15 border-[#0f62fe]/50' : 'bg-[#1e1e1e] border-[#393939]'}`}>
              <Server className={`h-4 w-4 ${isActive ? 'text-[#4589ff]' : 'text-[#6f6f6f]'}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-[13px] text-[#f4f4f4] leading-snug truncate group-hover:text-white transition font-sans">
                {host.name}
              </h3>
              <p className="text-[10px] text-[#8d8d8d] font-mono mt-0.5 truncate">
                {host.username}@{host.ip}:{host.port}
              </p>
            </div>
          </div>

          {currentUserRole !== 'viewer' && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                title="Edit"
                className="p-1.5 text-[#8d8d8d] hover:text-white hover:bg-[#393939] transition rounded-none"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                title="Remove"
                className="p-1.5 text-[#8d8d8d] hover:text-[#ff8389] hover:bg-[#da1e28]/10 transition rounded-none"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Status badges row */}
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-sans font-medium px-2 py-0.5 rounded-none border ${
            host.isSimulated
              ? 'bg-[#0f2040] text-[#78a9ff] border-[#0f62fe]/40'
              : 'bg-[#0f2d14] text-[#42be65] border-[#24a148]/40'
          }`}>
            {host.isSimulated ? 'Simulated' : 'Physical'}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-sans text-[#42be65]">
            <Wifi className="h-3 w-3" />
            <span>Online</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-2.5 pt-1 border-t border-[#2d2d2d]">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#8d8d8d] font-sans flex items-center gap-1.5">
                <Cpu className="h-3 w-3" /> CPU
              </span>
              <span className={`font-mono font-semibold ${cpuPct > 85 ? 'text-[#ff8389]' : cpuPct > 65 ? 'text-[#f1c21b]' : 'text-[#a8a8a8]'}`}>{cpuPct}%</span>
            </div>
            <MetricBar value={cpuPct} color={cpuBarColor} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#8d8d8d] font-sans flex items-center gap-1.5">
                <Cpu className="h-3 w-3 opacity-0" />RAM
              </span>
              <span className="font-mono text-[#a8a8a8] font-semibold">{ramGB} GB</span>
            </div>
            <MetricBar value={ramGB} max={16} color="bg-[#4589ff]" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#8d8d8d] font-sans flex items-center gap-1.5">
                <HardDrive className="h-3 w-3" /> Disk
              </span>
              <span className={`font-mono font-semibold ${diskPct > 85 ? 'text-[#ff8389]' : 'text-[#a8a8a8]'}`}>{diskPct}%</span>
            </div>
            <MetricBar value={diskPct} color={diskPct > 85 ? 'bg-[#da1e28]' : 'bg-[#8a3ffc]'} />
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2d2d2d] mt-auto">
          <div className="flex items-center gap-3 text-[10px] text-[#8d8d8d] font-sans">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3 text-[#78a9ff]" />
              <span className="text-white font-semibold">{containers}</span>
              <span>containers</span>
            </span>
            {ports.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-[#525252]">·</span>
                <span>{ports.length} port{ports.length !== 1 ? 's' : ''}</span>
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={`text-[10px] font-sans font-medium px-2.5 py-1 rounded-none border transition-all ${
              isActive
                ? 'bg-[#0f62fe] border-[#0f62fe] text-white'
                : 'bg-transparent border-[#393939] text-[#a8a8a8] hover:border-[#0f62fe] hover:text-[#78a9ff]'
            }`}
          >
            {isActive ? 'Selected' : 'Inspect'}
          </button>
        </div>

        {/* Open ports */}
        {ports.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ports.map((p) => (
              <span key={p} className="text-[9px] font-mono text-[#6f6f6f] bg-[#1e1e1e] border border-[#2d2d2d] px-1.5 py-0.5">
                :{p}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
