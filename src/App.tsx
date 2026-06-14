import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  Cpu,
  Layers,
  Bot,
  Terminal,
  Settings,
  MessageSquare,
  History,
  TerminalSquare,
  ShieldCheck,
  Code,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { HostMachine, TerminalLog, LLMConfig, ChatMessage } from './types';
import HostCard from './components/HostCard';
import SSHConsole from './components/SSHConsole';
import VoiceAgent from './components/VoiceAgent';
import LLMConfigPanel from './components/LLMConfigPanel';
import WhatsAppPreview from './components/WhatsAppPreview';
import AddHostModal from './components/AddHostModal';
import UserManagementPanel from './components/UserManagementPanel';
import NodeMonitor from './components/NodeMonitor';

// Firebase operations
import { auth, loginWithGoogle, logoutUser } from './lib/firebase';
import { 
  subscribeHosts, 
  subscribeChats, 
  subscribeLogs, 
  addFirestoreHost, 
  updateFirestoreHost, 
  deleteFirestoreHost, 
  addFirestoreLog, 
  addFirestoreChat, 
  clearFirestoreChats 
} from './lib/firestore_sync';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('buildos-theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
      localStorage.setItem('buildos-theme', 'light');
    } else {
      document.documentElement.classList.remove('light-mode');
      localStorage.setItem('buildos-theme', 'dark');
    }
  }, [theme]);

  const [hosts, setHosts] = useState<HostMachine[]>([]);
  const [activeHostId, setActiveHostId] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostMachine | null>(null);
  const [activeTab, setActiveTab] = useState<'infrastructure' | 'whatsapp' | 'brain'>('infrastructure');
  
  // Real-time UTC Clock
  const [utcTime, setUtcTime] = useState('');

  // Firebase Authentication & User management States
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [authorizedRole, setAuthorizedRole] = useState<'admin' | 'viewer' | null>(null);
  const [isUnauthorizedUser, setIsUnauthorizedUser] = useState(false);

  // Fallback Local JSON endpoints for Guest / Sandbox mode
  const fetchHosts = async () => {
    try {
      const res = await fetch('/api/hosts');
      const data = await res.json();
      setHosts(data);
      if (data.length > 0 && !activeHostId) {
        setActiveHostId(data[0].id);
      }
    } catch (e) {
      console.error('Error fetching guest base hosts:', e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/terminal-logs');
      const data = await res.json();
      setTerminalLogs(data);
    } catch (e) {
      console.error('Error fetching guest terminal logs:', e);
    }
  };

  // Google Firebase Authentication state stream listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthLoading(true);
        const email = user.email?.trim().toLowerCase() || '';
        
        if (email === 'sunnyrocks1122@gmail.com') {
          setAuthorizedRole('admin');
          setIsUnauthorizedUser(false);
          setCurrentUser(user);
          setIsGuestMode(false);
          setIsAuthLoading(false);
          
          // Seed the database
          try {
            await setDoc(doc(db, 'authorizedUsers', 'sunnyrocks1122@gmail.com'), {
              email: 'sunnyrocks1122@gmail.com',
              role: 'admin',
              createdAt: new Date().toISOString()
            });
          } catch (e) {
            console.error('Failed to auto-seed main administrator document:', e);
          }
        } else {
          try {
            const docSnap = await getDoc(doc(db, 'authorizedUsers', email));
            if (docSnap.exists()) {
              const role = docSnap.data().role as 'admin' | 'viewer';
              setAuthorizedRole(role);
              setIsUnauthorizedUser(false);
              setCurrentUser(user);
              setIsGuestMode(false);
            } else {
              setAuthorizedRole(null);
              setIsUnauthorizedUser(true);
              setCurrentUser(null);
            }
          } catch (e) {
            console.error('Authorization check error:', e);
            setAuthorizedRole(null);
            setIsUnauthorizedUser(true);
            setCurrentUser(null);
          } finally {
            setIsAuthLoading(false);
          }
        }
      } else {
        setCurrentUser(null);
        setAuthorizedRole(null);
        setIsUnauthorizedUser(false);
        setIsAuthLoading(false);
      }
    });

    // Real-time UTC clock updater
    const interval = setInterval(() => {
      const now = new Date();
      setUtcTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Sync Cloud Firestore Hosts on Auth Change
  useEffect(() => {
    if (!currentUser) {
      if (isGuestMode) {
        fetchHosts();
      } else {
        setHosts([]);
        setActiveHostId(null);
      }
      return;
    }

    // Attach real-time cloud listener to the CENTRAL FLEET so all authorized operators share nodes
    const unsubscribe = subscribeHosts('central_fleet', (syncedHosts) => {
      setHosts(syncedHosts);
      if (syncedHosts.length > 0 && !activeHostId) {
        setActiveHostId(syncedHosts[0].id);
      }
    });

    return () => {
      unsubscribe && unsubscribe();
    };
  }, [currentUser, isGuestMode]);

  // Sync Cloud Firestore Audit Logs on Auth Change
  useEffect(() => {
    if (!currentUser) {
      if (isGuestMode) {
        fetchLogs();
      } else {
        setTerminalLogs([]);
      }
      return;
    }

    // Attach real-time security audit listener to the CENTRAL FLEET log trails
    const unsubscribe = subscribeLogs('central_fleet', (syncedLogs) => {
      setTerminalLogs(syncedLogs);
    });

    return () => {
      unsubscribe && unsubscribe();
    };
  }, [currentUser, isGuestMode]);

  // Sync Cloud Firestore Chat logs on Auth Change
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (!currentUser) {
      setMessages([
        {
          id: 'welcome',
          sender: 'agent',
          text: "👋 I am your SSH Host Agent. Select any server on the dashboard or tell me what to check. I can run commands, count docker containers, find open ports, and review resources directly.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      return;
    }

    const unsubscribe = subscribeChats(currentUser.uid, (syncedChats) => {
      if (syncedChats.length === 0) {
        const welcomeStr = "👋 I am your SSH Host Agent. Select any server on the dashboard or tell me what to check. I can run commands, count docker containers, find open ports, and review resources directly.";
        addFirestoreChat(currentUser.uid, {
          userId: currentUser.uid,
          sender: 'agent',
          text: welcomeStr,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isVoice: false
        });
      } else {
        setMessages(syncedChats);
      }
    });

    return () => {
      unsubscribe && unsubscribe();
    };
  }, [currentUser, isGuestMode]);

  // Handle local telemetry update interval for simulated devices
  useEffect(() => {
    const metricsInterval = setInterval(() => {
      setHosts(prev => prev.map(h => {
        if (h.isSimulated && h.simulatedStats) {
          const s = h.simulatedStats;
          return {
            ...h,
            simulatedStats: {
              ...s,
              cpu: Math.min(99, Math.max(2, Math.floor(s.cpu + (Math.random() * 8 - 4)))),
              ram: Math.min(32, Math.max(1, +(s.ram + (Math.random() * 0.1 - 0.05)).toFixed(1)))
            }
          };
        }
        return h;
      }));
    }, 6000);

    return () => {
      clearInterval(metricsInterval);
    };
  }, []);

  const handleCreateOrUpdateHost = async (hostData: Omit<HostMachine, 'id'> & { id?: string }) => {
    try {
      const processedHost = { ...hostData };
      const originalHost = hosts.find(h => h.id === hostData.id);

      // Secure client-side credentials protection pre-processing before Firestore / API write
      if (processedHost.password === '••••••••••••') {
        processedHost.password = originalHost?.password || '';
      } else if (processedHost.password && !processedHost.password.startsWith('ENC:')) {
        const res = await fetch('/api/security/encrypt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: processedHost.password })
        });
        const data = await res.json();
        processedHost.password = data.encrypted;
      }

      if (processedHost.privateKey === '••••••••••••') {
        processedHost.privateKey = originalHost?.privateKey || '';
      } else if (processedHost.privateKey && !processedHost.privateKey.startsWith('ENC:')) {
        const res = await fetch('/api/security/encrypt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: processedHost.privateKey })
        });
        const data = await res.json();
        processedHost.privateKey = data.encrypted;
      }

      if (currentUser) {
        if (processedHost.id) {
          await updateFirestoreHost('central_fleet', processedHost.id, processedHost);
        } else {
          await addFirestoreHost('central_fleet', processedHost);
        }
      } else {
        // Fallback for Local Guest accounts
        const url = processedHost.id ? `/api/hosts/${processedHost.id}` : '/api/hosts';
        const method = processedHost.id ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(processedHost)
        });
        const data = await res.json();

        if (processedHost.id) {
          setHosts(prev => prev.map(h => h.id === processedHost.id ? data : h));
        } else {
          setHosts(prev => [...prev, data]);
          setActiveHostId(data.id);
        }
      }

      setIsAddModalOpen(false);
      setEditingHost(null);
    } catch (e) {
      console.error('Error saving host node:', e);
    }
  };

  const handleDeleteHost = async (id: string) => {
    if (!confirm('Are you absolutely sure you want to isolate and disconnect this host machine node?')) return;
    try {
      if (currentUser) {
        await deleteFirestoreHost('central_fleet', id);
      } else {
        await fetch(`/api/hosts/${id}`, { method: 'DELETE' });
        setHosts(prev => prev.filter(h => h.id !== id));
      }
      if (activeHostId === id) {
        setActiveHostId(null);
      }
    } catch (e) {
      console.error('Error deleting host node:', e);
    }
  };

  const handleLoggedCommand = async (command: string, output: string, isError: boolean) => {
    if (currentUser) {
      await addFirestoreLog('central_fleet', {
        userId: currentUser.uid,
        hostId: activeHostId || 'generic',
        hostName: activeHost ? activeHost.name : 'Console shell',
        timestamp: new Date().toISOString(),
        command,
        output,
        isError
      });
    } else {
      // Local fallback logs refresh
      fetchLogs();
    }
  };

  const handleAddChatMessage = async (msg: Omit<ChatMessage, 'id'>) => {
    if (currentUser) {
      await addFirestoreChat(currentUser.uid, {
        userId: currentUser.uid,
        ...msg
      });
    } else {
      setMessages(prev => [
        ...prev,
        {
          id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          ...msg
        }
      ]);
    }
  };

  const handleClearMessages = async () => {
    if (currentUser) {
      await clearFirestoreChats(currentUser.uid);
    } else {
      setMessages([
        {
          id: 'welcome',
          sender: 'agent',
          text: "👋 I am your SSH Host Agent. Select any server on the dashboard or tell me what to check. I can run commands, count docker containers, find open ports, and review resources directly.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const handleApplyConfig = (config: LLMConfig) => {
    console.log('Main LLM system updated:', config.provider);
  };

  const activeHost = hosts.find(h => h.id === activeHostId) || null;

  // Render authenticating screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#161616] text-[#f4f4f4] flex flex-col items-center justify-center relative font-mono text-xs">
        <div className="text-center flex flex-col items-center">
          <Bot className="h-8 w-8 text-[#0f62fe] animate-spin mb-4" />
          <h2 className="text-xs tracking-wider uppercase">BuildOS Connection Establishing...</h2>
          <p className="text-[10px] text-[#8d8d8d] mt-2">CHECKING GOOGLE FIREBASE SECURITY HANDSHAKE STATE...</p>
        </div>
      </div>
    );
  }

  // Render secure IBM Carbon style login gate wall
  if (!currentUser && !isGuestMode) {
    return (
      <div className="min-h-screen bg-[#161616] text-[#f4f4f4] flex flex-col justify-between relative font-sans">
        
        {/* Dummy spacer */}
        <div></div>

        {/* Center Card */}
        <div className="flex items-center justify-center p-4 relative z-10">
          <div className="w-full max-w-sm bg-[#262626] border border-[#393939] rounded-none p-8 shadow-md flex flex-col text-center">
            {isUnauthorizedUser ? (
              <>
                <div className="mx-auto p-4 bg-[#da1e28]/10 border border-[#da1e28]/35 rounded-none text-[#ff8389] mb-6">
                  <ShieldCheck className="h-8 w-8 text-[#ff8389] animate-pulse" />
                </div>
                
                <h1 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Access Blocked
                </h1>
                <p className="text-[10px] text-[#ff8389] font-mono mt-1.5 uppercase tracking-wider font-semibold">
                  Operator Registration Required
                </p>

                <div className="border-[#393939] border-t my-6"></div>

                <p className="text-xs text-[#c6c6c6] leading-relaxed mb-6 font-sans">
                  The authenticated Google account is not whitelisted. Access is restricted to registered members to protect secure terminal endpoints.
                </p>

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={async () => {
                      await logoutUser();
                      setIsUnauthorizedUser(false);
                    }}
                    className="w-full bg-[#393939] hover:bg-[#4d4d4d] text-white font-mono font-bold text-xs py-3 px-4 rounded-none transition-all uppercase tracking-wider cursor-pointer"
                  >
                    Disconnect operational session
                  </button>
                  <button
                    onClick={() => {
                      setIsGuestMode(true);
                      setIsUnauthorizedUser(false);
                    }}
                    className="py-2 px-4 text-[#8d8d8d] hover:text-white font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer underline decoration-[#8d8d8d]"
                  >
                    Enter Guest Sandbox
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto p-4 bg-[#161616] border border-[#393939] rounded-none text-[#78a9ff] mb-6">
                  <Bot className="h-8 w-8" />
                </div>
                
                <h1 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  BuildOS Node Commander
                </h1>
                <p className="text-[10px] text-[#8d8d8d] font-mono mt-1.5 uppercase tracking-wider">
                  TELEMETRY & VOICE MONITOR
                </p>

                <div className="border-[#393939] border-t my-6"></div>

                <p className="text-xs text-[#c6c6c6] leading-relaxed mb-6 font-sans">
                  Connect via Google Cloud security handshake. Synced storage keeps server nodes, system state audits and LLM parameters persistent across execution instances.
                </p>

                {/* Google Identity Authorization */}
                <button
                  onClick={loginWithGoogle}
                  className="w-full bg-[#0f62fe] hover:bg-[#0353e9] text-white font-bold font-mono text-xs py-3 px-4 rounded-none transition-all flex items-center justify-center gap-2.5 cursor-pointer uppercase tracking-wider"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#ffffff"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#ffffff"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#ffffff"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z"
                    />
                    <path
                      fill="#ffffff"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Verify operational token</span>
                </button>

                {/* Sandbox bypass */}
                <div className="flex items-center gap-2.5 my-4 select-none">
                  <div className="flex-grow border-t border-[#393939]"></div>
                  <span className="text-[9px] font-mono text-[#8d8d8d] tracking-wider">OR</span>
                  <div className="flex-grow border-t border-[#393939]"></div>
                </div>

                <button
                  onClick={() => setIsGuestMode(true)}
                  className="py-2.5 px-4 bg-[#161616] hover:bg-[#202020] border border-[#393939] text-[#c6c6c6] hover:text-white font-mono text-[10px] font-bold uppercase tracking-wider transition-all duration-150 rounded-none cursor-pointer"
                >
                  Enter Sandbox Mode
                </button>
              </>
            )}
          </div>
        </div>

        {/* Outer security credit */}
        <div className="py-6 text-center text-[10px] text-[#6f6f6f] font-mono select-none">
          SECURE ENVELOPE HANDSHAKE VERIFIED ● TRANSPARENT DATA STORAGE
        </div>
      </div>
    );
  }

  return (
    <div id="application-container" className="min-h-screen bg-[#161616] text-[#f4f4f4] flex flex-col font-sans selection:bg-[#0f62fe]/20 relative">
      
      {/* Top Navigation Frame */}
      <header className="bg-[#161616] border-b border-[#393939] py-3.5 px-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0f62fe] text-white rounded-none">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-xs uppercase tracking-wider text-white font-mono select-none">BuildOS Node Commander</h1>
                <span className="bg-[#262626] text-[#78a9ff] font-mono text-[9px] px-2 py-0.5 border border-[#393939]">
                  V1.5.0 STABLE
                </span>
              </div>
              <p className="text-[10px] text-[#8d8d8d] uppercase tracking-wide font-mono mt-0.5">SSH Telemetry Terminal & Cognitive Agent Gateway</p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Theme Toggle Button */}
            <button
              id="theme-toggle"
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="p-1.5 px-3 bg-[#262626] hover:bg-[#393939] border border-[#393939] text-[#c6c6c6] hover:text-white font-mono text-[10px] font-bold tracking-wider uppercase transition rounded-none flex items-center gap-1.5 cursor-pointer"
              title="Switch between Light & Dark theme modes"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="h-3.5 w-3.5 text-[#0f62fe]" />
                  <span>DARK MODE</span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-yellow-500 animate-pulse" />
                  <span>LIGHT MODE</span>
                </>
              )}
            </button>

            {/* UTC Real-time Clock */}
            <div className="hidden sm:block text-right">
              <span className="text-[9px] font-mono text-[#8d8d8d] uppercase tracking-wider block">Terminal Clock</span>
              <span className="font-mono text-xs text-[#c6c6c6] font-semibold">{utcTime || 'Syncing...'}</span>
            </div>

            {/* Quick Status */}
            <div className="flex items-center gap-2 bg-[#262626] px-3 py-1.5 border border-[#393939] text-[11px] font-mono uppercase text-[#42be65]">
              <div className="h-1.5 w-1.5 bg-[#24a148]" />
              <span>{hosts.length} Node{hosts.length !== 1 && 's'} Connected</span>
            </div>

            {/* User Profile & Sign Out options */}
            {currentUser ? (
              <div className="flex items-center gap-3 bg-[#262626] border border-[#393939] p-1 pr-3 rounded-none">
                <img 
                  src={currentUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.uid}`}
                  alt={currentUser.displayName || 'Me'}
                  className="h-8 w-8 rounded-none border border-[#393939] shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="hidden md:block text-left max-w-[120px]">
                  <span className="text-[9px] text-[#8d8d8d] block font-mono">USER_OPERATOR</span>
                  <span className="text-xs text-white font-bold block truncate max-w-[110px]">
                    {currentUser.displayName || currentUser.email}
                  </span>
                </div>
                <button
                  onClick={logoutUser}
                  className="bg-[#161616] hover:bg-[#393939] p-1.5 border border-[#393939] text-[#8d8d8d] hover:text-[#ff8389] transition-all cursor-pointer rounded-none"
                  title="Disconnect user profile and log out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : isGuestMode ? (
              <div className="flex items-center gap-2.5 bg-[#fe1f2a]/10 border border-[#fe1f2a]/35 py-1.5 px-3.5 text-xs rounded-none">
                <span className="h-2 w-2 rounded-none bg-[#fe1f2a] animate-pulse shrink-0" />
                <span className="text-[10px] font-bold text-[#ff8389] uppercase tracking-widest font-mono">Sandbox Sandbox</span>
                <button
                  onClick={() => setIsGuestMode(false)}
                  className="text-slate-400 hover:text-white font-semibold underline pl-1"
                >
                  Sign In
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Primary Layout Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto py-6 px-4 md:px-6 space-y-6 relative z-10">
        
        {/* Tab Selector Section */}
        <div className="flex items-center justify-between border-b border-[#393939] pb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('infrastructure')}
              className={`px-4 py-2 rounded-none text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-150 border cursor-pointer ${
                activeTab === 'infrastructure'
                  ? 'bg-[#0f62fe] border-[#0f62fe] text-white'
                  : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:bg-[#202020] hover:text-white'
              }`}
            >
              <Server className="h-3.5 w-3.5" />
              <span>NODES_LIST</span>
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`px-4 py-2 rounded-none text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-150 border cursor-pointer ${
                activeTab === 'whatsapp'
                  ? 'bg-[#0f62fe] border-[#0f62fe] text-white'
                  : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:bg-[#202020] hover:text-white'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>SMS_WEBHOOK</span>
            </button>
            <button
              onClick={() => setActiveTab('brain')}
              className={`px-4 py-2 rounded-none text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-150 border cursor-pointer ${
                activeTab === 'brain'
                  ? 'bg-[#0f62fe] border-[#0f62fe] text-white'
                  : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:bg-[#202020] hover:text-white'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>BRAIN_PARAMS</span>
            </button>
          </div>

          {activeTab === 'infrastructure' && (isGuestMode || authorizedRole === 'admin') && (
            <button
              onClick={() => {
                setEditingHost(null);
                setIsAddModalOpen(true);
              }}
              className="bg-[#0f62fe] hover:bg-[#0353e9] text-white border border-[#0f62fe] rounded-none text-xs font-mono font-bold tracking-wider uppercase px-4 py-2 flex items-center gap-2 transition-all duration-150 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Register Node</span>
            </button>
          )}
        </div>

        {/* Tab Contents */}
        {activeTab === 'infrastructure' && (
          <div className="space-y-6">
            {/* Host Machines list Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#393939] pb-2 font-mono">
                <h2 className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block">ACTIVE INSTANCE SYSTEM METRICS</h2>
                <span className="text-[9px] text-[#8d8d8d] uppercase tracking-wider select-none">Live Telemetry refreshed every 6s</span>
              </div>

              {hosts.length === 0 ? (
                <div id="no-hosts-status" className="border border-[#393939] bg-[#262626] p-14 rounded-none text-center flex flex-col items-center justify-center">
                  <Server className="h-10 w-10 text-[#8d8d8d] mb-4" />
                  <h3 className="font-bold font-mono text-white text-xs uppercase tracking-wider">No Nodes Registered</h3>
                  <p className="text-xs text-[#a8a8a8] max-w-sm mt-1.5 mb-5 font-sans leading-relaxed">
                    Create instant virtual sandbox mock nodes or provision real physical VPS home target machines by attaching ssh keys on the dashboard interface.
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-[#0f62fe] hover:bg-[#0353e9] text-white border border-[#0f62fe] text-xs font-mono uppercase tracking-wider font-bold px-5 py-2.5 rounded-none transition-all cursor-pointer"
                  >
                    Register First Node Machine
                  </button>
                </div>
              ) : (
                <div id="nodes-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in">
                  {hosts.map((h) => (
                    <div key={h.id}>
                      <HostCard
                        host={h}
                        isActive={activeHostId === h.id}
                        onSelect={() => setActiveHostId(h.id)}
                        onEdit={() => {
                          setEditingHost(h);
                          setIsAddModalOpen(true);
                        }}
                        onDelete={() => handleDeleteHost(h.id)}
                        onForceRefreshState={() => {}}
                        currentUserRole={isGuestMode ? 'admin' : authorizedRole}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Interactive Diagnostics Terminal Center */}
            {activeHost && (
              <NodeMonitor
                host={activeHost}
                currentUserRole={isGuestMode ? 'admin' : authorizedRole}
              />
            )}

            {/* Split Workspace Column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Voice Agent Portal */}
              <div className="lg:col-span-6 flex flex-col">
                <VoiceAgent
                  hosts={hosts}
                  activeHostId={activeHostId}
                  onLogged={handleLoggedCommand}
                  currentUser={currentUser}
                  messages={messages}
                  onAddMessage={handleAddChatMessage}
                  onClearMessages={handleClearMessages}
                  currentUserRole={isGuestMode ? 'admin' : authorizedRole}
                />
              </div>

              {/* Console & Shell Logs */}
              <div className="lg:col-span-6 flex flex-col space-y-4">
                {/* Visual Direct Terminal Console */}
                <div className="flex-1">
                  <SSHConsole
                    host={activeHost}
                    onLogged={handleLoggedCommand}
                    currentUserRole={isGuestMode ? 'admin' : authorizedRole}
                  />
                </div>

                {/* Audit Terminal History Log Trail */}
                <div className="bg-[#262626] border border-[#393939] rounded-none p-4 flex flex-col h-[200px]">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold border-b border-[#393939] pb-2 mb-2 select-none font-mono uppercase text-xs">
                    <History className="h-4 w-4 text-[#78a9ff]" />
                    <span>Security Terminal Audit Logs</span>
                  </div>

                  <div id="audit-logs-list" className="flex-1 overflow-y-auto space-y-2 max-h-[148px] scrollbar-thin">
                    {terminalLogs.map((log) => (
                      <div key={log.id} className="flex items-start justify-between gap-4 font-mono text-[10px] p-2 bg-[#161616] border border-[#393939] rounded-none">
                        <div className="truncate shrink-1">
                          <span className={`${log.isError ? 'text-[#ff8389]' : 'text-[#42be65]'}`}>[$]</span>{' '}
                          <span className="text-[#78a9ff] font-bold">[{log.hostName}]</span>{' '}
                          <code className="text-[#f4f4f4]">{log.command}</code>
                        </div>
                        <span className="text-[9px] text-[#8d8d8d] shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                    {terminalLogs.length === 0 && (
                      <p className="text-[10px] font-mono text-[#8d8d8d] uppercase tracking-wide py-4 text-center select-none">No diagnostic log trails recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="animate-fade-in">
            <WhatsAppPreview />
          </div>
        )}

        {activeTab === 'brain' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <LLMConfigPanel onSaved={handleApplyConfig} />
            <UserManagementPanel currentUserRole={isGuestMode ? 'admin' : authorizedRole} />
          </div>
        )}

      </main>

      {/* Footer Banner */}
      <footer className="bg-[#111111] border-t border-[#393939] py-5 px-6 mt-12 text-center text-[10px] font-mono text-[#8d8d8d] select-none uppercase tracking-wider">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#42be65]" />
            <span>Secure Sandboxed Execution Env</span>
          </div>
          <p>© 2026 BuildOS Node Dashboard. Cloud persistence activated securely.</p>
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-[#8d8d8d]" />
            <span>Voice & Text LLM-Independent Framework</span>
          </div>
        </div>
      </footer>

      {/* Modal overlays */}
      <AddHostModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleCreateOrUpdateHost}
        editingHost={editingHost}
      />
    </div>
  );
}
