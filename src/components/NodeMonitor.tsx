import React, { useState, useEffect } from 'react';
import {
  Activity, Play, Square, RotateCw, Layers, Shield,
  Cpu, HardDrive, RefreshCw, AlertCircle, CheckCircle2, XCircle, Clock,
  Box, ChevronDown, ChevronRight, Container
} from 'lucide-react';
import { HostMachine } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface NodeMonitorProps {
  host: HostMachine | null;
  currentUserRole?: 'admin' | 'viewer' | null;
}

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
}

interface SystemService {
  name: string;
  status: 'active' | 'inactive';
  description: string;
}

interface MetricsSnapshot {
  time: string;
  cpu: number;
  ram: number;
  disk: number;
}

interface LxcContainer {
  ctid: string;
  status: string;
  name: string;
}

interface LxcDockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
}

export default function NodeMonitor({ host, currentUserRole }: NodeMonitorProps) {
  const [data, setData] = useState<{
    cpu: number;
    ram: { used: number; total: number; percent: number };
    disk: number;
    uptime: string;
    docker: DockerContainer[];
    services: SystemService[];
  } | null>(null);

  const [history, setHistory] = useState<MetricsSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'docker' | 'services' | 'lxc'>('status');

  // ProxMox LXC state
  const [lxcList, setLxcList] = useState<LxcContainer[] | null>(null);
  const [lxcLoading, setLxcLoading] = useState(false);
  const [lxcError, setLxcError] = useState<string | null>(null);
  const [expandedCtids, setExpandedCtids] = useState<Set<string>>(new Set());
  const [lxcDocker, setLxcDocker] = useState<Record<string, LxcDockerContainer[]>>({});
  const [lxcDockerLoading, setLxcDockerLoading] = useState<Record<string, boolean>>({});
  const [lxcActionLoading, setLxcActionLoading] = useState<string | null>(null);

  const isReadOnly = currentUserRole === 'viewer';

  const fetchDetails = async (showLoading = false) => {
    if (!host) return;
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch(`/api/hosts/${host.id}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host })
      });
      if (!res.ok) throw new Error("Could not fetch node telemetry details.");
      const details = await res.json();
      setData(details);
      setError(null);

      // Append to metrics history
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistory(prev => {
        const next = [...prev, {
          time: timeStr,
          cpu: details.cpu,
          ram: details.ram.percent,
          disk: details.disk
        }];
        // Keep the last 15 points
        if (next.length > 15) {
          return next.slice(next.length - 15);
        }
        return next;
      });
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load real-time telemetry details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!host) {
      setData(null);
      setHistory([]);
      return;
    }

    // Pre-populate with slight fluctuations so the line chart starts decorated beautifully
    const stats = host.simulatedStats || { cpu: 15, ram: 1.8, disk: 25 };
    const preHistory: MetricsSnapshot[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const pastTime = new Date(now.getTime() - i * 5000);
      const timeStr = pastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const seedCpu = Math.min(95, Math.max(5, stats.cpu + Math.floor(Math.random() * 13 - 6)));
      // Estimate RAM % representing simulated or default values (e.g. 8GB total max fallback)
      const totalGB = host.id === 'host-sim3' ? 16 : host.id === 'host-sim2' ? 8 : 4;
      const seedRamPercent = Math.min(95, Math.max(5, Math.round((stats.ram / totalGB) * 100 + Math.random() * 6 - 3)));
      preHistory.push({
        time: timeStr,
        cpu: seedCpu,
        ram: seedRamPercent,
        disk: stats.disk
      });
    }
    setHistory(preHistory);

    fetchDetails(true);

    const interval = setInterval(() => {
      fetchDetails(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [host]);

  const triggerDockerAction = async (containerId: string, containerName: string, actionName: string) => {
    if (!host) return;
    setActionLoading(`docker-${containerId}-${actionName}`);
    try {
      const res = await fetch(`/api/hosts/${host.id}/docker/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId, containerName, actionName })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      // Re-fetch metrics shortly
      await fetchDetails(false);
    } catch (e: any) {
      alert(`Docker Action Status Failure: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const triggerServiceAction = async (serviceName: string, actionName: string) => {
    if (!host) return;
    setActionLoading(`service-${serviceName}-${actionName}`);
    try {
      const res = await fetch(`/api/hosts/${host.id}/services/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceName, actionName, host })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      // Re-fetch metrics shortly
      await fetchDetails(false);
    } catch (e: any) {
      alert(`Service Action Status Failure: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Fix: pass host object so Firestore-managed hosts work
  const triggerDockerActionFixed = async (containerId: string, containerName: string, actionName: string) => {
    if (!host) return;
    setActionLoading(`docker-${containerId}-${actionName}`);
    try {
      const res = await fetch(`/api/hosts/${host.id}/docker/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId, containerName, actionName, host })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      await fetchDetails(false);
    } catch (e: any) {
      alert(`Docker Action failed: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchLxcList = async () => {
    if (!host) return;
    setLxcLoading(true);
    setLxcError(null);
    try {
      const res = await fetch(`/api/hosts/${host.id}/pct/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setLxcList(json.containers);
    } catch (e: any) {
      setLxcError(e.message || "Failed to list LXC containers");
    } finally {
      setLxcLoading(false);
    }
  };

  const toggleLxcExpand = async (ctid: string) => {
    const next = new Set(expandedCtids);
    if (next.has(ctid)) {
      next.delete(ctid);
      setExpandedCtids(next);
      return;
    }
    next.add(ctid);
    setExpandedCtids(next);
    if (lxcDocker[ctid]) return; // already fetched
    setLxcDockerLoading(prev => ({ ...prev, [ctid]: true }));
    try {
      const res = await fetch(`/api/hosts/${host!.id}/pct/${ctid}/docker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host })
      });
      const json = await res.json();
      setLxcDocker(prev => ({ ...prev, [ctid]: json.containers || [] }));
    } catch {
      setLxcDocker(prev => ({ ...prev, [ctid]: [] }));
    } finally {
      setLxcDockerLoading(prev => ({ ...prev, [ctid]: false }));
    }
  };

  const triggerLxcAction = async (ctid: string, actionName: string) => {
    setLxcActionLoading(`lxc-${ctid}-${actionName}`);
    try {
      const res = await fetch(`/api/hosts/${host!.id}/pct/${ctid}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionName, host })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      await fetchLxcList();
    } catch (e: any) {
      alert(`LXC action failed: ${e.message}`);
    } finally {
      setLxcActionLoading(null);
    }
  };

  const triggerLxcDockerAction = async (ctid: string, containerId: string, containerName: string, actionName: string) => {
    setLxcActionLoading(`docker-${ctid}-${containerId}-${actionName}`);
    try {
      const res = await fetch(`/api/hosts/${host!.id}/pct/${ctid}/docker/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId, containerName, actionName, host })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      // Refresh docker list for this ctid
      setLxcDocker(prev => ({ ...prev, [ctid]: [] }));
      setLxcDockerLoading(prev => ({ ...prev, [ctid]: true }));
      const r2 = await fetch(`/api/hosts/${host!.id}/pct/${ctid}/docker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host })
      });
      const j2 = await r2.json();
      setLxcDocker(prev => ({ ...prev, [ctid]: j2.containers || [] }));
    } catch (e: any) {
      alert(`Docker action in LXC failed: ${e.message}`);
    } finally {
      setLxcActionLoading(null);
      setLxcDockerLoading(prev => ({ ...prev, [ctid]: false }));
    }
  };

  if (!host) {
    return (
      <div className="border border-[#393939] bg-[#161616] p-12 text-center text-[#8d8d8d] font-mono uppercase text-[10px] tracking-widest select-none">
        Select a server node from above to launch interactive diagnostic center
      </div>
    );
  }

  return (
    <div id="node-monitor-center" className="bg-[#161616] border border-[#393939] rounded-none overflow-hidden relative font-sans">
      {/* Node Header Info Banner */}
      <div className="p-4 bg-[#262626] border-b border-[#393939] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#0f62fe]/10 border border-[#0f62fe]/40 rounded-none shrink-0">
            <Activity className="h-4 w-4 text-[#4589ff]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white text-[14px] font-sans">{host.name}</h2>
              <span className={`text-[10px] font-sans font-medium px-2 py-0.5 border ${
                host.isSimulated
                  ? 'bg-[#0f2040] text-[#78a9ff] border-[#0f62fe]/40'
                  : 'bg-[#0f2d14] text-[#42be65] border-[#24a148]/40'
              }`}>
                {host.isSimulated ? 'Simulated' : 'Physical'}
              </span>
            </div>
            <p className="text-[11px] text-[#8d8d8d] font-mono mt-0.5">
              {host.username}@{host.ip}:{host.port}
              {data?.uptime && <span className="text-[#6f6f6f] ml-2">· up {data.uptime.replace('up', '').trim()}</span>}
            </p>
          </div>
        </div>

        {/* Diagnostic Refresh Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchDetails(true)}
            disabled={isLoading}
            className="p-1 px-3 bg-[#393939] hover:bg-[#4d4d4d] border border-[#4d4d4d] text-white font-mono text-[10px] font-bold tracking-wider uppercase transition rounded-none flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading && 'animate-spin'}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Internal Subtabs Row */}
      <div className="flex border-b border-[#393939] bg-[#1a1a1a] px-4 overflow-x-auto">
        {([
          { key: 'status', icon: Clock, label: 'Telemetry', count: null },
          { key: 'docker', icon: Layers, label: 'Containers', count: data?.docker?.length ?? 0 },
          { key: 'services', icon: Shield, label: 'Services', count: data?.services?.length ?? 0 },
          ...(host.proxmox ? [{ key: 'lxc', icon: Box, label: 'LXC', count: lxcList?.length ?? null }] : []),
        ] as const).map(({ key, icon: Icon, label, count }) => (
          <button
            key={key}
            onClick={() => {
              setActiveSubTab(key as any);
              if (key === 'lxc' && !lxcList && !lxcLoading) fetchLxcList();
            }}
            className={`py-3 px-4 text-[12px] font-sans font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeSubTab === key
                ? 'border-[#0f62fe] text-white'
                : 'border-transparent text-[#8d8d8d] hover:text-[#c6c6c6]'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
            {count !== null && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none ${
                activeSubTab === key ? 'bg-[#0f62fe]/20 text-[#78a9ff]' : 'bg-[#262626] text-[#6f6f6f]'
              }`}>{count}</span>
            )}
            {key === 'lxc' && <span className="text-[9px] text-[#f1c21b] font-mono ml-0.5">PVE</span>}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="p-5">
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-500/5 border border-red-500/20 text-[#ff8389] mb-4 text-xs font-mono">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Status metrics panel: Live Area Charts */}
        {activeSubTab === 'status' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* CPU */}
              <div className="bg-[#1e1e1e] border border-[#393939] border-l-2 border-l-[#24a148] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-[#8d8d8d] font-sans flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-[#42be65]" /> CPU Usage
                  </span>
                  <span className="text-[10px] text-[#6f6f6f] font-mono">live</span>
                </div>
                <h3 className="text-3xl font-bold font-mono text-white tracking-tight">{data?.cpu ?? host.simulatedStats?.cpu ?? 0}%</h3>
                <p className="text-[10px] text-[#6f6f6f] font-sans mt-1">Dynamic core allocation</p>
              </div>

              {/* RAM */}
              <div className="bg-[#1e1e1e] border border-[#393939] border-l-2 border-l-[#4589ff] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-[#8d8d8d] font-sans flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-[#4589ff]" /> Memory
                  </span>
                  <span className="text-[10px] text-[#6f6f6f] font-mono">live</span>
                </div>
                <h3 className="text-3xl font-bold font-mono text-white tracking-tight">
                  {data?.ram ? `${data.ram.percent}%` : host.simulatedStats ? `${Math.round((host.simulatedStats.ram / (host.id === 'host-sim3' ? 16 : host.id === 'host-sim2' ? 8 : 4)) * 100)}%` : '0%'}
                </h3>
                <p className="text-[10px] text-[#6f6f6f] font-sans mt-1">
                  {data?.ram ? `${data.ram.used} GB / ${data.ram.total} GB` : `~${host.simulatedStats?.ram || 0} GB used`}
                </p>
              </div>

              {/* Disk */}
              <div className="bg-[#1e1e1e] border border-[#393939] border-l-2 border-l-[#8a3ffc] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-[#8d8d8d] font-sans flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5 text-[#a56eff]" /> Storage
                  </span>
                  <span className="text-[10px] text-[#6f6f6f] font-mono">root (/)</span>
                </div>
                <h3 className="text-3xl font-bold font-mono text-white tracking-tight">{data?.disk ?? host.simulatedStats?.disk ?? 0}%</h3>
                <p className="text-[10px] text-[#6f6f6f] font-sans mt-1">Disk occupancy</p>
              </div>
            </div>

            {/* Recharts Live Chart Canvas */}
            <div className="bg-[#202020] border border-[#393939] p-4">
              <div className="flex items-center justify-between border-b border-[#393939] pb-3 mb-4 font-mono text-[10px] text-[#8d8d8d]">
                <span className="font-semibold text-[#c6c6c6] font-sans text-[12px]">Performance History</span>
                <span className="text-[10px] text-[#525252] font-mono">5s interval · last 15 snapshots</span>
              </div>

              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#24a148" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#24a148" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f62fe" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#0f62fe" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#353535" />
                    <XAxis dataKey="time" stroke="#8d8d8d" fontSize={9} fontClassName="font-mono" />
                    <YAxis stroke="#8d8d8d" fontSize={9} fontClassName="font-mono" domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#161616', borderColor: '#393939', color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}
                      labelStyle={{ color: '#8d8d8d', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="cpu" name="CPU Usage %" stroke="#24a148" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                    <Area type="monotone" dataKey="ram" name="RAM Usage %" stroke="#0f62fe" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-center gap-5 mt-3 font-mono text-[10px]">
                <div className="flex items-center gap-1.5 text-[#a8a8a8]">
                  <span className="h-2 w-2 bg-[#24a148] block" />
                  <span>CPU Utilization</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#a8a8a8]">
                  <span className="h-2 w-2 bg-[#0f62fe] block" />
                  <span>RAM Utilization</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#a8a8a8]">
                  <span className="h-2 w-2 bg-[#8a3ffc] block" />
                  <span>Disk Occupancy (Fixed: {data?.disk ?? host.simulatedStats?.disk ?? 0}%)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Docker container command module */}
        {activeSubTab === 'docker' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#8d8d8d] border-b border-[#393939] pb-2 mb-2 uppercase">
              <span>Discovered Docker Containers running in namespace</span>
              <span>Operator controls active</span>
            </div>

            {data?.docker && data.docker.length > 0 ? (
              <div className="border border-[#393939] overflow-x-auto min-w-full">
                <table className="min-w-full font-mono text-xs text-left">
                  <thead className="bg-[#202020] text-[#c6c6c6] text-[10px] uppercase border-b border-[#393939]">
                    <tr>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Target Image</th>
                      <th className="py-2.5 px-3">Ports</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#393939] bg-[#161616]">
                    {data.docker.map((c) => {
                      const isUp = c.status.toLowerCase().includes('up');
                      return (
                        <tr key={c.id} className="hover:bg-[#202020]/50 transition">
                          <td className="py-3 px-3 font-bold text-[#78a9ff]">{c.name}</td>
                          <td className="py-3 px-3 text-[#a8a8a8] select-all font-mono text-[11px]">{c.image}</td>
                          <td className="py-3 px-3 text-[#c6c6c6] font-mono text-[11px]">{c.ports}</td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[10px] font-bold ${
                              isUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-none ${isUp ? 'bg-emerald-400' : 'bg-red-400'}`} />
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isUp ? (
                                <button
                                  disabled={isReadOnly || !!actionLoading}
                                  onClick={() => triggerDockerActionFixed(c.id, c.name, 'stop')}
                                  title="Stop Running Container"
                                  className="p-1 px-2 bg-[#ff8389]/10 hover:bg-[#da1e28] hover:text-white border border-[#ff8389]/30 text-[#ff8389] rounded-none text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center gap-1 disabled:opacity-40"
                                >
                                  <Square className="h-2.5 w-2.5" />
                                  <span>Stop</span>
                                </button>
                              ) : (
                                <button
                                  disabled={isReadOnly || !!actionLoading}
                                  onClick={() => triggerDockerActionFixed(c.id, c.name, 'start')}
                                  title="Start Exited Container"
                                  className="p-1 px-2 bg-[#42be65]/10 hover:bg-[#24a148] hover:text-white border border-[#42be65]/35 text-[#42be65] rounded-none text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center gap-1 disabled:opacity-40"
                                >
                                  <Play className="h-2.5 w-2.5" />
                                  <span>Start</span>
                                </button>
                              )}
                              <button
                                disabled={isReadOnly || !!actionLoading}
                                onClick={() => triggerDockerActionFixed(c.id, c.name, 'restart')}
                                title="Restart Active Container"
                                className="p-1 px-2 bg-[#78a9ff]/10 hover:bg-[#0f62fe] hover:text-white border border-[#78a9ff]/35 text-[#78a9ff] rounded-none text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center gap-1 disabled:opacity-40"
                              >
                                <RotateCw className="h-2.5 w-2.5" />
                                <span>Restart</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border border-[#393939] p-10 bg-[#202020] text-center text-[#8d8d8d] font-mono text-[10px] uppercase tracking-wider select-none">
                No Docker containers found on this node machine. Make sure Docker is deployed and active.
              </div>
            )}
          </div>
        )}

        {/* 3. System Services status tracker */}
        {activeSubTab === 'services' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#8d8d8d] border-b border-[#393939] pb-2 mb-2 uppercase">
              <span>Operational Systemd Daemon units</span>
              <span>Root access requested for triggers</span>
            </div>

            {data?.services && data.services.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.services.map((s) => {
                  const isActive = s.status === 'active';
                  return (
                    <div key={s.name} className="bg-[#202020] border border-[#393939] p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-white block">{s.name}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none text-[9px] font-bold uppercase ${
                            isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-[#e0e0e0]/5 text-[#a8a8a8] border border-[#c6c6c6]/20'
                          }`}>
                            {isActive ? (
                              <>
                                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-2.5 w-2.5 text-slate-400" />
                                <span>Inactive</span>
                              </>
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#a8a8a8] mt-1.5 leading-relaxed">{s.description}</p>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#393939]">
                        {isActive ? (
                          <button
                            disabled={isReadOnly || !!actionLoading}
                            onClick={() => triggerServiceAction(s.name, 'stop')}
                            className="p-1 px-2.5 bg-[#ff8389]/10 hover:bg-[#da1e28] hover:text-white border border-[#ff8389]/20 text-[#ff8389] text-[9px] font-mono font-bold uppercase transition cursor-pointer disabled:opacity-40"
                          >
                            Stop Daemon
                          </button>
                        ) : (
                          <button
                            disabled={isReadOnly || !!actionLoading}
                            onClick={() => triggerServiceAction(s.name, 'start')}
                            className="p-1 px-2.5 bg-[#42be65]/10 hover:bg-[#24a148] hover:text-white border border-[#42be65]/20 text-[#42be65] text-[9px] font-mono font-bold uppercase transition cursor-pointer disabled:opacity-40"
                          >
                            Start Daemon
                          </button>
                        )}
                        <button
                          disabled={isReadOnly || !!actionLoading}
                          onClick={() => triggerServiceAction(s.name, 'restart')}
                          className="p-1 px-2.5 bg-[#78a9ff]/10 hover:bg-[#0f62fe] hover:text-white border border-[#78a9ff]/20 text-[#78a9ff] text-[9px] font-mono font-bold uppercase transition cursor-pointer disabled:opacity-40"
                        >
                          Restart Unit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-[#393939] p-10 bg-[#202020] text-center text-[#8d8d8d] font-mono text-[10px] uppercase tracking-wider select-none">
                No systemd service descriptors detected.
              </div>
            )}
          </div>
        )}

        {/* 4. ProxMox LXC management panel */}
        {activeSubTab === 'lxc' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#8d8d8d] border-b border-[#393939] pb-2 mb-2">
              <span className="uppercase tracking-wider">ProxMox LXC containers · pct exec chaining</span>
              <button
                onClick={fetchLxcList}
                disabled={lxcLoading}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#393939] hover:bg-[#4d4d4d] border border-[#4d4d4d] text-white text-[10px] font-mono transition cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`h-3 w-3 ${lxcLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {lxcError && (
              <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-[#ff8389] text-[11px] font-mono">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{lxcError}</span>
              </div>
            )}

            {lxcLoading && !lxcList && (
              <div className="py-10 text-center text-[#8d8d8d] font-mono text-[10px] animate-pulse uppercase tracking-wider">
                Querying pct list...
              </div>
            )}

            {lxcList && lxcList.length === 0 && (
              <div className="border border-[#393939] p-10 bg-[#202020] text-center text-[#8d8d8d] font-mono text-[10px] uppercase tracking-wider">
                No LXC containers found on this ProxMox host.
              </div>
            )}

            {lxcList && lxcList.map(ct => {
              const isRunning = ct.status === 'running';
              const isExpanded = expandedCtids.has(ct.ctid);
              const dockerList = lxcDocker[ct.ctid];
              const dockerLoading = lxcDockerLoading[ct.ctid];

              return (
                <div key={ct.ctid} className="border border-[#393939] bg-[#202020] overflow-hidden">
                  {/* LXC row header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleLxcExpand(ct.ctid)}
                      className="text-[#8d8d8d] hover:text-white transition cursor-pointer shrink-0"
                    >
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />
                      }
                    </button>

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Box className="h-3.5 w-3.5 text-[#f1c21b] shrink-0" />
                      <span className="font-mono text-[12px] font-bold text-white truncate">{ct.name}</span>
                      <span className="text-[10px] text-[#6f6f6f] font-mono shrink-0">CT {ct.ctid}</span>
                    </div>

                    <span className={`flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 border ${
                      isRunning
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-[#393939]/30 text-[#8d8d8d] border-[#525252]/30'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-none ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-[#525252]'}`} />
                      {ct.status}
                    </span>

                    {!isReadOnly && (
                      <div className="flex items-center gap-1 shrink-0">
                        {isRunning ? (
                          <>
                            <button
                              disabled={!!lxcActionLoading}
                              onClick={() => triggerLxcAction(ct.ctid, 'shutdown')}
                              className="px-2 py-1 text-[9px] font-mono font-bold uppercase border border-[#ff8389]/30 text-[#ff8389] hover:bg-[#da1e28] hover:text-white transition cursor-pointer disabled:opacity-40"
                            >
                              Stop
                            </button>
                            <button
                              disabled={!!lxcActionLoading}
                              onClick={() => triggerLxcAction(ct.ctid, 'restart')}
                              className="px-2 py-1 text-[9px] font-mono font-bold uppercase border border-[#78a9ff]/30 text-[#78a9ff] hover:bg-[#0f62fe] hover:text-white transition cursor-pointer disabled:opacity-40"
                            >
                              Restart
                            </button>
                          </>
                        ) : (
                          <button
                            disabled={!!lxcActionLoading}
                            onClick={() => triggerLxcAction(ct.ctid, 'start')}
                            className="px-2 py-1 text-[9px] font-mono font-bold uppercase border border-[#42be65]/30 text-[#42be65] hover:bg-[#24a148] hover:text-white transition cursor-pointer disabled:opacity-40"
                          >
                            Start
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded: Docker containers inside this LXC */}
                  {isExpanded && (
                    <div className="border-t border-[#393939] bg-[#161616] px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-2 text-[10px] text-[#6f6f6f] font-mono uppercase tracking-wider">
                        <Container className="h-3 w-3" />
                        <span>Docker inside CT {ct.ctid} · via pct exec {ct.ctid} -- docker ps</span>
                      </div>

                      {dockerLoading && (
                        <p className="text-[10px] font-mono text-[#525252] animate-pulse py-2">Fetching docker containers...</p>
                      )}

                      {!dockerLoading && (!dockerList || dockerList.length === 0) && (
                        <p className="text-[10px] font-mono text-[#525252] py-2">
                          {isRunning ? 'No Docker containers found inside this LXC.' : 'Start the LXC to inspect Docker containers.'}
                        </p>
                      )}

                      {!dockerLoading && dockerList && dockerList.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full font-mono text-[11px] text-left">
                            <thead className="text-[10px] text-[#8d8d8d] border-b border-[#393939]">
                              <tr>
                                <th className="pb-1.5 pr-4">Name</th>
                                <th className="pb-1.5 pr-4">Image</th>
                                <th className="pb-1.5 pr-4">Status</th>
                                <th className="pb-1.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2d2d2d]">
                              {dockerList.map(c => {
                                const isUp = c.status.toLowerCase().includes('up');
                                const actKey = `docker-${ct.ctid}-${c.id}`;
                                return (
                                  <tr key={c.id}>
                                    <td className="py-2 pr-4 text-[#78a9ff] font-bold">{c.name}</td>
                                    <td className="py-2 pr-4 text-[#a8a8a8] max-w-[140px] truncate">{c.image}</td>
                                    <td className="py-2 pr-4">
                                      <span className={`text-[9px] px-1.5 py-0.5 border ${
                                        isUp ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-[#8d8d8d] border-[#525252]/30'
                                      }`}>{c.status}</span>
                                    </td>
                                    <td className="py-2 text-right">
                                      {!isReadOnly && (
                                        <div className="flex items-center justify-end gap-1">
                                          {isUp ? (
                                            <button
                                              disabled={!!lxcActionLoading}
                                              onClick={() => triggerLxcDockerAction(ct.ctid, c.id, c.name, 'stop')}
                                              className="px-2 py-0.5 text-[9px] border border-[#ff8389]/30 text-[#ff8389] hover:bg-[#da1e28] hover:text-white transition cursor-pointer disabled:opacity-40"
                                            >Stop</button>
                                          ) : (
                                            <button
                                              disabled={!!lxcActionLoading}
                                              onClick={() => triggerLxcDockerAction(ct.ctid, c.id, c.name, 'start')}
                                              className="px-2 py-0.5 text-[9px] border border-[#42be65]/30 text-[#42be65] hover:bg-[#24a148] hover:text-white transition cursor-pointer disabled:opacity-40"
                                            >Start</button>
                                          )}
                                          <button
                                            disabled={!!lxcActionLoading}
                                            onClick={() => triggerLxcDockerAction(ct.ctid, c.id, c.name, 'restart')}
                                            className="px-2 py-0.5 text-[9px] border border-[#78a9ff]/30 text-[#78a9ff] hover:bg-[#0f62fe] hover:text-white transition cursor-pointer disabled:opacity-40"
                                          >Restart</button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
