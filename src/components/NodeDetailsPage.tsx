import React, { useState, useEffect } from 'react';
import {
  Activity, Shield, Cpu, HardDrive, Server, AlertCircle,
  Zap, ToggleLeft, ToggleRight, Info, Key, Eye, EyeOff,
  ArrowLeft, Terminal, Network, Lock, User, Globe, Database
} from 'lucide-react';
import { HostMachine } from '../types';
import NodeMonitor from './NodeMonitor';

interface NodeDetailsPageProps {
  host: HostMachine | null;
  hosts: HostMachine[];
  setActiveHostId: (id: string | null) => void;
  onBackToFeet: () => void;
  currentUserRole?: 'admin' | 'viewer' | null;
}

interface LiveSpecs {
  os: string;
  kernel: string;
  hostname: string;
  cpuModel: string;
  cpuCores: string;
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-[#6f6f6f] font-sans uppercase tracking-wide">{label}</span>
      <span className={`text-[12px] text-[#e0e0e0] font-medium ${mono ? 'font-mono' : 'font-sans'}`}>{value}</span>
    </div>
  );
}

export default function NodeDetailsPage({
  host,
  hosts,
  setActiveHostId,
  onBackToFeet,
  currentUserRole
}: NodeDetailsPageProps) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [chaosActive, setChaosActive] = useState(false);
  const [showCredential, setShowCredential] = useState(false);
  const [liveSpecs, setLiveSpecs] = useState<LiveSpecs | null>(null);
  const [specsLoading, setSpecsLoading] = useState(false);

  const isVirtual = host?.isSimulated ?? false;

  // For real physical hosts: fetch live system specs via SSH
  useEffect(() => {
    if (!host || host.isSimulated) {
      setLiveSpecs(null);
      return;
    }

    let cancelled = false;
    setSpecsLoading(true);

    const fetchSpecs = async () => {
      try {
        const [osRes, cpuRes] = await Promise.allSettled([
          fetch('/api/ssh/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, command: 'uname -srm && cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'|| lsb_release -d 2>/dev/null | cut -f2' })
          }).then(r => r.json()),
          fetch('/api/ssh/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, command: 'nproc && cat /proc/cpuinfo 2>/dev/null | grep "model name" | head -1 | cut -d: -f2 | xargs || lscpu 2>/dev/null | grep "Model name" | cut -d: -f2 | xargs' })
          }).then(r => r.json()),
        ]);

        if (cancelled) return;

        const osOut = osRes.status === 'fulfilled' ? osRes.value?.output?.trim() || '' : '';
        const cpuOut = cpuRes.status === 'fulfilled' ? cpuRes.value?.output?.trim() || '' : '';

        const osLines = osOut.split('\n').map((l: string) => l.trim()).filter(Boolean);
        const cpuLines = cpuOut.split('\n').map((l: string) => l.trim()).filter(Boolean);

        setLiveSpecs({
          os: osLines[1] || osLines[0] || 'Unknown OS',
          kernel: osLines[0] || '',
          hostname: host.name,
          cpuModel: cpuLines[1] || 'Unknown CPU',
          cpuCores: cpuLines[0] || '?',
        });
      } catch {
        if (!cancelled) setLiveSpecs(null);
      } finally {
        if (!cancelled) setSpecsLoading(false);
      }
    };

    fetchSpecs();
    return () => { cancelled = true; };
  }, [host?.id]);

  // Chaos test — simulated hosts only
  const triggerChaosTest = () => {
    if (chaosActive) { setChaosActive(false); return; }
    setChaosActive(true);
    setTimeout(() => setChaosActive(false), 30000);
  };

  useEffect(() => {
    if (!chaosActive || !host?.simulatedStats) return;
    const interval = setInterval(() => {
      if (host.simulatedStats) {
        host.simulatedStats.cpu = Math.min(99, Math.floor(88 + Math.random() * 11));
      }
    }, 1500);
    return () => {
      clearInterval(interval);
      if (host?.simulatedStats) host.simulatedStats.cpu = Math.floor(12 + Math.random() * 10);
    };
  }, [chaosActive, host]);

  if (!host) {
    return (
      <div className="border border-[#393939] bg-[#262626] p-16 text-center text-[#8d8d8d] font-sans text-sm select-none">
        <Server className="h-10 w-10 text-[#525252] mx-auto mb-4" />
        <p>No node selected. Choose a node from Fleet Overview.</p>
      </div>
    );
  }

  // Static specs only for simulated hosts
  const simCpuModel = host.id === 'host-sim3' ? 'AMD EPYC™ 9654 (16 vCPU)' : 'Intel® Xeon® Platinum 8480 (8 vCPU)';
  const simMemory = host.id === 'host-sim3' ? 'DDR5 Registered ECC · 64 GB' : 'DDR5 Registered ECC · 32 GB';
  const simOs = 'Ubuntu 24.04 LTS (Linux 6.8.0-generic)';
  const simRegion = host.id === 'host-sim3' ? 'us-east-1 · N. Virginia' : 'eu-central-1 · Frankfurt';
  const simNetwork = '10 Gbps Duplex';
  const simDisk = host.id === 'host-sim3' ? 'NVMe RAID 10 · 4 TB' : 'NVMe RAID 1 · 2 TB';

  const authLabel = host.authType === 'password' ? 'Password auth' : host.authType === 'privateKey' ? 'SSH private key' : 'No auth';
  const credValue = host.authType === 'privateKey'
    ? (showCredential ? 'SHA256:••• (key registered)' : 'SHA256:gJ2X••••• (masked)')
    : host.authType === 'password'
    ? (showCredential ? '•••••••• (password set)' : '•••••••• (masked)')
    : 'None configured';

  return (
    <div className="space-y-5 animate-fade-in font-sans">

      {/* Back nav + node switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#393939] pb-4">
        <button
          onClick={onBackToFeet}
          className="flex items-center gap-2 py-2 px-3 bg-[#262626] hover:bg-[#313131] border border-[#393939] text-[#a8a8a8] hover:text-white text-[12px] font-sans transition rounded-none cursor-pointer w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Fleet</span>
        </button>

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-[#6f6f6f] font-sans">Inspecting:</span>
          <select
            value={host.id}
            onChange={(e) => setActiveHostId(e.target.value || null)}
            className="bg-[#262626] border border-[#393939] text-white text-[12px] font-sans px-3 py-1.5 focus:outline-none focus:border-[#0f62fe] cursor-pointer rounded-none"
          >
            {hosts.map(h => (
              <option key={h.id} value={h.id}>{h.name} [{h.ip}]</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* Left column */}
        <div className="lg:col-span-4 space-y-4">

          {/* Node info card */}
          <div className="bg-[#1e1e1e] border border-[#393939] rounded-none overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#393939] bg-[#262626]">
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-[#4589ff]" />
                <span className="text-[12px] font-semibold text-white">Node Profile</span>
              </div>
              <span className={`text-[10px] font-sans font-medium px-2 py-0.5 border ${
                isVirtual
                  ? 'bg-[#0f2040] text-[#78a9ff] border-[#0f62fe]/40'
                  : 'bg-[#0f2d14] text-[#42be65] border-[#24a148]/40'
              }`}>
                {isVirtual ? 'Simulated' : 'Physical'}
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* Connection details — always shown for all hosts */}
              <div className="space-y-3">
                <InfoRow label="Hostname" value={host.name} />
                <InfoRow label="SSH Endpoint" value={`${host.ip}:${host.port}`} mono />
                <InfoRow label="Username" value={host.username} mono />
                <InfoRow label="Auth method" value={authLabel} />
              </div>

              {/* Credential row */}
              <div className="pt-3 border-t border-[#2d2d2d]">
                <span className="text-[10px] text-[#6f6f6f] uppercase tracking-wide block mb-1.5">Credential</span>
                <div className="bg-[#161616] border border-[#2d2d2d] px-3 py-2 flex items-center justify-between gap-2">
                  <code className="text-[11px] text-[#78a9ff] font-mono truncate">{credValue}</code>
                  <button
                    onClick={() => setShowCredential(!showCredential)}
                    className="text-[#6f6f6f] hover:text-white transition shrink-0 cursor-pointer"
                  >
                    {showCredential ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Hardware specs: simulated = static fake, physical = SSH-fetched */}
              {isVirtual ? (
                <div className="pt-3 border-t border-[#2d2d2d] space-y-3">
                  <span className="text-[10px] text-[#6f6f6f] uppercase tracking-wide block">Hardware Spec</span>
                  <InfoRow label="CPU" value={simCpuModel} />
                  <InfoRow label="Memory" value={simMemory} />
                  <InfoRow label="OS" value={simOs} />
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow label="Region" value={simRegion} />
                    <InfoRow label="Network" value={simNetwork} />
                  </div>
                  <InfoRow label="Storage" value={simDisk} />
                </div>
              ) : (
                <div className="pt-3 border-t border-[#2d2d2d] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#6f6f6f] uppercase tracking-wide">System Info</span>
                    {specsLoading && <span className="text-[9px] text-[#525252] font-mono animate-pulse">fetching via ssh...</span>}
                  </div>
                  {liveSpecs ? (
                    <>
                      <InfoRow label="OS" value={liveSpecs.os} />
                      {liveSpecs.kernel && <InfoRow label="Kernel" value={liveSpecs.kernel} mono />}
                      {liveSpecs.cpuModel && liveSpecs.cpuModel !== 'Unknown CPU' && (
                        <InfoRow label="CPU" value={`${liveSpecs.cpuModel} (${liveSpecs.cpuCores} cores)`} />
                      )}
                    </>
                  ) : !specsLoading ? (
                    <p className="text-[11px] text-[#525252] font-sans">
                      Could not fetch live specs. Run <code className="text-[#78a9ff] font-mono">uname -a</code> in Diagnostics Lab.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Simulation controls — only for virtual hosts */}
          {isVirtual && (
            <div className="bg-[#1e1e1e] border border-[#393939] rounded-none overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#393939] bg-[#262626]">
                <Zap className="h-3.5 w-3.5 text-[#f1c21b]" />
                <span className="text-[12px] font-semibold text-white">Simulation Controls</span>
              </div>

              <div className="p-4 space-y-3">
                <p className="text-[11px] text-[#8d8d8d] leading-relaxed">
                  Trigger automated scripts, test monitoring alarms, and simulate failover routines on this virtual node.
                </p>

                {/* Maintenance toggle */}
                <div className="flex items-center justify-between p-3 bg-[#161616] border border-[#2d2d2d]">
                  <div>
                    <span className="text-[12px] font-medium text-white block">Maintenance Mode</span>
                    <span className="text-[10px] text-[#6f6f6f] block mt-0.5">Pause telemetry and flag offline</span>
                  </div>
                  <button onClick={() => setMaintenanceMode(!maintenanceMode)} className="cursor-pointer">
                    {maintenanceMode
                      ? <ToggleRight className="h-7 w-7 text-[#f1c21b]" />
                      : <ToggleLeft className="h-7 w-7 text-[#525252]" />
                    }
                  </button>
                </div>

                {/* Chaos spike */}
                <div className="flex items-center justify-between p-3 bg-[#161616] border border-[#2d2d2d]">
                  <div>
                    <span className="text-[12px] font-medium text-white block">CPU Stress Test</span>
                    <span className="text-[10px] text-[#6f6f6f] block mt-0.5">Simulate high CPU load spike</span>
                  </div>
                  <button
                    onClick={triggerChaosTest}
                    className={`px-3 py-1.5 text-[11px] font-medium border transition cursor-pointer rounded-none ${
                      chaosActive
                        ? 'bg-[#da1e28] border-[#da1e28] text-white animate-pulse'
                        : 'bg-transparent border-[#393939] text-[#a8a8a8] hover:border-[#da1e28] hover:text-[#ff8389]'
                    }`}
                  >
                    {chaosActive ? 'Running...' : 'Spike CPU'}
                  </button>
                </div>

                {maintenanceMode && (
                  <div className="flex items-start gap-2 p-3 bg-[#f1c21b]/8 border border-[#f1c21b]/30 text-[#fcd34d]">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div className="text-[11px]">
                      <span className="font-semibold block">Maintenance active</span>
                      <p className="text-[#a89240] mt-0.5">Node flagged offline for load balancer routing.</p>
                    </div>
                  </div>
                )}

                {/* Network interfaces — simulated */}
                <div className="border border-[#2d2d2d] bg-[#161616] p-3 space-y-2">
                  <div className="flex items-center gap-1.5 border-b border-[#2d2d2d] pb-1.5 mb-2">
                    <Network className="h-3 w-3 text-[#6f6f6f]" />
                    <span className="text-[10px] text-[#6f6f6f] font-sans uppercase tracking-wide">Network Interfaces</span>
                  </div>
                  <div className="space-y-1.5 font-mono text-[10px]">
                    <div className="flex justify-between text-[#8d8d8d]">
                      <span>lo</span>
                      <span className="text-[#a8a8a8]">12.4 KB/s</span>
                    </div>
                    <div className="flex justify-between text-[#8d8d8d]">
                      <span>eth0</span>
                      <span>
                        <span className="text-[#42be65]">{chaosActive ? '4.8 MB/s' : '234 KB/s'} ↓</span>
                        <span className="text-[#525252] mx-1">·</span>
                        <span className="text-[#78a9ff]">{chaosActive ? '12.1 MB/s' : '156 KB/s'} ↑</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-[#8d8d8d]">
                      <span>docker0</span>
                      <span className="text-[#a8a8a8]">4.2 KB/s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: monitor */}
        <div className="lg:col-span-8 space-y-3">
          <div className="bg-[#1e1e1e] border border-[#393939] px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-[#8d8d8d]">
              <Terminal className="h-3.5 w-3.5 text-[#4589ff]" />
              <span>Live diagnostics · SSH commands · Container management</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#42be65] font-sans">
              <span className="h-1.5 w-1.5 rounded-none bg-[#42be65] animate-pulse" />
              <span>Connected</span>
            </div>
          </div>

          <NodeMonitor key={host.id} host={host} currentUserRole={currentUserRole} />
        </div>
      </div>
    </div>
  );
}
