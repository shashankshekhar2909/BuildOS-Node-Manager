import React, { useState, useEffect } from 'react';
import { 
  Activity, Shield, Cpu, HardDrive, Server, RefreshCw, AlertCircle, 
  CheckCircle2, XCircle, Clock, Zap, ToggleLeft, ToggleRight, Info,
  Unlock, Key, Eye, HelpCircle, ArrowLeft
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

export default function NodeDetailsPage({ 
  host, 
  hosts, 
  setActiveHostId, 
  onBackToFeet,
  currentUserRole 
}: NodeDetailsPageProps) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [chaosActive, setChaosActive] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [uptimeTicks, setUptimeTicks] = useState(0);

  // Simulate Uptime ticks
  useEffect(() => {
    const timer = setInterval(() => {
      setUptimeTicks((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!host) {
    return (
      <div className="border border-[#393939] bg-[#262626] p-16 text-center text-[#8d8d8d] font-mono uppercase text-xs tracking-widest select-none">
        <Server className="h-10 w-10 text-[#8d8d8d] mx-auto mb-4 animate-bounce" />
        No server node selected. Choose a node from key overview dashboard to inspect details.
      </div>
    );
  }

  // Derived mock Node specifications based on IP/Host ID
  const isVirtual = host.isSimulated;
  const cpuModel = isVirtual 
    ? (host.id === 'host-sim3' ? 'AMD EPYC™ 9654 (16 vCPU)' : 'Intel® Xeon® Platinum 8480 (8 vCPU)')
    : 'ARM Cortex™ A72 (4 vCPU / Raspberry Pi)';
  const memoryType = isVirtual ? 'DDR5 Registered ECC' : 'LPDDR4 Unified SDRAM';
  const osKernel = isVirtual ? 'Ubuntu 24.04 LTS (Linux 6.8.0-generic)' : 'Debian GNU/Linux 12 (Linux 6.1.0-rpi)';
  const datacenterRegion = isVirtual 
    ? (host.id === 'host-sim3' ? 'us-east-1 (N. Virginia, USA)' : 'eu-central-1 (Frankfurt, DE)')
    : 'Home Automation Cabinet (Cabinet #2, Row A)';
  const bandwidthCap = isVirtual ? '10 Gbps Duplex' : '1 Gbps RJ45 Ethernet';
  const diskStorage = isVirtual ? 'Proxmox NVMe RAID 10' : 'Kingston SSD SATA v3';

  // Toggle dynamic chaos test: Spikes host simulated CPU metrics 
  const triggerChaosTest = () => {
    if (chaosActive) {
      setChaosActive(false);
      return;
    }
    setChaosActive(true);
    // Automatically decay chaos after 30 seconds
    setTimeout(() => {
      setChaosActive(false);
    }, 30000);
  };

  // Modify host stats temporarily in client if chaos mode is activated
  useEffect(() => {
    if (!chaosActive || !host.simulatedStats) return;
    
    const interval = setInterval(() => {
      if (host.simulatedStats) {
        // Spike CPU utilization to 88 - 98% range
        host.simulatedStats.cpu = Math.min(99, Math.floor(88 + Math.random() * 11));
      }
    }, 1500);

    return () => {
      clearInterval(interval);
      // Decay statistics back down to standard healthy levels
      if (host.simulatedStats) {
        host.simulatedStats.cpu = Math.floor(12 + Math.random() * 10);
      }
    };
  }, [chaosActive, host]);

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Upper Navigation Back-Track */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#393939] pb-4">
        <button
          onClick={onBackToFeet}
          className="mr-auto py-2 px-3.5 bg-[#262626] hover:bg-[#393939] border border-[#393939] text-[#c6c6c6] hover:text-white font-mono text-[11px] font-bold tracking-wider uppercase transition rounded-none flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>BACK_TO_NODES_FLEET</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-[#8d8d8d] uppercase tracking-wider">Inspect Node Target:</span>
          <select
            value={host.id}
            onChange={(e) => setActiveHostId(e.target.value || null)}
            className="bg-[#262626] border border-[#393939] text-white text-xs font-mono px-3.5 py-2 focus:outline-none focus:border-[#0f62fe] cursor-pointer rounded-none"
          >
            {hosts.map(h => (
              <option key={h.id} value={h.id}>
                {h.name} [{h.ip}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side Column: Node DNA Summary Card */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Main Node DNA */}
          <div className="bg-[#262626] border border-[#393939] p-5 rounded-none space-y-4 shadow-sm relative">
            <div className="flex items-center justify-between border-b border-[#393939] pb-3 font-mono">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-[#78a9ff]" />
                <span className="font-bold text-[10px] text-white uppercase tracking-wider">Node Hardware DNA</span>
              </div>
              <span className={`text-[8px] font-bold font-mono uppercase px-2 py-0.5 border ${
                isVirtual 
                  ? 'bg-[#0f62fe]/10 text-[#78a9ff] border-[#0f62fe]/35' 
                  : 'bg-[#24a148]/10 text-[#42be65] border-[#24a148]/35'
              }`}>
                {isVirtual ? 'VIRTUAL_WORKFLOW' : 'PHYSICAL_HARDWARE'}
              </span>
            </div>

            {/* Vital parameters list */}
            <div className="space-y-3 font-mono text-[11px]">
              <div>
                <span className="text-[#8d8d8d] block text-[9px] uppercase tracking-wider">HOST SPECIFICATION</span>
                <span className="text-white font-semibold flex items-center gap-1.5 mt-0.5">
                  <Cpu className="h-3.5 w-3.5 text-[#8d8d8d]" />
                  {cpuModel}
                </span>
                <span className="text-[10px] text-[#a8a8a8] block pl-5">{memoryType} Architecture</span>
              </div>

              <div>
                <span className="text-[#8d8d8d] block text-[9px] uppercase tracking-wider">OPERATING SYSTEM / KERNEL</span>
                <span className="text-white font-semibold mt-0.5 block truncate">
                  {osKernel}
                </span>
              </div>

              <div>
                <span className="text-[#8d8d8d] block text-[9px] uppercase tracking-wider">GEOGRAPHIC REGION</span>
                <span className="text-white font-semibold block mt-0.5">
                  {datacenterRegion}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1.5 border-t border-[#313131]">
                <div>
                  <span className="text-[#8d8d8d] block text-[9px] uppercase tracking-wider">BANDWIDTH LIMIT</span>
                  <span className="text-white font-semibold text-[10px] block mt-0.5">{bandwidthCap}</span>
                </div>
                <div>
                  <span className="text-[#8d8d8d] block text-[9px] uppercase tracking-wider">STORAGE POOL</span>
                  <span className="text-white font-semibold text-[10px] block mt-0.5">{diskStorage}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#313131] space-y-2">
                <span className="text-[#8d8d8d] block text-[9px] uppercase tracking-wider">SSH KEY HASH / REGISTERED TOKEN</span>
                <div className="bg-[#161616] border border-[#393939] p-2 flex items-center justify-between">
                  <code className="text-xs text-[#78a9ff] shrink truncate mr-2 select-all tracking-tight font-mono">
                    {showPrivateKey ? 'ssh-rsa AAAAB3Nza1yc2EAAADAQABAAACAQDC8d...' : 'SHA256:gJ2XdfX... (Enforced)'}
                  </code>
                  <button 
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="p-1 hover:bg-[#262626] border border-transparent hover:border-[#393939] text-[#8d8d8d] hover:text-white transition cursor-pointer"
                    title="View Credential Handle details"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Live Action/Simulation Sandbox Box */}
          <div className="bg-[#262626] border border-[#393939] p-5 rounded-none space-y-4 shadow-sm">
            <div className="flex items-center gap-1.5 border-b border-[#393939] pb-3 text-slate-300 font-bold font-mono tracking-wider text-[10px] uppercase">
              <Zap className="h-4 w-4 text-amber-400 animate-pulse" />
              <span>Telemetry Simulation Sandbox</span>
            </div>

            <p className="text-[11px] text-[#a8a8a8] leading-relaxed">
              Use these interactive operators to trigger automated scripts, test monitoring alarms, and simulate failover routines.
            </p>

            <div className="space-y-4 font-mono text-[11px] pt-1">
              
              {/* Operator 1: Maintenance mode */}
              <div className="flex items-center justify-between p-3 bg-[#161616] border border-[#393939]">
                <div>
                  <span className="font-bold text-white block">Maintenance Mode</span>
                  <span className="text-[10px] text-[#8d8d8d] block mt-0.5">Toggle live telemetry off / warn</span>
                </div>
                <button
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className="transition duration-150 cursor-pointer focus:outline-none"
                >
                  {maintenanceMode ? (
                    <ToggleRight className="h-7 w-7 text-amber-500" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-[#5e5e5e]" />
                  )}
                </button>
              </div>

              {/* Operator 2: Chaos Spike */}
              <div className="flex items-center justify-between p-3 bg-[#161616] border border-[#393939]">
                <div>
                  <span className="font-bold text-white block">Chaos Spike Script</span>
                  <span className="text-[10px] text-[#8d8d8d] block mt-0.5">Simulate intensive cpu-heavy computations</span>
                </div>
                <button
                  onClick={triggerChaosTest}
                  className={`px-3 py-1.5 font-bold uppercase transition text-[10px] ${
                    chaosActive 
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                      : 'bg-[#393939] hover:bg-[#4d4d4d] text-[#e0e0e0] border border-[#4d4d4d]'
                  }`}
                >
                  {chaosActive ? 'SPIKE_LIVE' : 'SPIKE_CPU'}
                </button>
              </div>
            </div>

            {/* Warning Alarm banner when Maintenance is activated */}
            {maintenanceMode && (
              <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-mono animate-pulse">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <span className="font-bold block">MAINT_MODE_ACTIVE</span>
                  <p className="mt-0.5 text-[#d1c2a5]">Warning: Host machine flagged as offline for cluster load balancer routing pools.</p>
                </div>
              </div>
            )}

            {/* Ingress Network Interface bandwidth tables */}
            <div className="border border-[#393939] bg-[#161616] p-3 space-y-2.5">
              <span className="text-[9px] text-[#8d8d8d] font-mono block uppercase tracking-wider border-b border-[#313131] pb-1.5">NETWORK_INTERFACES_BANDWIDTH</span>
              <div className="space-y-1.5 font-mono text-[10px]">
                <div className="flex justify-between text-[#c6c6c6]">
                  <span>lo (Local Loopback)</span>
                  <span className="text-white font-bold">12.4 KB/s</span>
                </div>
                <div className="flex justify-between text-[#c6c6c6]">
                  <span>eth0 (Public Network)</span>
                  <span className="text-[#8d8d8d]">
                    In:{' '}
                    <span className="text-[#42be65] font-bold">
                      {chaosActive ? '4.8 MB/s' : '234.1 KB/s'}
                    </span>{' '}
                    | Out:{' '}
                    <span className="text-[#78a9ff] font-bold">
                      {chaosActive ? '12.1 MB/s' : '156.4 KB/s'}
                    </span>
                  </span>
                </div>
                <div className="flex justify-between text-[#c6c6c6]">
                  <span>docker0 (V-Bridge)</span>
                  <span className="text-white font-bold">4.2 KB/s</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Column: Tabs & Monitor panels */}
        <div className="lg:col-span-8">
          
          <div className="bg-[#262626] border border-[#393939] p-1.5 rounded-none mb-4 flex items-center justify-between font-mono text-[11px] text-[#8d8d8d]">
            <div className="flex items-center gap-2 pl-3">
              <Info className="h-3.5 w-3.5 text-[#78a9ff]" />
              <span>Full control of terminal diagnostic commands and application logs</span>
            </div>
            <span className="text-[10px] text-[#42be65] px-2.5 py-1 bg-[#1a3821] border border-[#24a148]/20 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-[#42be65] rounded-none animate-pulse" />
              INTEGRITY_SAFE
            </span>
          </div>

          <NodeMonitor
            host={host}
            currentUserRole={currentUserRole}
          />
        </div>

      </div>
    </div>
  );
}
