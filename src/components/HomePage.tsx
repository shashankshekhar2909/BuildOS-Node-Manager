import React from 'react';
import { motion } from 'motion/react';
import {
  Server,
  Cpu,
  Bot,
  Box,
  Mic,
  Users,
  Lock,
  Zap,
  Terminal,
  GitBranch,
  Globe,
  ShieldCheck,
  Github,
  Shield,
  Infinity,
  Container,
  ArrowRightLeft,
} from 'lucide-react';

interface HomePageProps {
  onSignIn: () => void;
  onSandbox: () => void;
}

/* ── Feature grid data ── */
const features = [
  {
    icon: Server,
    title: 'SSH Fleet Command',
    description: 'Connect unlimited remote Linux servers. Real-time host health, port status, and uptime at a glance.',
    detail: 'Uses the ssh2 Node.js library for real SSH tunnel streams. Credentials stored AES-256-CBC encrypted. Hosts persisted in Firestore for cross-device access.',
    color: '#0f62fe', bg: 'rgba(15,98,254,0.10)', border: 'rgba(15,98,254,0.28)', glow: 'rgba(15,98,254,0.18)', iconBg: 'rgba(15,98,254,0.15)',
  },
  {
    icon: Cpu,
    title: 'Live Telemetry',
    description: 'CPU, RAM, and disk polled every 30s for physical hosts. Persistent historical charts per node.',
    detail: 'Runs top, free, df, ss over SSH on each physical host. Results written back to host state and rendered with Recharts sparklines in the Node Monitor.',
    color: '#24a148', bg: 'rgba(36,161,72,0.10)', border: 'rgba(36,161,72,0.28)', glow: 'rgba(36,161,72,0.18)', iconBg: 'rgba(36,161,72,0.15)',
  },
  {
    icon: Bot,
    title: 'AI ReAct Agent',
    description: 'Ask natural-language questions. The agent translates intent to SSH commands, executes, and explains results.',
    detail: 'Implements a ReAct loop with Gemini 2.0 Flash or Groq. LLM outputs JSON {action, command}, server executes via SSH, feeds output back — repeats until final answer.',
    color: '#6366f1', bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.28)', glow: 'rgba(99,102,241,0.22)', iconBg: 'rgba(99,102,241,0.15)',
  },
  {
    icon: Terminal,
    title: 'Docker Management',
    description: 'List, start, stop, and restart containers per host. Live status with port mappings — no CLI needed.',
    detail: 'Runs docker ps --format json over SSH, parses container state and port bindings, then exposes start/stop/restart actions as single-click API calls per container ID.',
    color: '#ee5396', bg: 'rgba(238,83,150,0.10)', border: 'rgba(238,83,150,0.28)', glow: 'rgba(238,83,150,0.18)', iconBg: 'rgba(238,83,150,0.15)',
  },
  {
    icon: Box,
    title: 'ProxMox LXC',
    description: 'Chain into ProxMox — list LXC containers, manage Docker inside each via pct exec. Full nesting support.',
    detail: 'SSH into the ProxMox host → pct list → pct exec <CTID> -- docker ps. Expandable LXC rows in the Node Monitor tab; start/stop for both LXC and the Docker containers inside.',
    color: '#f1c21b', bg: 'rgba(241,194,27,0.10)', border: 'rgba(241,194,27,0.28)', glow: 'rgba(241,194,27,0.18)', iconBg: 'rgba(241,194,27,0.15)',
  },
  {
    icon: Mic,
    title: 'Voice Interface',
    description: 'Calibrated speech recognition for voice-driven SSH queries. Speak to your fleet.',
    detail: 'Uses the Web Speech API with a calibration flow that tunes silence threshold and noise floor. Voice input feeds directly into the AI agent pipeline.',
    color: '#ff7eb6', bg: 'rgba(255,126,182,0.10)', border: 'rgba(255,126,182,0.28)', glow: 'rgba(255,126,182,0.18)', iconBg: 'rgba(255,126,182,0.15)',
  },
  {
    icon: Users,
    title: 'Multi-User Roles',
    description: 'Admin and Viewer roles via Firebase Auth. Shared fleet state synced via Firestore across all operators.',
    detail: 'Google SSO via Firebase Authentication. Roles stored in an authorizedUsers Firestore collection. Fleet hosts and audit logs shared across all authorized operators in real time.',
    color: '#42be65', bg: 'rgba(66,190,101,0.10)', border: 'rgba(66,190,101,0.28)', glow: 'rgba(66,190,101,0.18)', iconBg: 'rgba(66,190,101,0.15)',
  },
  {
    icon: Lock,
    title: 'AES-256 Security',
    description: 'Credentials encrypted at rest. Sandbox mode for public demos — real SSH is never exposed.',
    detail: 'SSH passwords and private keys encrypted with AES-256-CBC before Firestore write. DEMO_MODE env var forces all SSH to simulation server-side regardless of client payload.',
    color: '#78a9ff', bg: 'rgba(120,169,255,0.10)', border: 'rgba(120,169,255,0.28)', glow: 'rgba(120,169,255,0.18)', iconBg: 'rgba(120,169,255,0.15)',
  },
  {
    icon: ArrowRightLeft,
    title: 'Live Project Migration',
    description: 'Relocate a live docker-compose project to a different server in minutes — source keeps running until you verify the target is healthy and explicitly confirm the cutover.',
    detail: '7-step wizard: discover projects → configure target → preflight checks → volumes warning → tar.gz transfer → verify containers → confirm stop. Port conflicts remapped. Dockerfiles auto-patched for missing USER definitions. Full rollback on any failure.',
    color: '#ff7eb6', bg: 'rgba(255,126,182,0.10)', border: 'rgba(255,126,182,0.28)', glow: 'rgba(255,126,182,0.18)', iconBg: 'rgba(255,126,182,0.15)',
  },
];

/* ── Tech stack marquee ── */
const techStack = [
  'React 18', 'TypeScript', 'Vite', 'Tailwind CSS', 'Express.js',
  'Firebase Auth', 'Firestore', 'ssh2', 'Gemini 2.0 Flash', 'Groq',
  'AES-256-CBC', 'motion/react', 'Recharts', 'Docker API', 'pct exec', 'tar.gz migrate',
];

/* ── Hero terminal lines ── */
const heroTerminalLines = [
  { text: '$ [user] → How many Docker containers are running?', color: '#6f6f6f', delay: 0.4 },
  { text: '→ Thought: Count running containers via SSH docker ps.', color: '#f1c21b', delay: 0.9 },
  { text: '→ Action: docker ps --filter status=running | wc -l', color: '#78a9ff', delay: 1.4 },
  { text: '← Output: 7', color: '#8d8d8d', delay: 1.9 },
  { text: '✓ Reply: 7 containers running on Production Gateway.', color: '#42be65', delay: 2.4 },
];

/* ── How it works steps ── */
const steps = [
  {
    step: '01', icon: ShieldCheck, title: 'Sign in',
    description: 'Google SSO. Your email is checked against an authorized roles list in Firestore.',
    color: '#0f62fe', glow: 'rgba(15,98,254,0.35)',
  },
  {
    step: '02', icon: Globe, title: 'Add a host',
    description: "Enter IP, port, username, and SSH credentials. They're AES-256 encrypted on save.",
    color: '#6366f1', glow: 'rgba(99,102,241,0.35)',
  },
  {
    step: '03', icon: GitBranch, title: 'Command & monitor',
    description: 'Open the terminal, ask the AI agent, or manage Docker — real-time, from any browser.',
    color: '#24a148', glow: 'rgba(36,161,72,0.35)',
  },
];

/* ── Terminal chrome shared helper ── */
function TerminalCard({ label, accentColor, children }: { label: string; accentColor: string; children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden text-left"
      style={{
        background: 'linear-gradient(180deg, #1e1e1e 0%, #191919 100%)',
        border: `1px solid ${accentColor}40`,
        boxShadow: `0 0 0 1px ${accentColor}12, 0 24px 60px rgba(0,0,0,0.55), 0 0 40px ${accentColor}10`,
      }}
    >
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#161616] border-b border-[#2e2e2e]">
        <div className="h-2 w-2 rounded-full bg-[#da1e28]" />
        <div className="h-2 w-2 rounded-full bg-[#f1c21b]" />
        <div className="h-2 w-2 rounded-full bg-[#24a148]" />
        <span className="ml-3 font-mono text-[11px] text-[#6f6f6f]">{label}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: accentColor }} />
          <span className="font-mono text-[10px]" style={{ color: accentColor }}>LIVE</span>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function HomePage({ onSignIn, onSandbox }: HomePageProps) {
  return (
    <div className="min-h-screen bg-[#161616] text-[#f4f4f4] font-sans overflow-x-hidden">
      {/* Marquee keyframes */}
      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>

      {/* Dot-grid background */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.09) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 bg-[#161616] border-b border-[#393939] h-14 px-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 text-white shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #0f62fe)' }}>
            <Bot className="h-4 w-4" />
          </div>
          <span className="font-semibold text-[13px] text-white">BuildOS Node Commander</span>
          <span className="hidden sm:inline bg-[#6366f1]/15 text-[#818cf8] font-mono text-[9px] px-2 py-0.5 border border-[#6366f1]/30">v1.6.5</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/shashankshekhar2909/BuildOS-Node-Manager"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-[#8d8d8d] hover:text-white transition-colors"
            title="View on GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
          <button onClick={onSandbox} className="hidden sm:block text-[10px] font-mono text-[#8d8d8d] hover:text-white uppercase tracking-wider transition-colors cursor-pointer">
            Live Demo
          </button>
          <button
            onClick={onSignIn}
            className="px-4 py-2 text-white font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #0f62fe, #6366f1)', boxShadow: '0 0 16px rgba(99,102,241,0.35)' }}
          >
            Sign In
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative px-5 pt-24 pb-20 text-center max-w-5xl mx-auto">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(99,102,241,0.18) 0%, rgba(15,98,254,0.10) 45%, transparent 70%)' }} />

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-8 font-mono text-[10px] uppercase tracking-wider" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)', color: '#818cf8', boxShadow: '0 0 20px rgba(99,102,241,0.12)' }}>
            <Zap className="h-3 w-3" />
            <span>Self-hosted SSH fleet manager</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-bold text-white leading-[1.13] tracking-tight mb-6">
            Command your entire<br />
            <span style={{ background: 'linear-gradient(130deg, #818cf8 0%, #6366f1 40%, #0f62fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Linux fleet
            </span>{' '}with AI
          </h1>

          <p className="text-[#a8a8a8] text-base sm:text-[1.05rem] leading-relaxed max-w-2xl mx-auto mb-10">
            SSH into any server, monitor live telemetry, manage Docker containers,
            and ask your AI agent to run diagnostics — all from one dashboard.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button onClick={onSignIn} className="px-8 py-3 text-white font-mono font-bold text-sm uppercase tracking-wider transition-all cursor-pointer hover:scale-[1.03]" style={{ background: 'linear-gradient(135deg, #0f62fe 0%, #6366f1 100%)', boxShadow: '0 4px 24px rgba(99,102,241,0.45), 0 1px 0 rgba(255,255,255,0.08) inset' }}>
              Get Started
            </button>
            <button onClick={onSandbox} className="px-8 py-3 bg-transparent text-[#c6c6c6] hover:text-white font-mono text-sm uppercase tracking-wider transition-all cursor-pointer hover:border-[#6366f1]" style={{ border: '1px solid #393939' }}>
              Live Demo →
            </button>
          </div>
        </motion.div>

        {/* Hero terminal */}
        <motion.div initial={{ opacity: 0, y: 44 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25 }} className="mt-16">
          <TerminalCard label="buildos-agent · AI ReAct Loop" accentColor="#6366f1">
            <div className="p-6 font-mono text-[12px] space-y-2.5 min-h-[9rem]">
              {heroTerminalLines.map((line, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: line.delay, duration: 0.3 }} style={{ color: line.color }}>
                  {line.text}
                </motion.div>
              ))}
              <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="inline-block w-2 h-3.5 align-middle mt-1" style={{ background: '#6366f1' }} />
            </div>
          </TerminalCard>
        </motion.div>
      </section>

      {/* ── Stats bar ── */}
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="py-8 px-5" style={{ borderTop: '1px solid rgba(99,102,241,0.12)', borderBottom: '1px solid rgba(99,102,241,0.12)', background: 'linear-gradient(180deg, transparent, rgba(99,102,241,0.04), transparent)' }}>
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: '∞', label: 'Hosts', color: '#6366f1' },
            { value: 'AI', label: 'ReAct Agent', color: '#818cf8' },
            { value: '30s', label: 'Telemetry Poll', color: '#42be65' },
            { value: 'AES-256', label: 'Encryption', color: '#78a9ff' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-2xl font-extrabold font-mono mb-1" style={{ color: stat.color, textShadow: `0 0 20px ${stat.color}60` }}>{stat.value}</div>
              <div className="text-[10px] text-[#6f6f6f] uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Feature grid ── */}
      <section className="px-5 py-20 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <p className="font-mono text-[10px] text-[#6366f1] uppercase tracking-widest mb-3">What's inside</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Everything you need to run a fleet</h2>
          <p className="text-[#6f6f6f] text-sm max-w-xl mx-auto">Nine battle-tested modules, unified in a single self-hosted dashboard. Hover any card for implementation details.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              whileHover={{ scale: 1.025, transition: { duration: 0.15 } }}
              className="group p-5 cursor-default relative overflow-hidden"
              style={{ backgroundColor: feat.bg, border: `1px solid ${feat.border}` }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${feat.glow} 0%, transparent 70%)` }} />
              <div className="relative mb-4 w-9 h-9 flex items-center justify-center" style={{ background: feat.iconBg, border: `1px solid ${feat.border}` }}>
                <feat.icon style={{ color: feat.color, width: 18, height: 18 }} />
              </div>
              <h3 className="relative font-bold text-white text-sm mb-2 font-mono">{feat.title}</h3>
              <p className="relative text-[11px] text-[#8d8d8d] leading-relaxed mb-3">{feat.description}</p>
              <p className="relative text-[10px] leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ color: feat.color }}>
                {feat.detail}
              </p>
              <div className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-400" style={{ background: `linear-gradient(90deg, ${feat.color}, transparent)` }} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Feature spotlights ── */}
      <section className="px-5 py-4 max-w-6xl mx-auto space-y-24">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-6">
          <p className="font-mono text-[10px] text-[#6366f1] uppercase tracking-widest mb-3">Deep dives</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">How each module actually works</h2>
        </motion.div>

        {/* Spotlight A — AI ReAct Agent */}
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-5 font-mono text-[10px] uppercase tracking-wider" style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.30)', color: '#818cf8' }}>
              <Bot className="h-3 w-3" /> AI ReAct Agent
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 leading-snug">Natural language → SSH execution → structured reply</h3>
            <p className="text-[#8d8d8d] text-sm leading-relaxed mb-6">
              No predefined command palette. The LLM reasons about what to run, executes it over real SSH, observes the output, and iterates until it has a confident answer.
            </p>
            <ul className="space-y-3">
              {[
                { label: 'Gemini 2.0 Flash or Groq', detail: 'Switchable provider — configure API key in Settings' },
                { label: 'JSON action schema', detail: '{"action":"ssh_exec","command":"..."} — typed, validated per turn' },
                { label: 'Server-side NL guard', detail: 'Regex catches natural language accidentally passed as commands, feeds corrective prompt back' },
                { label: 'Multi-turn context', detail: 'Full conversation history passed each turn; agent builds on prior outputs' },
              ].map(b => (
                <li key={b.label} className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: '#6366f1' }} />
                  <div>
                    <span className="text-[13px] font-semibold text-white font-mono">{b.label}</span>
                    <span className="text-[11px] text-[#6f6f6f] ml-2">{b.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {/* Mockup */}
          <div>
            <TerminalCard label="buildos · ReAct loop · turn 2/3" accentColor="#6366f1">
              <div className="p-5 font-mono text-[11px] space-y-2">
                {[
                  { t: '$ Which process is eating the most CPU right now?', c: '#525252' },
                  { t: '→ Thought: Need process list sorted by CPU usage.', c: '#f1c21b' },
                  { t: '→ Action: ps aux --sort=-%cpu | head -6', c: '#818cf8' },
                  { t: '← USER       PID  %CPU %MEM    VSZ   RSS COMMAND', c: '#6f6f6f' },
                  { t: '← root      1847  78.2  2.1 412088 43520 node server.js', c: '#6f6f6f' },
                  { t: '← www-data   942   4.1  0.8  88132  16384 nginx', c: '#6f6f6f' },
                  { t: '→ Thought: node server.js is the culprit at 78.2% CPU.', c: '#f1c21b' },
                  { t: '✓ node server.js (PID 1847) is consuming 78.2% CPU.', c: '#42be65' },
                  { t: '  Consider restarting or profiling with --inspect.', c: '#42be65' },
                ].map((line, i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} style={{ color: line.c }}>
                    {line.t}
                  </motion.div>
                ))}
              </div>
            </TerminalCard>
          </div>
        </motion.div>

        {/* Spotlight B — SSH Fleet + Telemetry */}
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Mockup — left on desktop */}
          <div className="order-2 lg:order-1">
            <TerminalCard label="node-monitor · Production Gateway · live" accentColor="#24a148">
              <div className="p-5 space-y-4">
                {[
                  { label: 'CPU', value: 73, color: '#ee5396' },
                  { label: 'RAM', value: 58, color: '#78a9ff' },
                  { label: 'Disk', value: 41, color: '#42be65' },
                ].map((m, i) => (
                  <div key={m.label}>
                    <div className="flex justify-between mb-1.5 font-mono text-[10px]">
                      <span className="text-[#8d8d8d]">{m.label}</span>
                      <span style={{ color: m.color }}>{m.value}%</span>
                    </div>
                    <div className="h-1.5 bg-[#262626] overflow-hidden">
                      <motion.div
                        className="h-full"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${m.value}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: i * 0.15, ease: 'easeOut' }}
                        style={{ background: `linear-gradient(90deg, ${m.color}99, ${m.color})` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-[#2e2e2e] grid grid-cols-3 gap-3 font-mono text-[10px] text-center">
                  {[
                    { label: 'Containers', val: '7 running', color: '#42be65' },
                    { label: 'Open Ports', val: '22 80 443', color: '#78a9ff' },
                    { label: 'Uptime', val: '14d 6h', color: '#f1c21b' },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="font-bold mb-0.5" style={{ color: s.color }}>{s.val}</div>
                      <div className="text-[#525252]">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </TerminalCard>
          </div>
          {/* Text — right on desktop */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-5 font-mono text-[10px] uppercase tracking-wider" style={{ background: 'rgba(36,161,72,0.10)', border: '1px solid rgba(36,161,72,0.30)', color: '#42be65' }}>
              <Cpu className="h-3 w-3" /> SSH Fleet + Telemetry
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 leading-snug">Real SSH. Real metrics. Every 30 seconds.</h3>
            <p className="text-[#8d8d8d] text-sm leading-relaxed mb-6">
              Physical hosts are polled on a 30s interval using real SSH commands. Results are written back into host state and surfaced in the fleet cards and Node Monitor.
            </p>
            <ul className="space-y-3">
              {[
                { label: 'ssh2 tunnel streams', detail: 'Persistent encrypted channel per command; no shell spawning overhead' },
                { label: 'top / free / df / ss', detail: 'OS-native commands — no agent installed on the target host' },
                { label: 'Recharts sparklines', detail: '30-point rolling history rendered per-metric in Node Monitor' },
                { label: 'Firestore-synced fleet', detail: 'All operators see the same host list and metrics in real time' },
              ].map(b => (
                <li key={b.label} className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: '#24a148' }} />
                  <div>
                    <span className="text-[13px] font-semibold text-white font-mono">{b.label}</span>
                    <span className="text-[11px] text-[#6f6f6f] ml-2">{b.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* Spotlight C — Docker + ProxMox LXC */}
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-5 font-mono text-[10px] uppercase tracking-wider" style={{ background: 'rgba(241,194,27,0.10)', border: '1px solid rgba(241,194,27,0.30)', color: '#f1c21b' }}>
              <Box className="h-3 w-3" /> Docker + ProxMox LXC
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 leading-snug">Manage containers inside containers — without a single CLI tab.</h3>
            <p className="text-[#8d8d8d] text-sm leading-relaxed mb-6">
              For ProxMox hosts, BuildOS chains SSH into the hypervisor, lists LXC containers via <code className="text-[#f1c21b] font-mono text-[11px]">pct list</code>, then executes Docker commands inside each via <code className="text-[#f1c21b] font-mono text-[11px]">pct exec</code>.
            </p>
            <ul className="space-y-3">
              {[
                { label: 'docker ps --format json', detail: 'Parsed server-side — container ID, name, image, status, ports' },
                { label: 'pct list → pct exec <CTID>', detail: 'Two-hop command chain: ProxMox host → inside LXC container' },
                { label: 'Start / stop at two levels', detail: 'Control LXC container itself, or Docker containers running inside it' },
                { label: 'Firestore host support', detail: 'Host object passed in request body — works for cloud-managed hosts, not just local JSON' },
              ].map(b => (
                <li key={b.label} className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: '#f1c21b' }} />
                  <div>
                    <span className="text-[13px] font-semibold text-white font-mono">{b.label}</span>
                    <span className="text-[11px] text-[#6f6f6f] ml-2">{b.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {/* Mockup — nested tree */}
          <div>
            <TerminalCard label="node-monitor · proxmox-01 · LXC tab" accentColor="#f1c21b">
              <div className="p-5 font-mono text-[11px] space-y-2">
                <div className="text-[#525252] mb-3">$ pct list</div>
                {[
                  {
                    ctid: '101', name: 'nginx-lb', status: 'running', color: '#42be65',
                    docker: [
                      { name: 'nginx', image: 'nginx:alpine', ports: '0.0.0.0:80→80/tcp', status: 'Up 3 days' },
                    ],
                  },
                  {
                    ctid: '102', name: 'app-server', status: 'running', color: '#42be65',
                    docker: [
                      { name: 'api', image: 'node:20-slim', ports: '0.0.0.0:3000→3000/tcp', status: 'Up 1 day' },
                      { name: 'redis', image: 'redis:7', ports: '6379/tcp', status: 'Up 1 day' },
                    ],
                  },
                  { ctid: '103', name: 'backup-cron', status: 'stopped', color: '#8d8d8d', docker: [] },
                ].map((lxc, li) => (
                  <motion.div key={lxc.ctid} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: li * 0.15 }}>
                    <div className="flex items-center gap-2 py-1.5 px-2 bg-[#262626] border border-[#393939]">
                      <span style={{ color: lxc.color }}>▶</span>
                      <span className="text-[#c6c6c6]">{lxc.ctid}</span>
                      <span className="text-[#8d8d8d]">{lxc.name}</span>
                      <span className="ml-auto text-[10px]" style={{ color: lxc.color }}>{lxc.status}</span>
                    </div>
                    {lxc.docker.map(d => (
                      <div key={d.name} className="ml-5 mt-px flex gap-3 px-2 py-1 bg-[#1a1a1a] border-l border-[#f1c21b]/30 text-[10px]">
                        <Container className="h-3 w-3 shrink-0 mt-0.5 text-[#ee5396]" />
                        <span className="text-[#c6c6c6] w-14 shrink-0">{d.name}</span>
                        <span className="text-[#525252] truncate">{d.ports}</span>
                        <span className="ml-auto text-[#42be65] shrink-0">{d.status}</span>
                      </div>
                    ))}
                  </motion.div>
                ))}
              </div>
            </TerminalCard>
          </div>
        </motion.div>

        {/* Spotlight D — Live Project Migration */}
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text */}
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-5 font-mono text-[10px] uppercase tracking-wider" style={{ background: 'rgba(255,126,182,0.10)', border: '1px solid rgba(255,126,182,0.30)', color: '#ff7eb6' }}>
              <ArrowRightLeft className="h-3 w-3" /> Live Migration · SSH Transfer
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 leading-snug">Move a live stack to a new server — source never stops until you say so.</h3>
            <p className="text-[#8d8d8d] text-sm leading-relaxed mb-6">
              No Docker Hub. No shared volumes. No inter-node SSH keys. BuildOS acts as the relay — it pulls a tar.gz from the source over SFTP, re-uploads it to the target, extracts, starts the stack, waits for all containers to pass health checks, then asks you to confirm before touching the source.
            </p>
            <ul className="space-y-3">
              {[
                { label: 'Single tar.gz transfer', detail: 'One archive: pack on source → download to BuildOS → upload to target → extract. Faster than file-by-file SFTP.' },
                { label: 'Port conflict remapping', detail: 'Preflight runs ss -tlnp on target. Any conflict shows in an editable table — change the host port before migration starts.' },
                { label: 'Transactional rollback', detail: 'If anything fails after extraction — bad health check, compose error — target is cleaned and source stays running. Nothing is lost.' },
                { label: 'Dockerfile user-patch', detail: 'Scans every Dockerfile in the project. If USER <name> exists without a matching useradd/adduser, injects the creation lines automatically before docker compose up.' },
                { label: 'DNS handover card', detail: 'On completion: target IP, all services with their new ports, copy buttons, downloadable .txt summary. Update DNS from one screen.' },
              ].map(b => (
                <li key={b.label} className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: '#ff7eb6' }} />
                  <div>
                    <span className="text-[13px] font-semibold text-white font-mono">{b.label}</span>
                    <span className="text-[11px] text-[#6f6f6f] ml-2">{b.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {/* Mockup — migration log */}
          <div className="order-1 lg:order-2">
            <TerminalCard label="buildos · migrate · agentic-hms → prod-server" accentColor="#ff7eb6">
              <div className="p-5 font-mono text-[11px] space-y-1.5">
                {[
                  { t: '[09:14:22] Preflight passed — disk 42GB free', c: '#6f6f6f' },
                  { t: '[09:14:23] Port 3000 conflict → remapped to 3001', c: '#f1c21b' },
                  { t: '[09:14:24] Archiving source... (tar.gz)', c: '#8d8d8d' },
                  { t: '[09:14:31] Archive: 84MB in 7.2s', c: '#8d8d8d' },
                  { t: '[09:14:39] Upload to prod-server complete (8.1s)', c: '#8d8d8d' },
                  { t: '[09:14:41] Extracted → /opt/agentic-hms', c: '#78a9ff' },
                  { t: '[09:14:41] Files live at: deploy@10.0.0.5:/opt/agentic-hms', c: '#78a9ff' },
                  { t: '[09:14:42] Dockerfile check: Patched backend/Dockerfile', c: '#f1c21b' },
                  { t: '[09:14:48] docker compose up -d (6.2s)', c: '#8d8d8d' },
                  { t: '[09:14:55] ✓ 3/3 containers healthy', c: '#42be65' },
                  { t: '[09:14:55] Source still running — awaiting confirm', c: '#ff7eb6' },
                ].map((line, i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} style={{ color: line.c }}>
                    {line.t}
                  </motion.div>
                ))}
              </div>
            </TerminalCard>
          </div>
        </motion.div>
      </section>

      {/* ── Why self-hosted? ── */}
      <section className="px-5 py-20 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
          <p className="font-mono text-[10px] text-[#6366f1] uppercase tracking-widest mb-3">Why self-hosted</p>
          <h2 className="text-2xl font-bold text-white">Your infra, your rules</h2>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { icon: Shield, title: 'Full Privacy', body: 'SSH credentials and host data never leave your network. No cloud vendor sees your servers.', color: '#6366f1' },
            { icon: Infinity, title: 'No Limits', body: 'Unlimited hosts, commands, history, and operators. No per-seat pricing, no API quotas.', color: '#0f62fe' },
            { icon: Container, title: 'Runs Anywhere', body: 'One docker compose up. Works on a Raspberry Pi, a VPS, or a homelab rack.', color: '#24a148' },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6"
              style={{ background: 'rgba(22,22,22,0.8)', border: `1px solid rgba(99,102,241,0.18)` }}
            >
              <div className="mb-4 w-9 h-9 flex items-center justify-center" style={{ background: `${card.color}18`, border: `1px solid ${card.color}30` }}>
                <card.icon style={{ color: card.color, width: 18, height: 18 }} />
              </div>
              <h3 className="font-bold text-white text-sm mb-2 font-mono">{card.title}</h3>
              <p className="text-[12px] text-[#8d8d8d] leading-relaxed">{card.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-5 py-24" style={{ background: 'linear-gradient(180deg, transparent, rgba(22,22,22,0.95), transparent)', borderTop: '1px solid #262626', borderBottom: '1px solid #262626' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="font-mono text-[10px] text-[#6366f1] uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">From zero to fleet in minutes</h2>
          </motion.div>

          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="hidden sm:block absolute top-[2.4rem] left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(15,98,254,0.4), rgba(99,102,241,0.5), rgba(36,161,72,0.4))' }} />
            {steps.map((step, i) => (
              <motion.div key={step.step} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.14 }} className="relative flex flex-col items-center sm:items-start text-center sm:text-left">
                <div className="relative z-10 mb-5 w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center" style={{ background: 'rgba(22,22,22,0.95)', border: `2px solid ${step.color}`, boxShadow: `0 0 28px ${step.glow}` }}>
                  <step.icon className="h-6 w-6" style={{ color: step.color }} />
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: step.color, opacity: 0.7 }}>Step {step.step}</div>
                <h3 className="font-bold text-white text-base mb-2">{step.title}</h3>
                <p className="text-[12px] text-[#8d8d8d] leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech stack marquee ── */}
      <div className="py-8 overflow-hidden" style={{ borderBottom: '1px solid #2a2a2a' }}>
        <div className="flex items-center gap-3 mb-3 justify-center">
          <span className="font-mono text-[10px] text-[#525252] uppercase tracking-widest">Built with</span>
        </div>
        <div className="relative">
          <div style={{ display: 'flex', width: 'max-content', animation: 'marquee 28s linear infinite' }}>
            {[...techStack, ...techStack].map((t, i) => (
              <span
                key={i}
                className="font-mono text-[10px] text-[#8d8d8d] bg-[#1e1e1e] mx-1.5 px-3 py-1.5 whitespace-nowrap transition-colors hover:text-white hover:bg-[#262626]"
                style={{ border: '1px solid #2e2e2e' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <section className="px-5 py-28 text-center max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="relative p-10 overflow-hidden" style={{ background: 'rgba(22,22,22,0.95)', border: '1px solid rgba(99,102,241,0.25)', boxShadow: '0 0 80px rgba(99,102,241,0.10), 0 0 1px rgba(99,102,241,0.3)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 65%)' }} />
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #6366f1, #0f62fe, transparent)' }} />

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 font-mono text-[10px] uppercase tracking-wider" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}>
                <Zap className="h-3 w-3" />Take command
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Ready to take command?</h2>
              <p className="text-[#8d8d8d] text-sm leading-relaxed mb-10">
                Sign in with Google to manage your real fleet, or jump straight into the sandbox with simulated servers — no setup required.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <button onClick={onSignIn} className="px-8 py-3.5 text-white font-mono font-bold text-sm uppercase tracking-wider transition-all cursor-pointer hover:scale-[1.03]" style={{ background: 'linear-gradient(135deg, #0f62fe 0%, #6366f1 100%)', boxShadow: '0 4px 24px rgba(99,102,241,0.50), 0 1px 0 rgba(255,255,255,0.08) inset' }}>
                  Sign In with Google
                </button>
                <button onClick={onSandbox} className="px-8 py-3.5 bg-transparent text-[#c6c6c6] hover:text-white font-mono text-sm uppercase tracking-wider transition-all cursor-pointer hover:border-[#6366f1]" style={{ border: '1px solid #393939' }}>
                  Sandbox Mode
                </button>
              </div>
              <div className="mt-8 pt-6 border-t border-[#262626] flex items-center justify-center gap-4">
                <a href="https://github.com/shashankshekhar2909/BuildOS-Node-Manager" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[#525252] hover:text-[#6366f1] transition-colors text-[11px] font-mono">
                  <Github className="h-3.5 w-3.5" />
                  View source on GitHub
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-6 px-5 text-center text-[11px] text-[#525252] flex items-center justify-center gap-3 flex-wrap" style={{ borderTop: '1px solid #262626' }}>
        <span>Built by</span>
        <a href="https://buildwithshashank.com" target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:text-[#818cf8] font-semibold transition-colors">BuildWithShashank</a>
        <span className="text-[#393939]">·</span>
        {[
          { label: 'GitHub', href: 'https://github.com/shashankshekhar2909' },
          { label: 'LinkedIn', href: 'https://linkedin.com/in/shashankshekhar2k15' },
          { label: 'Reddit', href: 'https://www.reddit.com/user/s_shekhar29/' },
          { label: 'Website', href: 'https://buildwithshashank.com' },
        ].map(s => (
          <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="text-[#525252] hover:text-[#6366f1] transition-colors">{s.label}</a>
        ))}
      </footer>
    </div>
  );
}
