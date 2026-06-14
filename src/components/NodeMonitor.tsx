import React, { useState, useEffect } from 'react';
import { 
  Activity, Play, Square, RotateCw, Layers, Shield, 
  Cpu, HardDrive, RefreshCw, AlertCircle, CheckCircle2, XCircle, Clock
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
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'docker' | 'services'>('status');

  const isReadOnly = currentUserRole === 'viewer';

  const fetchDetails = async (showLoading = false) => {
    if (!host) return;
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch(`/api/hosts/${host.id}/details`);
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
        body: JSON.stringify({ serviceName, actionName })
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
          <div className="p-2.5 bg-[#0f62fe]/10 border border-[#0f62fe] text-white rounded-none">
            <Activity className="h-4.5 w-4.5 animate-pulse text-[#78a9ff]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white text-sm tracking-tight">{host.name}</h2>
              <span className={`text-[9px] font-bold font-mono uppercase px-2 py-0.5 border ${
                host.isSimulated 
                  ? 'bg-[#0f62fe]/10 text-[#78a9ff] border-[#0f62fe]/35' 
                  : 'bg-[#24a148]/10 text-[#42be65] border-[#24a148]/35'
              }`}>
                {host.isSimulated ? 'VIRTUAL MOCK' : 'LIVE HOST'}
              </span>
            </div>
            <p className="text-[10px] text-[#a8a8a8] font-mono tracking-wider mt-1 uppercase">
              {host.username}@{host.ip}:{host.port} 
              {data?.uptime && <span className="text-[#8d8d8d] ml-2">| UP: {data.uptime.replace('up', '').trim()}</span>}
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
      <div className="flex border-b border-[#393939] bg-[#202020] px-4">
        <button
          onClick={() => setActiveSubTab('status')}
          className={`py-3 px-4 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeSubTab === 'status'
              ? 'border-[#0f62fe] text-[#78a9ff]'
              : 'border-transparent text-[#a8a8a8] hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>Telemetry History</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab('docker')}
          className={`py-3 px-4 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition-all relative ${
            activeSubTab === 'docker'
              ? 'border-[#0f62fe] text-[#78a9ff]'
              : 'border-transparent text-[#a8a8a8] hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            <span>Docker Containers ({data?.docker?.length || 0})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab('services')}
          className={`py-3 px-4 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeSubTab === 'services'
              ? 'border-[#0f62fe] text-[#78a9ff]'
              : 'border-transparent text-[#a8a8a8] hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" />
            <span>System Services ({data?.services?.length || 0})</span>
          </div>
        </button>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CPU Meter */}
              <div className="bg-[#202020] border border-[#393939] p-4 text-left">
                <span className="text-[10px] font-mono font-bold text-[#8d8d8d] uppercase tracking-wider flex items-center gap-1.5 mb-1 bg-[#161616] p-1.5 border border-[#393939]">
                  <Cpu className="h-3.5 w-3.5 text-[#78a9ff]" />
                  <span>Real-time CPU Usage</span>
                </span>
                <div className="mt-3 flex items-baseline justify-between">
                  <h3 className="text-3xl font-bold font-mono text-[#f4f4f4] tracking-tight">{data?.cpu ?? host.simulatedStats?.cpu ?? 0}%</h3>
                  <span className="text-[10px] text-[#8d8d8d] font-mono leading-none">Cores: Dynamic Allocation</span>
                </div>
              </div>

              {/* RAM Meter */}
              <div className="bg-[#202020] border border-[#393939] p-4 text-left">
                <span className="text-[10px] font-mono font-bold text-[#8d8d8d] uppercase tracking-wider flex items-center gap-1.5 mb-1 bg-[#161616] p-1.5 border border-[#393939]">
                  <Activity className="h-3.5 w-3.5 text-[#78a9ff]" />
                  <span>Real-time RAM Usage</span>
                </span>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <h3 className="text-3xl font-bold font-mono text-[#f4f4f4] tracking-tight">
                      {data?.ram ? `${data.ram.percent}%` : host.simulatedStats ? `${Math.round((host.simulatedStats.ram / (host.id === 'host-sim3' ? 16 : host.id === 'host-sim2' ? 8 : 4)) * 100)}%` : '0%'}
                    </h3>
                    <p className="text-[10px] text-[#8d8d8d] font-mono mt-1">
                      {data?.ram ? `${data.ram.used} GB / ${data.ram.total} GB` : `~${host.simulatedStats?.ram || 0} GB used`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Disk Meter */}
              <div className="bg-[#202020] border border-[#393939] p-4 text-left">
                <span className="text-[10px] font-mono font-bold text-[#8d8d8d] uppercase tracking-wider flex items-center gap-1.5 mb-1 bg-[#161616] p-1.5 border border-[#393939]">
                  <HardDrive className="h-3.5 w-3.5 text-[#78a9ff]" />
                  <span>Persistent Storage</span>
                </span>
                <div className="mt-3 flex items-baseline justify-between">
                  <h3 className="text-3xl font-bold font-mono text-[#f4f4f4] tracking-tight">{data?.disk ?? host.simulatedStats?.disk ?? 0}%</h3>
                  <span className="text-[10px] text-[#8d8d8d] font-mono leading-none">Mount: Root (/)</span>
                </div>
              </div>
            </div>

            {/* Recharts Live Chart Canvas */}
            <div className="bg-[#202020] border border-[#393939] p-4">
              <div className="flex items-center justify-between border-b border-[#393939] pb-3 mb-4 font-mono text-[10px] text-[#8d8d8d]">
                <span className="font-bold uppercase tracking-wider text-[#78a9ff]">Live Performance Analytics Graph (5s interval)</span>
                <span>Y-Axis: Utilization %</span>
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
                                  onClick={() => triggerDockerAction(c.id, c.name, 'stop')}
                                  title="Stop Running Container"
                                  className="p-1 px-2 bg-[#ff8389]/10 hover:bg-[#da1e28] hover:text-white border border-[#ff8389]/30 text-[#ff8389] rounded-none text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center gap-1 disabled:opacity-40"
                                >
                                  <Square className="h-2.5 w-2.5" />
                                  <span>Stop</span>
                                </button>
                              ) : (
                                <button
                                  disabled={isReadOnly || !!actionLoading}
                                  onClick={() => triggerDockerAction(c.id, c.name, 'start')}
                                  title="Start Exited Container"
                                  className="p-1 px-2 bg-[#42be65]/10 hover:bg-[#24a148] hover:text-white border border-[#42be65]/35 text-[#42be65] rounded-none text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center gap-1 disabled:opacity-40"
                                >
                                  <Play className="h-2.5 w-2.5" />
                                  <span>Start</span>
                                </button>
                              )}
                              <button
                                disabled={isReadOnly || !!actionLoading}
                                onClick={() => triggerDockerAction(c.id, c.name, 'restart')}
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
      </div>
    </div>
  );
}
