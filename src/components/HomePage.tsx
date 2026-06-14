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
} from 'lucide-react';

interface HomePageProps {
  onSignIn: () => void;
  onSandbox: () => void;
}

const features = [
  {
    icon: Server,
    title: 'SSH Fleet Command',
    description: 'Connect unlimited remote Linux servers. Real-time host health, port status, and uptime at a glance.',
    detail: 'Uses the ssh2 Node.js library for real SSH tunnel streams. Credentials stored AES-256-CBC encrypted. Hosts persisted in Firestore for cross-device access.',
    color: '#0f62fe',
    bg: 'rgba(15,98,254,0.10)',
    border: 'rgba(15,98,254,0.28)',
    glow: 'rgba(15,98,254,0.18)',
    iconBg: 'rgba(15,98,254,0.15)',
  },
  {
    icon: Cpu,
    title: 'Live Telemetry',
    description: 'CPU, RAM, and disk polled every 30s for physical hosts. Persistent historical charts per node.',
    detail: 'Runs top, free, df, ss over SSH on each physical host. Results written back to host state and rendered with Recharts sparklines in the Node Monitor.',
    color: '#24a148',
    bg: 'rgba(36,161,72,0.10)',
    border: 'rgba(36,161,72,0.28)',
    glow: 'rgba(36,161,72,0.18)',
    iconBg: 'rgba(36,161,72,0.15)',
  },
  {
    icon: Bot,
    title: 'AI ReAct Agent',
    description: 'Ask natural-language questions. The agent translates intent to SSH commands, executes, and explains results.',
    detail: 'Implements a ReAct (Reasoning + Action) loop with Gemini 2.0 Flash or Groq. LLM outputs JSON {action, command}, server executes via SSH, feeds output back — repeats until final answer.',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.10)',
    border: 'rgba(99,102,241,0.28)',
    glow: 'rgba(99,102,241,0.22)',
    iconBg: 'rgba(99,102,241,0.15)',
  },
  {
    icon: Terminal,
    title: 'Docker Management',
    description: 'List, start, stop, and restart containers per host. Live status with port mappings — no CLI needed.',
    detail: 'Runs docker ps --format json over SSH, parses container state and port bindings, then exposes start/stop/restart actions as single-click API calls per container ID.',
    color: '#ee5396',
    bg: 'rgba(238,83,150,0.10)',
    border: 'rgba(238,83,150,0.28)',
    glow: 'rgba(238,83,150,0.18)',
    iconBg: 'rgba(238,83,150,0.15)',
  },
  {
    icon: Box,
    title: 'ProxMox LXC',
    description: 'Chain into ProxMox — list LXC containers, manage Docker inside each via pct exec. Full nesting support.',
    detail: 'SSH into the ProxMox host → pct list → pct exec <CTID> -- docker ps. Expandable LXC rows in the Node Monitor tab; start/stop for both LXC and the Docker containers inside.',
    color: '#f1c21b',
    bg: 'rgba(241,194,27,0.10)',
    border: 'rgba(241,194,27,0.28)',
    glow: 'rgba(241,194,27,0.18)',
    iconBg: 'rgba(241,194,27,0.15)',
  },
  {
    icon: Mic,
    title: 'Voice Interface',
    description: 'Calibrated speech recognition for voice-driven SSH queries. Speak to your fleet.',
    detail: 'Uses the Web Speech API with a calibration flow that tunes silence threshold and noise floor. Voice input feeds directly into the AI agent pipeline.',
    color: '#ff7eb6',
    bg: 'rgba(255,126,182,0.10)',
    border: 'rgba(255,126,182,0.28)',
    glow: 'rgba(255,126,182,0.18)',
    iconBg: 'rgba(255,126,182,0.15)',
  },
  {
    icon: Users,
    title: 'Multi-User Roles',
    description: 'Admin and Viewer roles via Firebase Auth. Shared fleet state synced via Firestore across all operators.',
    detail: 'Google SSO via Firebase Authentication. Roles stored in an authorizedUsers Firestore collection. Fleet hosts and audit logs shared across all authorized operators in real time.',
    color: '#42be65',
    bg: 'rgba(66,190,101,0.10)',
    border: 'rgba(66,190,101,0.28)',
    glow: 'rgba(66,190,101,0.18)',
    iconBg: 'rgba(66,190,101,0.15)',
  },
  {
    icon: Lock,
    title: 'AES-256 Security',
    description: 'Credentials encrypted at rest. Sandbox mode for public demos — real SSH is never exposed.',
    detail: 'SSH passwords and private keys encrypted with AES-256-CBC before Firestore write. DEMO_MODE env var forces all SSH to simulation server-side regardless of client payload.',
    color: '#78a9ff',
    bg: 'rgba(120,169,255,0.10)',
    border: 'rgba(120,169,255,0.28)',
    glow: 'rgba(120,169,255,0.18)',
    iconBg: 'rgba(120,169,255,0.15)',
  },
];

const techStack = [
  'React 18', 'TypeScript', 'Vite', 'Tailwind CSS',
  'Express.js', 'Firebase Auth', 'Firestore', 'ssh2',
  'Gemini / Groq AI', 'AES-256-CBC',
];

const terminalLines = [
  { text: '$ [user] → How many Docker containers are running?', color: '#6f6f6f', delay: 0.4 },
  { text: '→ Thought: Count running containers via SSH docker ps.', color: '#f1c21b', delay: 0.9 },
  { text: '→ Action: docker ps --filter status=running | wc -l', color: '#78a9ff', delay: 1.4 },
  { text: '← Output: 7', color: '#8d8d8d', delay: 1.9 },
  { text: '✓ Reply: 7 containers running on Production Gateway.', color: '#42be65', delay: 2.4 },
];

const steps = [
  {
    step: '01',
    icon: ShieldCheck,
    title: 'Sign in',
    description: "Google SSO. Your email is checked against an authorized roles list in Firestore.",
    color: '#0f62fe',
    glow: 'rgba(15,98,254,0.35)',
  },
  {
    step: '02',
    icon: Globe,
    title: 'Add a host',
    description: "Enter IP, port, username, and SSH credentials. They're AES-256 encrypted on save.",
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.35)',
  },
  {
    step: '03',
    icon: GitBranch,
    title: 'Command & monitor',
    description: 'Open the terminal, ask the AI agent, or manage Docker — real-time, from any browser.',
    color: '#24a148',
    glow: 'rgba(36,161,72,0.35)',
  },
];

export default function HomePage({ onSignIn, onSandbox }: HomePageProps) {
  return (
    <div className="min-h-screen bg-[#161616] text-[#f4f4f4] font-sans overflow-x-hidden">
      {/* Dot-grid background with radial vignette */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.11) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Radial vignette overlay to ground content */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, transparent 40%, #161616 100%)',
        }}
      />

      {/* Sticky nav */}
      <header className="sticky top-0 z-50 bg-[#161616]/90 backdrop-blur-md border-b border-[#393939] h-14 px-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="p-1.5 text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #0f62fe)' }}
          >
            <Bot className="h-4 w-4" />
          </div>
          <span className="font-semibold text-[13px] text-white">BuildOS Node Commander</span>
          <span className="hidden sm:inline bg-[#6366f1]/15 text-[#818cf8] font-mono text-[9px] px-2 py-0.5 border border-[#6366f1]/30">
            v1.6.5
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onSandbox}
            className="hidden sm:block text-[10px] font-mono text-[#8d8d8d] hover:text-white uppercase tracking-wider transition-colors cursor-pointer"
          >
            Live Demo
          </button>
          <button
            onClick={onSignIn}
            className="px-4 py-2 text-white font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #0f62fe, #6366f1)',
              boxShadow: '0 0 16px rgba(99,102,241,0.35)',
            }}
          >
            Sign In
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative px-5 pt-24 pb-20 text-center max-w-5xl mx-auto">
        {/* Hero radial glow backdrop */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(99,102,241,0.18) 0%, rgba(15,98,254,0.10) 45%, transparent 70%)',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-8 font-mono text-[10px] uppercase tracking-wider"
            style={{
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.35)',
              color: '#818cf8',
              boxShadow: '0 0 20px rgba(99,102,241,0.12)',
            }}
          >
            <Zap className="h-3 w-3" />
            <span>Self-hosted SSH fleet manager</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-bold text-white leading-[1.13] tracking-tight mb-6">
            Command your entire<br />
            <span
              style={{
                background: 'linear-gradient(130deg, #818cf8 0%, #6366f1 40%, #0f62fe 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Linux fleet
            </span>{' '}
            with AI
          </h1>

          <p className="text-[#a8a8a8] text-base sm:text-[1.05rem] leading-relaxed max-w-2xl mx-auto mb-10">
            SSH into any server, monitor live telemetry, manage Docker containers,
            and ask your AI agent to run diagnostics — all from one dashboard.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={onSignIn}
              className="px-8 py-3 text-white font-mono font-bold text-sm uppercase tracking-wider transition-all cursor-pointer hover:scale-[1.03]"
              style={{
                background: 'linear-gradient(135deg, #0f62fe 0%, #6366f1 100%)',
                boxShadow: '0 4px 24px rgba(99,102,241,0.45), 0 1px 0 rgba(255,255,255,0.08) inset',
              }}
            >
              Get Started
            </button>
            <button
              onClick={onSandbox}
              className="px-8 py-3 bg-transparent text-[#c6c6c6] hover:text-white font-mono text-sm uppercase tracking-wider transition-all cursor-pointer hover:border-[#6366f1]"
              style={{ border: '1px solid #393939' }}
            >
              Live Demo →
            </button>
          </div>
        </motion.div>

        {/* Animated terminal card */}
        <motion.div
          initial={{ opacity: 0, y: 44 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="mt-16 text-left overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #1e1e1e 0%, #191919 100%)',
            border: '1px solid rgba(99,102,241,0.30)',
            boxShadow:
              '0 0 0 1px rgba(99,102,241,0.10), 0 32px 80px rgba(0,0,0,0.65), 0 0 60px rgba(99,102,241,0.08)',
          }}
        >
          {/* Gradient border top accent */}
          <div
            className="h-px w-full"
            style={{ background: 'linear-gradient(90deg, transparent, #6366f1, #0f62fe, transparent)' }}
          />

          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#161616] border-b border-[#2e2e2e]">
            <div className="h-2.5 w-2.5 rounded-full bg-[#da1e28]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#f1c21b]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#24a148]" />
            <span className="ml-3 font-mono text-[11px] text-[#6f6f6f]">buildos-agent · AI ReAct Loop</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#24a148] animate-pulse" />
              <span className="font-mono text-[10px] text-[#42be65]">LIVE</span>
            </div>
          </div>

          <div className="p-6 font-mono text-[12px] space-y-2.5 min-h-[9rem]">
            {terminalLines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: line.delay, duration: 0.3 }}
                style={{ color: line.color }}
              >
                {line.text}
              </motion.div>
            ))}
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="inline-block w-2 h-3.5 align-middle mt-1"
              style={{ background: '#6366f1' }}
            />
          </div>
        </motion.div>
      </section>

      {/* ── Stats bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="py-10 px-5"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(30,30,30,0.8), transparent)',
          borderTop: '1px solid rgba(99,102,241,0.15)',
          borderBottom: '1px solid rgba(99,102,241,0.15)',
        }}
      >
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: '∞', label: 'Hosts', color: '#6366f1' },
            { value: 'AI', label: 'ReAct Agent', color: '#0f62fe' },
            { value: '30s', label: 'Telemetry Poll', color: '#24a148' },
            { value: 'AES-256', label: 'Credential Encryption', color: '#78a9ff' },
          ].map(stat => (
            <div key={stat.label} className="group">
              <div
                className="text-3xl font-extrabold font-mono mb-1.5 tabular-nums"
                style={{ color: stat.color, textShadow: `0 0 24px ${stat.color}60` }}
              >
                {stat.value}
              </div>
              <div className="text-[10px] text-[#6f6f6f] uppercase tracking-widest font-mono">{stat.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Features grid ── */}
      <section className="px-5 py-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="font-mono text-[10px] text-[#6366f1] uppercase tracking-widest mb-3">What's inside</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Everything you need to run a fleet</h2>
          <p className="text-[#6f6f6f] text-sm max-w-xl mx-auto">
            Eight battle-tested modules, unified in a single self-hosted dashboard.
          </p>
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
              style={{
                backgroundColor: feat.bg,
                border: `1px solid ${feat.border}`,
              }}
            >
              {/* Hover inner glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${feat.glow} 0%, transparent 70%)`,
                }}
              />
              {/* Icon in colored square */}
              <div
                className="relative mb-4 w-9 h-9 flex items-center justify-center"
                style={{
                  background: feat.iconBg,
                  border: `1px solid ${feat.border}`,
                }}
              >
                <feat.icon className="h-4.5 w-4.5" style={{ color: feat.color, width: 18, height: 18 }} />
              </div>
              <h3 className="relative font-bold text-white text-sm mb-2 font-mono">{feat.title}</h3>
              <p className="relative text-[11px] text-[#8d8d8d] leading-relaxed mb-3">{feat.description}</p>
              <p
                className="relative text-[10px] leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ color: feat.color }}
              >
                {feat.detail}
              </p>
              {/* Bottom accent line on hover */}
              <div
                className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-400"
                style={{ background: `linear-gradient(90deg, ${feat.color}, transparent)` }}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        className="px-5 py-24"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(22,22,22,0.95), transparent)',
          borderTop: '1px solid #262626',
          borderBottom: '1px solid #262626',
        }}
      >
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="font-mono text-[10px] text-[#6366f1] uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">From zero to fleet in minutes</h2>
          </motion.div>

          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Connector line — desktop only */}
            <div
              className="hidden sm:block absolute top-[2.4rem] left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, rgba(15,98,254,0.4), rgba(99,102,241,0.5), rgba(36,161,72,0.4))',
              }}
            />

            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.14 }}
                className="relative flex flex-col items-center sm:items-start text-center sm:text-left"
              >
                {/* Step icon circle */}
                <div
                  className="relative z-10 mb-5 w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(22,22,22,0.95)',
                    border: `2px solid ${step.color}`,
                    boxShadow: `0 0 28px ${step.glow}`,
                  }}
                >
                  <step.icon className="h-6 w-6" style={{ color: step.color }} />
                </div>

                <div
                  className="font-mono text-[10px] uppercase tracking-widest mb-2"
                  style={{ color: step.color, opacity: 0.7 }}
                >
                  Step {step.step}
                </div>
                <h3 className="font-bold text-white text-base mb-2">{step.title}</h3>
                <p className="text-[12px] text-[#8d8d8d] leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech stack ── */}
      <div
        className="py-8 px-5"
        style={{ borderBottom: '1px solid #2a2a2a' }}
      >
        <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap justify-center">
          <span className="font-mono text-[10px] text-[#525252] uppercase tracking-widest mr-2">Built with</span>
          {techStack.map(t => (
            <span
              key={t}
              className="font-mono text-[10px] text-[#8d8d8d] bg-[#1e1e1e] px-2.5 py-1 transition-colors hover:text-white hover:bg-[#262626]"
              style={{ border: '1px solid #2e2e2e' }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <section className="px-5 py-28 text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Glowing panel behind CTA */}
          <div
            className="relative p-10 overflow-hidden"
            style={{
              background: 'rgba(22,22,22,0.95)',
              border: '1px solid rgba(99,102,241,0.25)',
              boxShadow: '0 0 80px rgba(99,102,241,0.10), 0 0 1px rgba(99,102,241,0.3)',
            }}
          >
            {/* Panel glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 65%)',
              }}
            />
            {/* Top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, #6366f1, #0f62fe, transparent)' }}
            />

            <div className="relative">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 mb-6 font-mono text-[10px] uppercase tracking-wider"
                style={{
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#818cf8',
                }}
              >
                <Zap className="h-3 w-3" />
                Take command
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Ready to take command?</h2>
              <p className="text-[#8d8d8d] text-sm leading-relaxed mb-10">
                Sign in with Google to manage your real fleet, or jump straight into the sandbox
                with simulated servers — no setup required.
              </p>

              <div className="flex items-center justify-center gap-4 flex-wrap">
                <button
                  onClick={onSignIn}
                  className="px-8 py-3.5 text-white font-mono font-bold text-sm uppercase tracking-wider transition-all cursor-pointer hover:scale-[1.03]"
                  style={{
                    background: 'linear-gradient(135deg, #0f62fe 0%, #6366f1 100%)',
                    boxShadow: '0 4px 24px rgba(99,102,241,0.50), 0 1px 0 rgba(255,255,255,0.08) inset',
                  }}
                >
                  Sign In with Google
                </button>
                <button
                  onClick={onSandbox}
                  className="px-8 py-3.5 bg-transparent text-[#c6c6c6] hover:text-white font-mono text-sm uppercase tracking-wider transition-all cursor-pointer hover:border-[#6366f1]"
                  style={{ border: '1px solid #393939' }}
                >
                  Sandbox Mode
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="py-6 px-5 text-center text-[11px] text-[#525252] flex items-center justify-center gap-3 flex-wrap"
        style={{ borderTop: '1px solid #262626' }}
      >
        <span>Built by</span>
        <a
          href="https://buildwithshashank.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#6366f1] hover:text-[#818cf8] font-semibold transition-colors"
        >
          BuildWithShashank
        </a>
        <span className="text-[#393939]">·</span>
        {[
          { label: 'GitHub', href: 'https://github.com/shashankshekhar2909' },
          { label: 'LinkedIn', href: 'https://linkedin.com/in/shashankshekhar2k15' },
          { label: 'Reddit', href: 'https://www.reddit.com/user/s_shekhar29/' },
          { label: 'Website', href: 'https://buildwithshashank.com' },
        ].map(s => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#525252] hover:text-[#6366f1] transition-colors"
          >
            {s.label}
          </a>
        ))}
      </footer>
    </div>
  );
}
