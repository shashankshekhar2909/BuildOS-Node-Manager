import React, { useState, useEffect, useCallback } from 'react';
import {
  X, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, XCircle,
  Loader2, RefreshCw, Copy, Download, Server, Folder, GitMerge
} from 'lucide-react';
import { HostMachine, DockerProject, PortMapping, MigrationPreflightResult, MigJobState } from '../types';

interface Props {
  sourceHost: HostMachine;
  allHosts: HostMachine[];
  onClose: () => void;
}

type WizardStep =
  | 'discover'
  | 'configure'
  | 'preflight'
  | 'volumes_warn'
  | 'migrating'
  | 'confirm_stop'
  | 'done';

const STEP_LABELS: Record<WizardStep, string> = {
  discover: 'Select Project',
  configure: 'Configure Target',
  preflight: 'Pre-flight Check',
  volumes_warn: 'Volume Warning',
  migrating: 'Migrating',
  confirm_stop: 'Confirm & Complete',
  done: 'Done',
};

const ORDERED_STEPS: WizardStep[] = [
  'discover', 'configure', 'preflight', 'volumes_warn', 'migrating', 'confirm_stop', 'done'
];

const DEMO_PROJECTS: DockerProject[] = [
  { name: 'web-app', path: '/home/demo/web-app', configFile: 'docker-compose.yml', status: 'running' },
  { name: 'api-service', path: '/home/demo/api-service', configFile: 'docker-compose.yml', status: 'running' },
];

const DEMO_PREFLIGHT: MigrationPreflightResult = {
  targetReachable: true,
  targetDockerVersion: '27.1.0',
  targetComposeVersion: '2.28.1',
  targetDiskFreeGB: 42.5,
  destPathExists: false,
  portMappings: [
    { service: 'web', hostPort: 3000, containerPort: 3000, protocol: 'tcp', conflictOnTarget: true, newHostPort: 3001 },
    { service: 'api', hostPort: 8080, containerPort: 8080, protocol: 'tcp', conflictOnTarget: false, newHostPort: 8080 },
  ],
  namedVolumes: [],
};

const DEMO_LOG_SEQUENCE = [
  { delay: 400,  phase: 'transferring' as const, progress: 5,  msg: 'Archiving source project (tar.gz)...' },
  { delay: 1200, phase: 'transferring' as const, progress: 25, msg: 'Archive: 84MB in 7.2s' },
  { delay: 2000, phase: 'transferring' as const, progress: 48, msg: 'Uploading to prod-node-02... (8.1s)' },
  { delay: 2800, phase: 'transferring' as const, progress: 65, msg: 'Extracted → /opt/web-app' },
  { delay: 3200, phase: 'transferring' as const, progress: 70, msg: 'Files live at: deploy@10.0.0.5:/opt/web-app' },
  { delay: 3600, phase: 'transferring' as const, progress: 73, msg: 'Dockerfile check: Patched backend/Dockerfile (missing USER)' },
  { delay: 4000, phase: 'starting'     as const, progress: 78, msg: 'Pulling images on target...' },
  { delay: 4800, phase: 'starting'     as const, progress: 83, msg: 'Running docker compose up -d...' },
  { delay: 5600, phase: 'verifying'    as const, progress: 88, msg: 'Waiting for containers to become healthy...' },
  { delay: 6400, phase: 'verifying'    as const, progress: 93, msg: '3/3 containers healthy (14.2s)' },
  { delay: 7000, phase: 'waiting_confirm' as const, progress: 100, msg: 'Source still running — awaiting your confirm.' },
];

export default function MigrateProjectModal({ sourceHost, allHosts, onClose }: Props) {
  const isDemo = sourceHost.isSimulated;
  const [step, setStep] = useState<WizardStep>('discover');

  // Discover state
  const [discovering, setDiscovering] = useState(false);
  const [discoveredProjects, setDiscoveredProjects] = useState<DockerProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<DockerProject | null>(null);
  const [manualPath, setManualPath] = useState('');
  const [useManualPath, setUseManualPath] = useState(false);

  // Configure state
  const validTargets = isDemo
    ? allHosts.filter(h => h.id !== sourceHost.id && !h.proxmox)
    : allHosts.filter(h => h.id !== sourceHost.id && !h.proxmox && !h.isSimulated);
  const [targetHost, setTargetHost] = useState<HostMachine | null>(validTargets[0] || null);
  const [destPath, setDestPath] = useState('/opt');
  const [projectName, setProjectName] = useState('');

  // Preflight state
  const [preflighting, setPreflighting] = useState(false);
  const [preflight, setPreflight] = useState<MigrationPreflightResult | null>(null);
  const [portMappings, setPortMappings] = useState<PortMapping[]>([]);

  // Volumes warning
  const [volumesAcknowledged, setVolumesAcknowledged] = useState(false);

  // Migration state
  const [jobId, setJobId] = useState<string | null>(null);
  const [finalPath, setFinalPath] = useState('');
  const [jobState, setJobState] = useState<MigJobState | null>(null);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Stop source state
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [stopOutput, setStopOutput] = useState<string | null>(null);

  // Rollback state
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackDone, setRollbackDone] = useState(false);

  const sourcePath = useManualPath
    ? manualPath.trim()
    : selectedProject?.path || '';

  const effectiveProjectName = projectName.trim() ||
    sourcePath.split('/').pop() || 'migrated-project';

  // ── Discover ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isDemo) {
      setDiscovering(true);
      setTimeout(() => { setDiscoveredProjects(DEMO_PROJECTS); setDiscovering(false); }, 800);
      return;
    }
    (async () => {
      setDiscovering(true);
      try {
        const res = await fetch('/api/migration/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host: sourceHost }),
        });
        const data = await res.json();
        setDiscoveredProjects(data.projects || []);
      } catch {}
      finally { setDiscovering(false); }
    })();
  }, [sourceHost.id]);

  // ── Job polling ────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollInterval) { clearInterval(pollInterval); setPollInterval(null); }
  }, [pollInterval]);

  useEffect(() => () => { if (pollInterval) clearInterval(pollInterval); }, [pollInterval]);

  const startPolling = useCallback((id: string) => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/migration/job/${id}`);
        if (!res.ok) return;
        const state: MigJobState = await res.json();
        setJobState(state);
        if (state.phase === 'waiting_confirm' || state.phase === 'error') {
          clearInterval(iv);
          setPollInterval(null);
          if (state.phase === 'waiting_confirm') setStep('confirm_stop');
        }
      } catch {}
    }, 2000);
    setPollInterval(iv);
  }, []);

  // ── Preflight ──────────────────────────────────────────────────────────────
  const suggestUniqueName = () => {
    const base = effectiveProjectName.replace(/-\d{8}$/, '');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    setProjectName(`${base}-${date}`);
  };

  const runPreflight = async () => {
    if (!targetHost) return;
    setPreflighting(true);
    setPreflight(null);
    if (isDemo) {
      setTimeout(() => {
        setPreflight(DEMO_PREFLIGHT);
        setPortMappings(DEMO_PREFLIGHT.portMappings);
        setStep('preflight');
        setPreflighting(false);
      }, 1200);
      return;
    }
    try {
      const res = await fetch('/api/migration/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceHost, targetHost, sourcePath,
          destPath: destPath.trim() || '/opt',
          projectName: effectiveProjectName,
        }),
      });
      const data: MigrationPreflightResult = await res.json();
      setPreflight(data);
      setPortMappings(data.portMappings || []);
      setStep('preflight');
    } catch (e: any) {
      setPreflight({ targetReachable: false, error: e.message, targetDockerVersion: null, targetComposeVersion: null, targetDiskFreeGB: null, destPathExists: false, portMappings: [], namedVolumes: [] });
      setStep('preflight');
    } finally {
      setPreflighting(false);
    }
  };

  // ── Start migration ────────────────────────────────────────────────────────
  const startMigration = async () => {
    if (!targetHost) return;
    setStep('migrating');
    setJobState(null);

    if (isDemo) {
      const demoPath = `/opt/${effectiveProjectName}`;
      setFinalPath(demoPath);
      const ts = () => new Date().toISOString().slice(11, 19);
      let log: string[] = [`[${ts()}] Demo migration started`];
      setJobState({ phase: 'transferring', progress: 0, totalFiles: 0, transferredFiles: 0, log });
      DEMO_LOG_SEQUENCE.forEach(({ delay, phase, progress, msg }) => {
        setTimeout(() => {
          log = [...log, `[${ts()}] ${msg}`];
          const nextState: MigJobState = { phase, progress, totalFiles: 0, transferredFiles: 0, log };
          if (phase === 'waiting_confirm') {
            nextState.targetContainers = [
              { name: `${effectiveProjectName}_web_1`, status: 'Up', ports: `0.0.0.0:3001->3000/tcp` },
              { name: `${effectiveProjectName}_api_1`, status: 'Up', ports: `0.0.0.0:8080->8080/tcp` },
              { name: `${effectiveProjectName}_db_1`,  status: 'Up', ports: '5432/tcp' },
            ];
            setStep('confirm_stop');
          }
          setJobState(nextState);
        }, delay);
      });
      return;
    }

    try {
      const res = await fetch('/api/migration/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceHost, targetHost, sourcePath,
          destPath: destPath.trim() || '/opt',
          projectName: effectiveProjectName,
          portOverrides: portMappings.map(pm => ({
            service: pm.service,
            hostPort: pm.hostPort,
            containerPort: pm.containerPort,
            newHostPort: pm.newHostPort,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      setJobId(data.jobId);
      setFinalPath(data.finalPath);
      setJobState({ phase: 'transferring', progress: 0, totalFiles: 0, transferredFiles: 0, log: ['Starting...'] });
      startPolling(data.jobId);
    } catch (e: any) {
      setJobState({ phase: 'error', progress: 0, totalFiles: 0, transferredFiles: 0, log: [], error: e.message });
    }
  };

  // ── Rollback target (stop + rm folder, source keeps running) ──────────────
  const rollbackTarget = async () => {
    if (isDemo) { setRollingBack(true); setTimeout(() => { setRollingBack(false); setRollbackDone(true); }, 1000); return; }
    if (!jobId) return;
    setRollingBack(true);
    try {
      const res = await fetch(`/api/migration/rollback/${jobId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRollbackDone(true);
      stopPolling();
    } catch (e: any) {
      alert(`Rollback error: ${e.message}`);
    } finally {
      setRollingBack(false);
    }
  };

  // ── Stop source ────────────────────────────────────────────────────────────
  const stopSource = async () => {
    if (isDemo) { setStopping(true); setTimeout(() => { setStopping(false); setStopOutput('Stopped (demo).'); setStep('done'); }, 1000); return; }
    setStopping(true);
    setStopError(null);
    try {
      const res = await fetch('/api/migration/stop-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceHost, sourcePath, jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStopOutput(data.output || 'Stopped.');
      setStep('done');
    } catch (e: any) {
      setStopError(e.message);
    } finally {
      setStopping(false);
    }
  };

  // ── Derived port data for DNS card ─────────────────────────────────────────
  const finalPortMappings = portMappings.length > 0 ? portMappings : [];

  const copyText = (t: string) => navigator.clipboard.writeText(t).catch(() => {});

  const downloadSummary = () => {
    const lines = [
      'BuildOS Migration Summary',
      '=========================',
      `Date: ${new Date().toISOString()}`,
      `Source: ${sourceHost.name} (${sourceHost.ip}) — ${sourcePath}`,
      `Target: ${targetHost?.name} (${targetHost?.ip}) — ${finalPath}`,
      '',
      'Services & Ports:',
      ...(finalPortMappings.length > 0
        ? finalPortMappings.map(pm => `  ${pm.service}: ${targetHost?.ip}:${pm.newHostPort} → container :${pm.containerPort}`)
        : (jobState?.targetContainers || []).map(c => `  ${c.name}: ${c.ports} (${c.status})`)
      ),
      '',
      'DNS Records to Update:',
      `  A record → ${targetHost?.ip}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'migration-summary.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const stepIndex = ORDERED_STEPS.indexOf(step);

  const Pill = ({ label, done, active }: { label: string; done: boolean; active: boolean }) => (
    <div className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 border ${
      done ? 'bg-[#0f2d14] text-[#42be65] border-[#24a148]/30'
        : active ? 'bg-[#0f2040] text-[#78a9ff] border-[#0f62fe]/30'
        : 'bg-[#1e1e1e] text-[#525252] border-[#393939]'
    }`}>
      {done && <CheckCircle2 className="h-2.5 w-2.5" />}
      <span>{label}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm font-sans">
      <div id="migrate-project-modal-container"
        className="bg-[#161616] border border-[#393939] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#393939] bg-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-2.5">
            <GitMerge className="h-4 w-4 text-[#4589ff]" />
            <span className="text-[13px] font-semibold text-white">Migrate Docker Project</span>
            <span className="text-[10px] text-[#6f6f6f] font-mono">
              {sourceHost.name} [{sourceHost.ip}]
            </span>
          </div>
          <button onClick={onClose} className="text-[#6f6f6f] hover:text-white transition cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step pills */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-[#2d2d2d] bg-[#1a1a1a] shrink-0 flex-wrap">
          {ORDERED_STEPS.filter(s => s !== 'volumes_warn').map((s, i) => {
            const visIdx = ORDERED_STEPS.filter(x => x !== 'volumes_warn').indexOf(s);
            return (
              <React.Fragment key={s}>
                <Pill label={STEP_LABELS[s]} done={stepIndex > ORDERED_STEPS.indexOf(s)} active={step === s} />
                {visIdx < 5 && <span className="text-[#393939] text-[10px]">›</span>}
              </React.Fragment>
            );
          })}
        </div>

        {/* Demo banner */}
        {isDemo && (
          <div className="flex items-center gap-2 px-5 py-2 bg-[#f1c21b]/8 border-b border-[#f1c21b]/20 shrink-0">
            <span className="font-mono text-[9px] px-1.5 py-0.5 bg-[#f1c21b]/15 text-[#f1c21b] border border-[#f1c21b]/30 uppercase tracking-wider font-bold">Demo</span>
            <span className="text-[11px] text-[#a8a8a8]">Sandbox mode — simulated data, no real SSH connections made.</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── STEP: discover ── */}
          {step === 'discover' && (
            <div className="space-y-4">
              <p className="text-[11px] text-[#8d8d8d]">
                Choose a docker-compose project on <span className="text-white font-mono">{sourceHost.name}</span> to migrate.
              </p>

              {discovering && (
                <div className="flex items-center gap-2 text-[11px] text-[#6f6f6f] animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning for docker-compose projects...
                </div>
              )}

              {!discovering && discoveredProjects.length > 0 && !useManualPath && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-[#6f6f6f] uppercase tracking-wide">Found Projects</p>
                  {discoveredProjects.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedProject(p)}
                      className={`w-full text-left px-3 py-2.5 border transition cursor-pointer ${
                        selectedProject?.path === p.path
                          ? 'border-[#0f62fe] bg-[#0f62fe]/10 text-white'
                          : 'border-[#393939] bg-[#1e1e1e] text-[#c6c6c6] hover:border-[#525252]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="h-3.5 w-3.5 text-[#f1c21b] shrink-0" />
                        <span className="font-mono text-[12px] font-bold truncate">{p.name}</span>
                        <span className={`ml-auto text-[9px] px-1.5 py-0.5 border shrink-0 ${
                          p.status.includes('running')
                            ? 'text-[#42be65] border-[#24a148]/30 bg-[#0f2d14]'
                            : 'text-[#6f6f6f] border-[#393939]'
                        }`}>{p.status}</span>
                      </div>
                      <p className="text-[10px] text-[#6f6f6f] font-mono mt-0.5 ml-5.5 truncate">{p.path}</p>
                    </button>
                  ))}
                </div>
              )}

              {!discovering && discoveredProjects.length === 0 && !useManualPath && (
                <p className="text-[11px] text-[#8d8d8d]">No projects auto-detected. Enter path manually below.</p>
              )}

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-[#a8a8a8] mb-2">
                  <input type="checkbox" checked={useManualPath} onChange={e => setUseManualPath(e.target.checked)}
                    className="accent-[#0f62fe]" />
                  Enter project path manually
                </label>
                {useManualPath && (
                  <input
                    value={manualPath}
                    onChange={e => setManualPath(e.target.value)}
                    placeholder="/opt/myapp"
                    className="w-full bg-[#262626] border border-[#393939] focus:border-[#0f62fe] px-3 py-2 text-[12px] font-mono text-white outline-none"
                  />
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  disabled={!sourcePath}
                  onClick={() => setStep('configure')}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0f62fe] hover:bg-[#0353e9] text-white text-[12px] font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: configure ── */}
          {step === 'configure' && (
            <div className="space-y-4">
              <div className="bg-[#1e1e1e] border border-[#393939] px-3 py-2.5 text-[11px] font-mono text-[#a8a8a8]">
                Source: <span className="text-white">{sourceHost.name}</span> → <span className="text-[#78a9ff]">{sourcePath}</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-[#6f6f6f] uppercase tracking-wide block mb-1.5">Target Node</label>
                  {validTargets.length === 0 ? (
                    <p className="text-[11px] text-[#ff8389]">No eligible non-proxmox physical nodes available.</p>
                  ) : (
                    <select
                      value={targetHost?.id || ''}
                      onChange={e => setTargetHost(validTargets.find(h => h.id === e.target.value) || null)}
                      className="w-full bg-[#262626] border border-[#393939] focus:border-[#0f62fe] text-white text-[12px] px-3 py-2 outline-none cursor-pointer"
                    >
                      {validTargets.map(h => (
                        <option key={h.id} value={h.id}>{h.name} [{h.ip}]</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-[10px] text-[#6f6f6f] uppercase tracking-wide block mb-1.5">
                    Destination Parent Directory <span className="text-[#525252] normal-case">(project folder created inside)</span>
                  </label>
                  <input
                    value={destPath}
                    onChange={e => setDestPath(e.target.value)}
                    placeholder="/opt"
                    className="w-full bg-[#262626] border border-[#393939] focus:border-[#0f62fe] px-3 py-2 text-[12px] font-mono text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#6f6f6f] uppercase tracking-wide block mb-1.5">
                    Project Folder Name <span className="text-[#525252] normal-case">(default: source folder name)</span>
                  </label>
                  <input
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder={sourcePath.split('/').pop() || 'myapp'}
                    className="w-full bg-[#262626] border border-[#393939] focus:border-[#0f62fe] px-3 py-2 text-[12px] font-mono text-white outline-none"
                  />
                  <p className="text-[10px] text-[#525252] mt-1">
                    Final path on target: <span className="text-[#a8a8a8] font-mono">{destPath}/{effectiveProjectName}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setStep('discover')} className="flex items-center gap-1.5 px-3 py-2 border border-[#393939] text-[#a8a8a8] hover:text-white text-[12px] transition cursor-pointer">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  disabled={!targetHost || !destPath.trim() || preflighting}
                  onClick={runPreflight}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0f62fe] hover:bg-[#0353e9] text-white text-[12px] font-medium transition cursor-pointer disabled:opacity-40"
                >
                  {preflighting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking...</> : <>Run Pre-flight <ArrowRight className="h-3.5 w-3.5" /></>}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: preflight ── */}
          {step === 'preflight' && preflight && (
            <div className="space-y-4">
              {/* Check results */}
              <div className="space-y-2">
                {[
                  {
                    ok: preflight.targetReachable,
                    label: 'Target SSH reachable',
                    detail: preflight.targetDockerVersion || undefined,
                  },
                  {
                    ok: !!preflight.targetComposeVersion,
                    label: 'Docker Compose available',
                    detail: preflight.targetComposeVersion || 'Not detected',
                  },
                  {
                    ok: (preflight.targetDiskFreeGB || 0) > 1,
                    label: 'Disk space on target',
                    detail: preflight.targetDiskFreeGB != null ? `${preflight.targetDiskFreeGB}GB free` : 'Unknown',
                  },
                  {
                    ok: !preflight.destPathExists,
                    warn: preflight.destPathExists,
                    label: 'Destination path',
                    detail: preflight.destPathExists
                      ? `${destPath}/${effectiveProjectName} already exists on target`
                      : `${destPath}/${effectiveProjectName} is clear`,
                  },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-3 py-2 bg-[#1e1e1e] border border-[#2d2d2d]">
                    {row.ok && !row.warn
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-[#42be65] shrink-0 mt-0.5" />
                      : row.warn
                      ? <AlertTriangle className="h-3.5 w-3.5 text-[#f1c21b] shrink-0 mt-0.5" />
                      : <XCircle className="h-3.5 w-3.5 text-[#ff8389] shrink-0 mt-0.5" />
                    }
                    <div>
                      <span className="text-[12px] text-white">{row.label}</span>
                      {row.detail && <p className="text-[10px] text-[#6f6f6f] font-mono mt-0.5">{row.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Unique name fix */}
              {preflight.destPathExists && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-[#f1c21b]/5 border border-[#f1c21b]/25">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#f1c21b] shrink-0" />
                  <span className="text-[11px] text-[#a89240] flex-1">
                    Folder already exists on target — migration will overwrite it, or use a unique name.
                  </span>
                  <button
                    onClick={suggestUniqueName}
                    className="shrink-0 px-2.5 py-1 border border-[#f1c21b]/40 text-[#f1c21b] hover:bg-[#f1c21b]/10 text-[10px] font-mono transition cursor-pointer"
                  >
                    Use unique name
                  </button>
                </div>
              )}

              {/* Port conflict remapping */}
              {portMappings.length > 0 && (
                <div>
                  <p className="text-[10px] text-[#6f6f6f] uppercase tracking-wide mb-2">Port Mappings</p>
                  <div className="border border-[#393939] overflow-hidden">
                    <table className="w-full text-[11px] font-mono">
                      <thead className="bg-[#202020] text-[#8d8d8d] text-[10px]">
                        <tr>
                          <th className="px-3 py-2 text-left">Service</th>
                          <th className="px-3 py-2 text-left">Original</th>
                          <th className="px-3 py-2 text-left">New Host Port</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2d2d2d] bg-[#161616]">
                        {portMappings.map((pm, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-[#78a9ff] font-bold">{pm.service}</td>
                            <td className="px-3 py-2 text-[#a8a8a8]">:{pm.hostPort} → :{pm.containerPort}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={pm.newHostPort}
                                onChange={e => {
                                  const v = parseInt(e.target.value);
                                  setPortMappings(prev => prev.map((p, j) => j === i ? { ...p, newHostPort: isNaN(v) ? p.hostPort : v } : p));
                                }}
                                className="w-20 bg-[#262626] border border-[#393939] focus:border-[#0f62fe] px-2 py-0.5 text-white outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              {pm.conflictOnTarget && pm.newHostPort === pm.hostPort
                                ? <span className="text-[#ff8389] text-[9px]">⚠ Port in use</span>
                                : pm.newHostPort !== pm.hostPort
                                ? <span className="text-[#f1c21b] text-[9px]">Remapped</span>
                                : <span className="text-[#42be65] text-[9px]">✓ Free</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-[#525252] mt-1">Edit "New Host Port" to resolve conflicts. Override file is auto-generated.</p>
                </div>
              )}

              {/* Named volumes notice */}
              {preflight.namedVolumes.length > 0 && (
                <div className="flex items-start gap-2.5 p-3 bg-[#f1c21b]/8 border border-[#f1c21b]/30">
                  <AlertTriangle className="h-4 w-4 text-[#f1c21b] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] text-[#fcd34d] font-semibold">Named volumes detected</p>
                    <p className="text-[11px] text-[#a89240] mt-0.5">
                      {preflight.namedVolumes.join(', ')} — data in these volumes will <strong>not</strong> transfer.
                    </p>
                  </div>
                </div>
              )}

              {preflight.error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-[#ff8389] text-[11px] font-mono">
                  <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{preflight.error}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setStep('configure')} className="flex items-center gap-1.5 px-3 py-2 border border-[#393939] text-[#a8a8a8] hover:text-white text-[12px] transition cursor-pointer">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={runPreflight} disabled={preflighting} className="flex items-center gap-1.5 px-3 py-2 border border-[#393939] text-[#a8a8a8] hover:text-white text-[11px] transition cursor-pointer disabled:opacity-40">
                    <RefreshCw className={`h-3 w-3 ${preflighting ? 'animate-spin' : ''}`} /> Re-check
                  </button>
                  <button
                    disabled={!preflight.targetReachable || portMappings.some(pm => pm.conflictOnTarget && pm.newHostPort === pm.hostPort)}
                    onClick={() => {
                      if (preflight.namedVolumes.length > 0) setStep('volumes_warn');
                      else startMigration();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0f62fe] hover:bg-[#0353e9] text-white text-[12px] font-medium transition cursor-pointer disabled:opacity-40"
                  >
                    Continue <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: volumes_warn ── */}
          {step === 'volumes_warn' && preflight && (
            <div className="space-y-4">
              <div className="p-4 bg-[#f1c21b]/8 border border-[#f1c21b]/40 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-[#f1c21b]" />
                  <span className="text-[14px] font-semibold text-[#fcd34d]">Named volumes will NOT be transferred</span>
                </div>
                <p className="text-[12px] text-[#a89240] leading-relaxed">
                  The following Docker named volumes contain data (databases, user uploads, etc.) that lives outside
                  the project folder. SCP/SFTP only copies files — volume data stays on the source node.
                </p>
                <div className="space-y-1">
                  {preflight.namedVolumes.map(v => (
                    <div key={v} className="flex items-center gap-2 text-[11px] font-mono text-[#f1c21b]">
                      <span className="h-1.5 w-1.5 bg-[#f1c21b] shrink-0" />
                      {v}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-[#a89240]">
                  Target containers will start with <strong>empty volumes</strong>. Migrate data separately
                  (pg_dump, mysqldump, rsync /var/lib/docker/volumes, etc.) if needed.
                </p>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={volumesAcknowledged}
                  onChange={e => setVolumesAcknowledged(e.target.checked)}
                  className="accent-[#f1c21b] mt-0.5"
                />
                <span className="text-[12px] text-[#c6c6c6]">
                  I understand — named volume data stays on source. Target starts with empty volumes.
                </span>
              </label>

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setStep('preflight')} className="flex items-center gap-1.5 px-3 py-2 border border-[#393939] text-[#a8a8a8] hover:text-white text-[12px] transition cursor-pointer">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  disabled={!volumesAcknowledged}
                  onClick={startMigration}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0f62fe] hover:bg-[#0353e9] text-white text-[12px] font-medium transition cursor-pointer disabled:opacity-40"
                >
                  Start Migration <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: migrating ── */}
          {step === 'migrating' && (
            <div className="space-y-4">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#8d8d8d] mb-1.5">
                  <span className="capitalize font-mono">{jobState?.phase?.replace('_', ' ') || 'starting'}</span>
                  <span className="font-mono">{jobState?.progress || 0}%</span>
                </div>
                <div className="h-2 bg-[#262626] border border-[#393939]">
                  <div
                    className="h-full bg-[#0f62fe] transition-all duration-500"
                    style={{ width: `${jobState?.progress || 0}%` }}
                  />
                </div>
                {(jobState?.totalFiles || 0) > 0 && (
                  <p className="text-[10px] text-[#525252] font-mono mt-1">
                    {jobState?.transferredFiles}/{jobState?.totalFiles} files
                  </p>
                )}
              </div>

              {/* Log */}
              <div className="bg-[#0d0d0d] border border-[#2d2d2d] p-3 h-48 overflow-y-auto font-mono text-[11px] space-y-0.5">
                {(jobState?.log || []).map((line, i) => (
                  <div key={i} className={line.startsWith('ERROR') ? 'text-[#ff8389]' : 'text-[#a8a8a8]'}>
                    <span className="text-[#525252] mr-2">{String(i + 1).padStart(2, '0')}</span>{line}
                  </div>
                ))}
                {jobState?.phase !== 'error' && jobState?.phase !== 'waiting_confirm' && (
                  <div className="flex items-center gap-1.5 text-[#525252] animate-pulse pt-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> working...
                  </div>
                )}
              </div>

              {jobState?.phase === 'error' && (
                <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-[#ff8389] text-[11px] font-mono">
                  <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Migration failed — auto-rollback ran</p>
                    <p>{jobState.error}</p>
                    <p className="text-[#42be65] font-sans">✓ Source still running. Target cleaned up. Nothing lost.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: confirm_stop ── */}
          {step === 'confirm_stop' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 p-3 bg-[#0f2d14] border border-[#24a148]/30">
                <CheckCircle2 className="h-4 w-4 text-[#42be65] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-semibold text-[#42be65]">Target containers verified running</p>
                  <p className="text-[10px] text-[#6f6f6f] mt-0.5 font-mono">{targetHost?.name} [{targetHost?.ip}] — {finalPath}</p>
                </div>
              </div>

              {/* Container table */}
              {(jobState?.targetContainers || []).length > 0 && (
                <div className="border border-[#393939] overflow-hidden">
                  <table className="w-full text-[11px] font-mono">
                    <thead className="bg-[#202020] text-[#8d8d8d] text-[10px]">
                      <tr>
                        <th className="px-3 py-2 text-left">Container</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Ports</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d2d2d] bg-[#161616]">
                      {(jobState?.targetContainers || []).map((c, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-[#78a9ff] font-bold">{c.name}</td>
                          <td className="px-3 py-2">
                            <span className={`text-[9px] px-1.5 py-0.5 border ${
                              c.status.toLowerCase().includes('up') || c.status.toLowerCase().includes('running')
                                ? 'text-[#42be65] border-[#24a148]/30 bg-[#0f2d14]'
                                : 'text-[#f1c21b] border-[#f1c21b]/30'
                            }`}>{c.status}</span>
                          </td>
                          <td className="px-3 py-2 text-[#a8a8a8] truncate max-w-[200px]">{c.ports || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {rollbackDone ? (
                <div className="flex items-start gap-2.5 p-3 bg-[#0f2d14] border border-[#24a148]/30">
                  <CheckCircle2 className="h-4 w-4 text-[#42be65] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-semibold text-[#42be65]">Rollback complete</p>
                    <p className="text-[11px] text-[#6f6f6f] mt-0.5">Target cleaned. Source is still running — nothing lost.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-[#da1e28]/8 border border-[#da1e28]/30">
                    <p className="text-[12px] font-semibold text-[#ff8389] mb-1">Stop source containers</p>
                    <p className="text-[11px] text-[#a8a8a8]">
                      Runs <span className="font-mono text-white">docker compose down</span> on{' '}
                      <span className="font-mono text-white">{sourceHost.name}</span> at{' '}
                      <span className="font-mono text-white">{sourcePath}</span>.{' '}
                      Source stays running until you click this.
                    </p>
                  </div>

                  {stopError && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-[#ff8389] text-[11px] font-mono">
                      <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Stop failed: {stopError} — use SSH console to stop manually.</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <button
                      disabled={rollingBack || stopping}
                      onClick={rollbackTarget}
                      className="flex items-center gap-1.5 px-3 py-2 border border-[#393939] hover:border-[#f1c21b]/40 text-[#6f6f6f] hover:text-[#f1c21b] text-[11px] transition cursor-pointer disabled:opacity-40"
                    >
                      {rollingBack
                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Rolling back...</>
                        : <>↩ Cancel &amp; Rollback Target</>
                      }
                    </button>
                    <button
                      disabled={stopping || rollingBack}
                      onClick={stopSource}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#da1e28] hover:bg-[#b81921] text-white text-[12px] font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      {stopping
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Stopping...</>
                        : <>Stop Source &amp; Complete Migration</>
                      }
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-[#0f2d14] border border-[#24a148]/40">
                <CheckCircle2 className="h-6 w-6 text-[#42be65] shrink-0" />
                <div>
                  <p className="text-[14px] font-bold text-[#42be65]">Migration Complete</p>
                  <p className="text-[11px] text-[#6f6f6f] font-mono mt-0.5">{finalPath}</p>
                </div>
              </div>

              {/* DNS summary card */}
              <div className="bg-[#1e1e1e] border border-[#393939] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#393939] bg-[#262626]">
                  <Server className="h-3.5 w-3.5 text-[#4589ff]" />
                  <span className="text-[12px] font-semibold text-white">Update DNS Records</span>
                </div>
                <div className="p-4 space-y-3">

                  {/* Target IP */}
                  <div className="flex items-center justify-between bg-[#161616] border border-[#2d2d2d] px-3 py-2.5">
                    <div>
                      <p className="text-[10px] text-[#6f6f6f] uppercase tracking-wide">Target Node IP</p>
                      <p className="text-[14px] font-mono font-bold text-white mt-0.5">{targetHost?.ip}</p>
                    </div>
                    <button onClick={() => copyText(targetHost?.ip || '')}
                      className="flex items-center gap-1.5 text-[11px] text-[#6f6f6f] hover:text-white transition cursor-pointer px-2 py-1 border border-[#393939] hover:border-[#525252]">
                      <Copy className="h-3 w-3" /> Copy IP
                    </button>
                  </div>

                  {/* Services table */}
                  {(finalPortMappings.length > 0 || (jobState?.targetContainers || []).length > 0) && (
                    <div className="border border-[#2d2d2d] overflow-hidden">
                      <table className="w-full text-[11px] font-mono">
                        <thead className="bg-[#202020] text-[#8d8d8d] text-[10px]">
                          <tr>
                            <th className="px-3 py-2 text-left">Service</th>
                            <th className="px-3 py-2 text-left">Host Port</th>
                            <th className="px-3 py-2 text-left">Endpoint</th>
                            <th className="px-3 py-2 text-right">Copy</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2d2d2d] bg-[#161616]">
                          {finalPortMappings.length > 0
                            ? finalPortMappings.map((pm, i) => (
                              <tr key={i}>
                                <td className="px-3 py-2 text-[#78a9ff] font-bold">{pm.service}</td>
                                <td className="px-3 py-2 text-[#a8a8a8]">:{pm.newHostPort}</td>
                                <td className="px-3 py-2 text-white">{targetHost?.ip}:{pm.newHostPort}</td>
                                <td className="px-3 py-2 text-right">
                                  <button onClick={() => copyText(`${targetHost?.ip}:${pm.newHostPort}`)}
                                    className="text-[#6f6f6f] hover:text-white cursor-pointer transition">
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </td>
                              </tr>
                            ))
                            : (jobState?.targetContainers || []).map((c, i) => (
                              <tr key={i}>
                                <td className="px-3 py-2 text-[#78a9ff] font-bold">{c.name}</td>
                                <td className="px-3 py-2 text-[#a8a8a8]">{c.ports || '—'}</td>
                                <td className="px-3 py-2 text-white">{c.ports ? `${targetHost?.ip}` : '—'}</td>
                                <td className="px-3 py-2 text-right">
                                  <button onClick={() => copyText(targetHost?.ip || '')}
                                    className="text-[#6f6f6f] hover:text-white cursor-pointer transition">
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="text-[10px] text-[#525252]">
                    Point all A records to <span className="text-[#a8a8a8] font-mono">{targetHost?.ip}</span>.
                    Update ports in any reverse proxy config (nginx, Caddy, Traefik).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={downloadSummary}
                  className="flex items-center gap-2 px-3 py-2 border border-[#393939] text-[#a8a8a8] hover:text-white text-[11px] transition cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Download Summary
                </button>
                <button onClick={onClose} className="px-4 py-2 bg-[#262626] hover:bg-[#393939] border border-[#393939] text-white text-[12px] transition cursor-pointer">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
