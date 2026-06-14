import React, { useState, useEffect } from 'react';
import { X, Server, Key, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { HostMachine, AuthType } from '../types';

interface AddHostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (host: Omit<HostMachine, 'id'> & { id?: string }) => void;
  editingHost?: HostMachine | null;
  forceSimulated?: boolean; // guest/demo mode: lock to simulated only
}

export default function AddHostModal({ isOpen, onClose, onSave, editingHost, forceSimulated = false }: AddHostModalProps) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<AuthType>('password');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [isSimulated, setIsSimulated] = useState(true);
  const [proxmox, setProxmox] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (editingHost) {
      setName(editingHost.name);
      setIp(editingHost.ip);
      setPort(editingHost.port);
      setUsername(editingHost.username);
      setAuthType(editingHost.authType);
      setPassword(editingHost.password ? (editingHost.password.startsWith('ENC:') ? '••••••••••••' : editingHost.password) : '');
      setPrivateKey(editingHost.privateKey ? (editingHost.privateKey.startsWith('ENC:') ? '••••••••••••' : editingHost.privateKey) : '');
      setIsSimulated(editingHost.isSimulated);
      setProxmox(editingHost.proxmox ?? false);
    } else {
      setName('');
      setIp('');
      setPort(22);
      setUsername('root');
      setAuthType('password');
      setPassword('');
      setPrivateKey('');
      setIsSimulated(true);
      setProxmox(false);
    }
  }, [editingHost, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: editingHost?.id,
      name: name || `${ip}:${port}`,
      ip,
      port,
      username,
      authType,
      password: authType === 'password' ? password : '',
      privateKey: authType === 'privateKey' ? privateKey : '',
      isSimulated,
      proxmox
    });
  };

  return (
    <div id="add-host-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in">
      <div id="add-host-modal-container" className="bg-[#262626] border border-[#393939] rounded-none w-full max-w-lg shadow-xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-[#393939] flex items-center justify-between bg-[#161616]">
          <div className="flex items-center gap-2.5 text-[#78a9ff] font-bold font-mono uppercase tracking-wider text-xs">
            <Server className="h-4.5 w-4.5" />
            <span className="text-white">{editingHost ? 'Configure Node Settings' : 'Add New Host Node'}</span>
          </div>
          <button id="close-modal-btn" onClick={onClose} className="p-1.5 rounded-none text-[#8d8d8d] hover:bg-[#393939] hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Sandbox mode notice */}
          {forceSimulated && (
            <div className="bg-[#f1c21b]/8 border border-[#f1c21b]/30 p-3 flex items-start gap-2.5">
              <span className="text-[#f1c21b] text-[11px] font-mono font-bold shrink-0">⚡ SANDBOX</span>
              <p className="text-[11px] text-[#a8a8a8] font-sans leading-relaxed">
                You're in sandbox mode. Nodes are simulated — no real SSH connections are made. Sign in to connect real servers.
              </p>
            </div>
          )}

          {/* Simulation toggle — locked in sandbox/guest mode */}
          <div className={`bg-[#161616] border border-[#393939] p-4 rounded-none flex items-start gap-3 ${forceSimulated ? 'opacity-50 pointer-events-none' : ''}`}>
            <input
              type="checkbox"
              id="isSimulated"
              checked={forceSimulated || isSimulated}
              onChange={(e) => !forceSimulated && setIsSimulated(e.target.checked)}
              className="mt-1 h-4 w-4 bg-[#262626] border-[#393939] text-[#0f62fe] focus:ring-0 rounded-none focus:ring-offset-0"
              disabled={forceSimulated}
            />
            <div className="flex-1">
              <label htmlFor="isSimulated" className="text-xs font-bold text-slate-100 cursor-pointer block select-none uppercase tracking-wider font-mono">
                {forceSimulated ? 'Simulated Node (locked in sandbox mode)' : 'Local Simulator Mode (Active by Default)'}
              </label>
              <p className="text-[11px] text-[#8d8d8d] mt-0.5 leading-relaxed font-sans">
                Generates robust, live simulated docker metrics, resources, and ports. Toggle off to connect utilizing real physical SSH credentials.
              </p>
            </div>
          </div>

          {/* ProxMox toggle — only meaningful for real hosts, hidden in sandbox */}
          {!isSimulated && !forceSimulated && (
            <div className="bg-[#161616] border border-[#f1c21b]/30 p-4 rounded-none flex items-start gap-3">
              <input
                type="checkbox"
                id="proxmox"
                checked={proxmox}
                onChange={(e) => setProxmox(e.target.checked)}
                className="mt-1 h-4 w-4 bg-[#262626] border-[#393939] text-[#f1c21b] focus:ring-0 rounded-none focus:ring-offset-0"
              />
              <div className="flex-1">
                <label htmlFor="proxmox" className="text-xs font-bold text-[#f1c21b] cursor-pointer block select-none uppercase tracking-wider font-mono">
                  ProxMox Host
                </label>
                <p className="text-[11px] text-[#8d8d8d] mt-0.5 leading-relaxed font-sans">
                  Enables the LXC container management tab. Allows listing, starting, stopping LXC containers and managing Docker inside each via <code className="font-mono text-[#78a9ff]">pct exec</code>.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block mb-1.5 font-mono">Node Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Home Lab Server"
                className="w-full bg-[#161616] border border-[#393939] rounded-none px-3 py-2 text-white text-xs font-sans focus:outline-none focus:border-[#0f62fe] transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block mb-1.5 font-mono">IP Address / Hostname</label>
              <input
                type="text"
                required
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="e.g. 192.168.1.100"
                className="w-full bg-[#161616] border border-[#393939] rounded-none px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#0f62fe] transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block mb-1.5 font-mono">Port</label>
              <input
                type="number"
                required
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-[#161616] border border-[#393939] rounded-none px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#0f62fe] transition"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block mb-1.5 font-mono">SSH Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#161616] border border-[#393939] rounded-none px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#0f62fe] transition"
              />
            </div>
          </div>

          {!isSimulated && (
            <div className="bg-[#0f62fe]/10 border border-[#0f62fe]/40 p-3.5 rounded-none flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-[#78a9ff] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#a8a8a8] leading-relaxed font-sans">
                Ensure this sandboxed agent container has web access and ports opened to route traffic successfully to your host IP.
              </p>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block mb-1.5 font-mono">Authentication Method</label>
            <div className="grid grid-cols-3 gap-2">
              {(['password', 'privateKey', 'none'] as AuthType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAuthType(type)}
                  className={`py-2 px-3 rounded-none text-xs uppercase font-mono font-semibold tracking-wider border transition duration-150 ${
                    authType === type
                      ? 'bg-[#0f62fe] border-[#0f62fe] text-white'
                      : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:bg-[#313131]'
                  }`}
                >
                  {type === 'privateKey' ? 'SSH Key' : type}
                </button>
              ))}
            </div>
          </div>

          {authType === 'password' && (
            <div className="relative">
              <label className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block mb-1.5 font-mono">SSH Password</label>
              <input
                type={showSecret ? 'text' : 'password'}
                value={password || ''}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-[#161616] border border-[#393939] rounded-none px-3 py-2 pr-10 text-white text-xs focus:outline-none focus:border-[#0f62fe] transition"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-8 text-[#8d8d8d] hover:text-white transition"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}

          {authType === 'privateKey' && (
            <div>
              <label className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block mb-1.5 font-mono">SSH Private Key</label>
              <textarea
                rows={5}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                className="w-full bg-[#161616] border border-[#393939] rounded-none px-3 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-[#0f62fe] block leading-relaxed"
              />
            </div>
          )}

          <div className="pt-4 border-t border-[#393939] flex items-center justify-end gap-3 bg-transparent">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#393939] border border-[#393939] text-white hover:bg-[#4d4d4d] rounded-none text-xs font-mono font-semibold uppercase tracking-wider transition duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0f62fe] hover:bg-[#0353e9] text-white border border-[#0f62fe] rounded-none text-xs font-mono font-bold uppercase tracking-wider transition duration-150 flex items-center gap-1.5"
            >
              <Key className="h-4 w-4" />
              <span>{editingHost ? 'Save Changes' : 'Connect Node'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
