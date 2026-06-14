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
    color: '#0f62fe',
    bg: 'rgba(15,98,254,0.08)',
    border: 'rgba(15,98,254,0.25)',
  },
  {
    icon: Cpu,
    title: 'Live Telemetry',
    description: 'CPU, RAM, and disk polled every 30s for physical hosts. Persistent historical charts per node.',
    color: '#24a148',
    bg: 'rgba(36,161,72,0.08)',
    border: 'rgba(36,161,72,0.25)',
  },
  {
    icon: Bot,
    title: 'AI ReAct Agent',
    description: 'Ask natural-language questions. The agent translates intent to SSH commands, executes, and explains results.',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.25)',
  },
  {
    icon: Terminal,
    title: 'Docker Management',
    description: 'List, start, stop, and restart containers per host. Live status with port mappings — no CLI needed.',
    color: '#ee5396',
    bg: 'rgba(238,83,150,0.08)',
    border: 'rgba(238,83,150,0.25)',
  },
  {
    icon: Box,
    title: 'ProxMox LXC',
    description: 'Chain into ProxMox — list LXC containers, manage Docker inside each via pct exec. Full nesting support.',
    color: '#f1c21b',
    bg: 'rgba(241,194,27,0.08)',
    border: 'rgba(241,194,27,0.25)',
  },
  {
    icon: Mic,
    title: 'Voice Interface',
    description: 'Calibrated speech recognition for voice-driven SSH queries. Speak to your fleet.',
    color: '#ff7eb6',
    bg: 'rgba(255,126,182,0.08)',
    border: 'rgba(255,126,182,0.25)',
  },
  {
    icon: Users,
    title: 'Multi-User Roles',
    description: 'Admin and Viewer roles via Firebase Auth. Shared fleet state synced via Firestore across all operators.',
    color: '#42be65',
    bg: 'rgba(66,190,101,0.08)',
    border: 'rgba(66,190,101,0.25)',
  },
  {
    icon: Lock,
    title: 'AES-256 Security',
    description: 'Credentials encrypted at rest. Sandbox mode for public demos — real SSH is never exposed.',
    color: '#78a9ff',
    bg: 'rgba(120,169,255,0.08)',
    border: 'rgba(120,169,255,0.25)',
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
  { text: "→ Action: docker ps --filter status=running | wc -l", color: '#78a9ff', delay: 1.4 },
  { text: '← Output: 7', color: '#8d8d8d', delay: 1.9 },
  { text: '✓ Reply: 7 containers running on Production Gateway.', color: '#42be65', delay: 2.4 },
];

export default function HomePage({ onSignIn, onSandbox }: HomePageProps) {
  return (
    <div className="min-h-screen bg-[#161616] text-[#f4f4f4] font-sans overflow-x-hidden">
      {/* Dot-grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Sticky nav */}
      <header className="sticky top-0 z-50 bg-[#161616]/90 backdrop-blur-md border-b border-[#393939] h-14 px-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-[#0f62fe] text-white shrink-0">
            <Bot className="h-4 w-4" />
          </div>
          <span className="font-semibold text-[13px] text-white">BuildOS Node Commander</span>
          <span className="hidden sm:inline bg-[#0f62fe]/15 text-[#78a9ff] font-mono text-[9px] px-2 py-0.5 border border-[#0f62fe]/30">
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
            className="px-4 py-2 bg-[#0f62fe] hover:bg-[#0353e9] text-white font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-5 pt-20 pb-16 text-center max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 bg-[#6366f1]/10 border border-[#6366f1]/30 px-3 py-1.5 mb-8 text-[#818cf8] font-mono text-[10px] uppercase tracking-wider">
            <Zap className="h-3 w-3" />
            <span>Self-hosted SSH fleet manager</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.15] tracking-tight mb-6">
            Command your entire<br />
            <span
              style={{
                background: 'linear-gradient(130deg, #6366f1 0%, #0f62fe 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Linux fleet
            </span>{' '}
            with AI
          </h1>

          <p className="text-[#8d8d8d] text-base sm:text-[1.05rem] leading-relaxed max-w-2xl mx-auto mb-10">
            SSH into any server, monitor live telemetry, manage Docker containers,
            and ask your AI agent to run diagnostics — all from one dashboard.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={onSignIn}
              className="px-8 py-3 bg-[#0f62fe] hover:bg-[#0353e9] text-white font-mono font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer"
            >
              Get Started
            </button>
            <button
              onClick={onSandbox}
              className="px-8 py-3 bg-transparent border border-[#393939] hover:border-[#6366f1] text-[#c6c6c6] hover:text-white font-mono text-sm uppercase tracking-wider transition-colors cursor-pointer"
            >
              Live Demo →
            </button>
          </div>
        </motion.div>

        {/* Animated terminal */}
        <motion.div
          initial={{ opacity: 0, y: 44 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="mt-16 bg-[#1e1e1e] border border-[#393939] overflow-hidden text-left shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
        >
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#161616] border-b border-[#393939]">
            <div className="h-2.5 w-2.5 rounded-full bg-[#da1e28]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#f1c21b]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#24a148]" />
            <span className="ml-3 font-mono text-[11px] text-[#6f6f6f]">buildos-agent · AI ReAct Loop</span>
            <div className="ml-auto flex items-center gap-1.5 text-[#42be65]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#24a148] animate-pulse" />
              <span className="font-mono text-[10px]">LIVE</span>
            </div>
          </div>

          <div className="p-5 font-mono text-[12px] space-y-2 min-h-[9rem]">
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
              className="inline-block w-2 h-3.5 bg-[#6366f1] align-middle mt-1"
            />
          </div>
        </motion.div>
      </section>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="border-t border-b border-[#393939] py-5 px-5"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: '∞', label: 'Hosts' },
            { value: 'AI', label: 'ReAct Agent' },
            { value: '30s', label: 'Telemetry Poll' },
            { value: 'AES-256', label: 'Credential Encryption' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-lg font-bold text-[#6366f1] font-mono">{stat.value}</div>
              <div className="text-[10px] text-[#6f6f6f] uppercase tracking-wider mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Features grid */}
      <section className="px-5 py-20 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="font-mono text-[10px] text-[#6366f1] uppercase tracking-wider mb-3">What's inside</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Everything you need to run a fleet</h2>
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
              style={{
                backgroundColor: feat.bg,
                borderColor: feat.border,
                border: `1px solid ${feat.border}`,
              }}
              className="p-5 cursor-default"
            >
              <div style={{ color: feat.color }} className="mb-3">
                <feat.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-sm mb-1.5 font-mono">{feat.title}</h3>
              <p className="text-[11px] text-[#8d8d8d] leading-relaxed">{feat.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 py-16 bg-[#1a1a1a] border-t border-b border-[#393939]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="font-mono text-[10px] text-[#6366f1] uppercase tracking-wider mb-3">How it works</p>
            <h2 className="text-2xl font-bold text-white">From zero to fleet in minutes</h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: ShieldCheck,
                title: 'Sign in',
                description: 'Google SSO. Your email is checked against an authorized roles list in Firestore.',
                color: '#0f62fe',
              },
              {
                step: '02',
                icon: Globe,
                title: 'Add a host',
                description: 'Enter IP, port, username, and SSH credentials. They\'re AES-256 encrypted on save.',
                color: '#6366f1',
              },
              {
                step: '03',
                icon: GitBranch,
                title: 'Command & monitor',
                description: 'Open the terminal, ask the AI agent, or manage Docker — real-time, from any browser.',
                color: '#24a148',
              },
            ].map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative"
              >
                <div className="font-mono text-[10px] text-[#525252] mb-3 uppercase tracking-wider">Step {step.step}</div>
                <div style={{ color: step.color }} className="mb-3">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-white text-sm mb-2">{step.title}</h3>
                <p className="text-[12px] text-[#8d8d8d] leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <div className="border-b border-[#393939] py-7 px-5">
        <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap justify-center">
          <span className="font-mono text-[10px] text-[#525252] uppercase tracking-wider mr-2">Built with</span>
          {techStack.map(t => (
            <span
              key={t}
              className="font-mono text-[10px] text-[#8d8d8d] bg-[#262626] border border-[#393939] px-2.5 py-1"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <section className="px-5 py-24 text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Ready to take command?</h2>
          <p className="text-[#8d8d8d] text-sm leading-relaxed mb-10">
            Sign in with Google to manage your real fleet, or jump straight into the sandbox with simulated servers — no setup required.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={onSignIn}
              className="px-8 py-3 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-mono font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer"
            >
              Sign In with Google
            </button>
            <button
              onClick={onSandbox}
              className="px-8 py-3 border border-[#393939] hover:border-[#6366f1] text-[#c6c6c6] hover:text-white font-mono text-sm uppercase tracking-wider transition-colors cursor-pointer"
            >
              Sandbox Mode
            </button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#393939] py-6 px-5 text-center text-[11px] text-[#525252] flex items-center justify-center gap-3 flex-wrap">
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
