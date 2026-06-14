import React from 'react';
import { Server, Edit3, Trash2, Cpu, HardDrive, Cpu as MemIcon, RefreshCw, Layers, ShieldCheck, HelpCircle } from 'lucide-react';
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

export default function HostCard({ host, isActive, onSelect, onEdit, onDelete, onForceRefreshState, currentUserRole }: HostCardProps) {
  // Safe stats values or default simulated stats
  const stats = host.simulatedStats || { cpu: 12, ram: 1.8, disk: 25, dockerContainersCount: 0, openPorts: [22] };
  const cpuPercent = stats.cpu;
  const ramValue = stats.ram;
  const diskPercent = stats.disk;
  const containerCount = stats.dockerContainersCount;
  const ports = stats.openPorts || [];

  // CPU Alert colors
  const getCpuColor = (c: number) => {
    if (c > 85) return 'text-red-500 bg-red-500/10 border-red-500/30';
    if (c > 65) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    return 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20';
  };

  return (
    <div
      onClick={onSelect}
      className={`border p-5 relative flex flex-col justify-between transition-all duration-200 cursor-pointer select-none group rounded-none h-full ${
        isActive
          ? 'bg-[#353535] border-[#0f62fe] ring-1 ring-[#0f62fe]'
          : 'bg-[#262626] border-[#393939] hover:bg-[#313131] hover:border-[#4d4d4d]'
      }`}
    >
      {/* Header Info */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 transition-all rounded-none border ${isActive ? 'bg-[#0f62fe]/10 border-[#0f62fe] text-white' : 'bg-[#161616] border-[#393939] text-[#c6c6c6]'}`}>
              <Server className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-semibold text-[#f4f4f4] text-xs group-hover:text-white transition leading-none font-sans">
                {host.name}
              </h3>
              <p className="text-[10px] text-[#a8a8a8] font-mono mt-1 tracking-wider leading-none uppercase">
                {host.username}@{host.ip}:{host.port}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          {currentUserRole !== 'viewer' && (
            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title="Edit Node Connections"
                className="p-1.5 text-[#c6c6c6] hover:bg-[#4d4d4d] hover:text-white transition rounded-none"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Remove Host"
                className="p-1.5 text-[#c6c6c6] hover:bg-[#da1e28] hover:text-white transition rounded-none"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* IP badge & network status */}
        <div className="flex items-center justify-between text-[10px] pb-2 border-b border-[#393939] font-mono">
          <span className={`px-2 py-0.5 font-bold uppercase transition ${
            host.isSimulated
              ? 'bg-[#0f62fe]/10 text-[#78a9ff] border border-[#0f62fe]'
              : 'bg-[#24a148]/10 text-[#42be65] border border-[#24a148]'
          }`}>
            {host.isSimulated ? 'VIRTUAL LAB' : 'REAL SSH'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-[#24a148] animate-pulse rounded-none" />
            <span className="text-[#a8a8a8] font-bold tracking-widest">ONLINE</span>
          </div>
        </div>

        {/* Live Metrics Grid with subtle backdrops */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* CPU Bar */}
          <div className="bg-[#161616] p-2 border border-[#393939] rounded-none">
            <div className="flex items-center justify-between text-[10px] text-[#a8a8a8] mb-1 font-sans">
              <span className="flex items-center gap-1 select-none font-medium text-[10px]">
                <Cpu className="h-3 w-3 text-[#8d8d8d]" />
                CPU
              </span>
              <span className="font-mono font-bold text-white text-[10px]">{cpuPercent}%</span>
            </div>
            <div className="w-full bg-[#393939] h-1 rounded-none overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  cpuPercent > 80 ? 'bg-[#da1e28]' : cpuPercent > 60 ? 'bg-[#f1c21b]' : 'bg-[#24a148]'
                }`}
                style={{ width: `${cpuPercent}%` }}
              />
            </div>
          </div>

          {/* RAM Meter */}
          <div className="bg-[#161616] p-2 border border-[#393939] rounded-none">
            <div className="flex items-center justify-between text-[10px] text-[#a8a8a8] mb-1 font-sans">
              <span className="flex items-center gap-1 select-none font-medium text-[10px]">
                <MemIcon className="h-3 w-3 text-[#8d8d8d]" />
                RAM
              </span>
              <span className="font-mono font-bold text-white text-[10px]">{ramValue}G</span>
            </div>
            <div className="w-full bg-[#393939] h-1 rounded-none overflow-hidden">
              <div
                className="h-full bg-[#0f62fe] transition-all duration-500"
                style={{ width: `${Math.min(100, (ramValue / 16) * 100)}%` }}
              />
            </div>
          </div>

          {/* DISK SPACE */}
          <div className="bg-[#161616] p-2 border border-[#393939] rounded-none">
            <div className="flex items-center justify-between text-[10px] text-[#a8a8a8] mb-1 font-sans">
              <span className="flex items-center gap-1 select-none font-medium text-[10px]">
                <HardDrive className="h-3 w-3 text-[#8d8d8d]" />
                Disk
              </span>
              <span className="font-mono font-bold text-white text-[10px]">{diskPercent}%</span>
            </div>
            <div className="w-full bg-[#393939] h-1 rounded-none overflow-hidden">
              <div
                className="h-full bg-[#8a3ffc] transition-all duration-500"
                style={{ width: `${diskPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Docker details & port counts highlights */}
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-[#393939]">
          {/* Docker status */}
          <div className="flex items-center gap-1.5 bg-[#161616] px-2 py-1 border border-[#393939] text-[10px] text-[#c6c6c6] font-mono rounded-none">
            <Layers className="h-3.5 w-3.5 text-[#78a9ff]" />
            <span className="font-bold text-white">{containerCount}</span>
            <span className="text-[#8d8d8d]">DOCKERS</span>
          </div>

          {/* Direct console selection shortcut */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`px-3 py-1 text-[11px] font-semibold border rounded-none transition-all duration-150 ${
              isActive
                ? 'bg-[#0f62fe] border-[#0f62fe] text-white font-bold'
                : 'bg-[#393939] border-[#393939] text-[#f4f4f4] hover:bg-[#4d4d4d]'
            }`}
          >
            <span>Console</span>
          </button>
        </div>

        {/* Open scanned ports */}
        <div className="space-y-1 pt-1 opacity-90 font-mono">
          <span className="text-[9px] text-[#8d8d8d] font-bold uppercase tracking-wider block">Discovered Open Ports</span>
          <div className="flex flex-wrap gap-1 max-h-[48px] overflow-y-auto pr-0.5">
            {ports.map((portNum) => (
              <span
                key={portNum}
                className="bg-[#161616] border border-[#393939] text-[#c6c6c6] text-[9px] font-semibold px-2 py-0.5 rounded-none"
              >
                :{portNum}
              </span>
            ))}
            {ports.length === 0 && (
              <span className="text-[9px] text-[#525252] block font-semibold">No open ports found</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
