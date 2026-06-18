import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Moon,
  Users,
  Menu,
  X
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { HostMachine, TerminalLog, LLMConfig, ChatMessage, ChatSession } from './types';
import HostCard from './components/HostCard';
import SSHConsole from './components/SSHConsole';
import VoiceAgent from './components/VoiceAgent';
import LLMConfigPanel from './components/LLMConfigPanel';
import WhatsAppPreview from './components/WhatsAppPreview';
import AddHostModal from './components/AddHostModal';
import UserManagementPanel from './components/UserManagementPanel';
import NodeMonitor from './components/NodeMonitor';
import NodeDetailsPage from './components/NodeDetailsPage';
import HomePage from './components/HomePage';

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
  clearFirestoreChats,
  subscribeChatSessions,
  addFirestoreChatSession,
  updateFirestoreChatSessionTitle,
  deleteFirestoreChatSession,
  clearFirestoreChatsBySession
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

  const location = useLocation();
  const navigate = useNavigate();

  const VALID_TABS = ['fleet', 'node-details', 'diagnostics', 'chat', 'whatsapp', 'settings', 'operators'] as const;
  type AppTab = typeof VALID_TABS[number];

  // Derive active tab and host ID from URL path
  const pathSegments = location.pathname.replace(/^\//, '').split('/');
  const activeTab: AppTab = VALID_TABS.includes(pathSegments[0] as AppTab) ? pathSegments[0] as AppTab : 'fleet';
  const urlHostId = pathSegments[0] === 'node-details' && pathSegments[1] ? pathSegments[1] : null;

  const [hosts, setHosts] = useState<HostMachine[]>([]);
  const [activeHostId, setActiveHostId] = useState<string | null>(urlHostId);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostMachine | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Sync URL → activeHostId on back/forward navigation
  useEffect(() => {
    const parts = location.pathname.replace(/^\//, '').split('/');
    if (parts[0] === 'node-details' && parts[1]) {
      setActiveHostId(parts[1]);
    }
  }, [location.pathname]);

  // Update document title on route change
  useEffect(() => {
    const segment = location.pathname.replace(/^\//, '').split('/')[0] || 'home';
    document.title = `BuildOS · ${segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
  }, [location.pathname]);

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

  // Chat Sessions and Active Selection
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);

  // Synchronize Cloud Firestore Chat Sessions list
  useEffect(() => {
    if (!currentUser) {
      // Local fallback session
      const guestSession: ChatSession = {
        id: 'guest-session-1',
        userId: 'guest',
        title: 'Diagnostic Workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setChatSessions([guestSession]);
      setActiveChatSessionId('guest-session-1');
      return;
    }

    const unsubscribe = subscribeChatSessions(currentUser.uid, async (syncedSessions) => {
      setChatSessions(syncedSessions);
      if (syncedSessions.length > 0) {
        // Auto select first session or maintain active selection if it still exists
        const exists = syncedSessions.some(s => s.id === activeChatSessionId);
        if (!activeChatSessionId || !exists) {
          setActiveChatSessionId(syncedSessions[0].id);
        }
      } else {
        // Auto-create a brand new session if they have none
        const newSession = await addFirestoreChatSession(currentUser.uid, {
          title: 'Infrastructure Audit',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        if (newSession) {
          setActiveChatSessionId(newSession.id);
        }
      }
    });

    return () => {
      unsubscribe && unsubscribe();
    };
  }, [currentUser, isGuestMode, activeChatSessionId]);

  // Sync Cloud Firestore Chat logs on Session / Auth Change
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

    if (!activeChatSessionId) {
      setMessages([]);
      return;
    }

    const unsubscribe = subscribeChats(currentUser.uid, activeChatSessionId, (syncedChats) => {
      if (syncedChats.length === 0) {
        const welcomeStr = "👋 I am your SSH Host Agent. Select any server on the dashboard or tell me what to check. I can run commands, count docker containers, find open ports, and review resources directly.";
        addFirestoreChat(currentUser.uid, {
          userId: currentUser.uid,
          sessionId: activeChatSessionId,
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
  }, [currentUser, activeChatSessionId]);

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

  // Live telemetry polling for physical (non-simulated) hosts
  const hostsRef = useRef<HostMachine[]>([]);
  useEffect(() => { hostsRef.current = hosts; }, [hosts]);

  useEffect(() => {
    const pollPhysicalHosts = async () => {
      const physical = hostsRef.current.filter(h => !h.isSimulated);
      if (!physical.length) return;

      const results = await Promise.allSettled(
        physical.map(host =>
          fetch(`/api/hosts/${host.id}/details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host })
          }).then(r => r.ok ? r.json() : Promise.reject())
        )
      );

      const updates = new Map<string, { cpu: number; ram: number; disk: number; containers: number }>();
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          const d = result.value;
          updates.set(physical[i].id, {
            cpu: d.cpu ?? 0,
            ram: d.ram?.used ?? d.ram ?? 0,
            disk: d.disk ?? 0,
            containers: d.docker?.length ?? 0,
          });
        }
      });

      if (updates.size === 0) return;

      setHosts(prev => prev.map(h => {
        const live = updates.get(h.id);
        if (!live) return h;
        return {
          ...h,
          simulatedStats: {
            ...(h.simulatedStats || {}),
            cpu: live.cpu,
            ram: live.ram,
            disk: live.disk,
            dockerContainersCount: live.containers,
            openPorts: h.simulatedStats?.openPorts || [h.port],
          }
        };
      }));
    };

    pollPhysicalHosts();
    const interval = setInterval(pollPhysicalHosts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateOrUpdateHost = async (hostData: Omit<HostMachine, 'id'> & { id?: string }) => {
    try {
      // Guest/sandbox mode: enforce simulated, strip credentials
      const processedHost = isGuestMode
        ? { ...hostData, isSimulated: true, password: undefined, privateKey: undefined }
        : { ...hostData };
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
    if (currentUser && activeChatSessionId) {
      // Auto-update first message title just like ChatGPT
      const hasUserMessageBefore = messages.some(m => m.sender === 'user');
      if (!hasUserMessageBefore && msg.sender === 'user') {
        const textPreview = msg.text.trim();
        const firstLine = textPreview.split('\n')[0];
        const rawTitle = firstLine.length > 25 ? firstLine.substring(0, 25) + '...' : firstLine;
        await updateFirestoreChatSessionTitle(currentUser.uid, activeChatSessionId, rawTitle);
      }

      await addFirestoreChat(currentUser.uid, {
        userId: currentUser.uid,
        sessionId: activeChatSessionId,
        ...msg
      });
    } else {
      setMessages(prev => [
        ...prev,
        {
          id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          sessionId: activeChatSessionId || undefined,
          ...msg
        }
      ]);
    }
  };

  const handleClearMessages = async () => {
    if (currentUser && activeChatSessionId) {
      await clearFirestoreChatsBySession(currentUser.uid, activeChatSessionId);
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

  const handleCreateNewChatSession = async () => {
    if (currentUser) {
      const newSession = await addFirestoreChatSession(currentUser.uid, {
        title: 'New Conversation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      if (newSession) {
        setActiveChatSessionId(newSession.id);
      }
    } else {
      const newId = `guest-session-${Date.now()}`;
      const newSession: ChatSession = {
        id: newId,
        userId: 'guest',
        title: 'New Conversation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setChatSessions(prev => [newSession, ...prev]);
      setActiveChatSessionId(newId);
    }
  };

  const handleDeleteChatSession = async (sessionId: string) => {
    // If it's the only session left, we can create a fallback or just clear it
    if (chatSessions.length <= 1) {
      const promptTitle = currentUser ? 'Infrastructure Audit' : 'Diagnostic Workspace';
      if (currentUser) {
        await deleteFirestoreChatSession(currentUser.uid, sessionId);
        const newSession = await addFirestoreChatSession(currentUser.uid, {
          title: promptTitle,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        if (newSession) {
          setActiveChatSessionId(newSession.id);
        }
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
      return;
    }

    if (currentUser) {
      await deleteFirestoreChatSession(currentUser.uid, sessionId);
    } else {
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeChatSessionId === sessionId) {
        const remaining = chatSessions.filter(s => s.id !== sessionId);
        setActiveChatSessionId(remaining[0].id);
      }
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

  // Render feature showcase homepage at /
  if (!currentUser && !isGuestMode && location.pathname === '/') {
    return (
      <HomePage
        onSignIn={() => navigate('/fleet')}
        onSandbox={() => { setIsGuestMode(true); navigate('/fleet'); }}
      />
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
            <div className="pt-2 text-center">
              <button
                onClick={() => navigate('/')}
                className="text-[10px] font-mono text-[#525252] hover:text-[#6366f1] transition-colors cursor-pointer underline underline-offset-2"
              >
                Learn about BuildOS →
              </button>
            </div>
          </div>
        </div>

        {/* Creator attribution */}
        <div className="py-6 text-center text-[11px] text-[#525252] font-sans select-none flex items-center justify-center gap-3">
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
          ].map(s => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
              className="text-[#525252] hover:text-[#6366f1] transition-colors">{s.label}</a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div id="application-container" className="min-h-screen bg-[#161616] text-[#f4f4f4] flex flex-col font-sans selection:bg-[#0f62fe]/20 relative">
      
      {/* Top Navigation Frame: Slim and Enterprise-dense (IBM Carbon Shell Header) */}
      <header className="bg-[#161616] border-b border-[#393939] h-14 px-4 flex items-center justify-between sticky top-0 z-40 select-none">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="md:hidden p-1.5 bg-[#262626] hover:bg-[#393939] border border-[#393939] text-[#c6c6c6] hover:text-white cursor-pointer transition rounded-none mr-1"
            title="Toggle workspace sections drawer"
          >
            {isMobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <div
            className={`p-1.5 text-white rounded-none shrink-0 hidden sm:block ${isGuestMode ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            style={{ background: isGuestMode ? 'linear-gradient(135deg,#6366f1,#0f62fe)' : '#0f62fe' }}
            onClick={isGuestMode ? () => { setIsGuestMode(false); navigate('/'); } : undefined}
            title={isGuestMode ? 'Back to homepage' : undefined}
          >
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className={`font-semibold text-[13px] text-white font-sans tracking-tight ${isGuestMode ? 'cursor-pointer hover:text-[#818cf8] transition-colors' : 'select-none'}`}
                onClick={isGuestMode ? () => { setIsGuestMode(false); navigate('/'); } : undefined}
                title={isGuestMode ? 'Back to homepage' : undefined}
              >
                BuildOS Node Commander
              </h1>
              <span className="bg-[#0f62fe]/15 text-[#78a9ff] font-mono text-[9px] px-2 py-0.5 border border-[#0f62fe]/30">
                v1.6.5
              </span>
            </div>
            <p className="hidden sm:block text-[11px] font-sans mt-0.5">
              <span className="text-[#6f6f6f]">SSH Fleet Management · by </span>
              <a
                href="https://buildwithshashank.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#6366f1] hover:text-[#818cf8] transition-colors font-medium"
              >
                BuildWithShashank
              </a>
            </p>
          </div>
        </div>

        {/* Global Action items */}
        <div className="flex items-center gap-2.5">
          {/* Back to homepage — sandbox mode only */}
          {isGuestMode && (
            <button
              onClick={() => { setIsGuestMode(false); navigate('/'); }}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 border border-[#6366f1]/40 bg-[#6366f1]/10 text-[#818cf8] hover:bg-[#6366f1]/20 hover:text-white font-mono text-[10px] uppercase tracking-wider transition-all cursor-pointer"
              title="Back to feature overview"
            >
              ← Features
            </button>
          )}
          {/* UTC Real-time Clock */}
          <div className="hidden md:flex flex-col text-right pr-3 border-r border-[#393939]">
            <span className="text-[10px] font-sans text-[#6f6f6f]">UTC</span>
            <span className="font-mono text-[11px] text-[#a8a8a8]">{utcTime ? utcTime.replace(' UTC', '') : 'Syncing...'}</span>
          </div>

          {/* Quick Status */}
          <div className="hidden lg:flex items-center gap-1.5 bg-[#1e2a1e] px-2.5 py-1 border border-[#24a148]/30 text-[11px] font-sans text-[#42be65]">
            <span className="h-1.5 w-1.5 rounded-none bg-[#24a148] animate-pulse" />
            <span>{hosts.length} node{hosts.length !== 1 && 's'}</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            id="theme-toggle"
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            className="p-1.5 bg-[#262626] hover:bg-[#393939] border border-[#393939] text-[#c6c6c6] hover:text-white transition rounded-none cursor-pointer"
            title="Switch Theme"
          >
            {theme === 'light' ? (
              <Moon className="h-3.5 w-3.5 text-[#0f62fe]" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-yellow-500" />
            )}
          </button>

          {/* User Profile & Sign Out options */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-[#262626] border border-[#393939] p-0.5 pr-2.5 rounded-none">
              <img 
                src={currentUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.uid}`}
                alt={currentUser.displayName || 'Me'}
                className="h-7 w-7 rounded-none border border-[#393939] shrink-0"
                referrerPolicy="no-referrer"
              />
              <span className="hidden md:block font-mono text-[10px] text-white font-bold truncate max-w-[100px]">
                {currentUser.displayName || currentUser.email}
              </span>
              <button
                onClick={logoutUser}
                className="bg-[#161616] hover:bg-[#393939] p-1 border border-[#393939] text-[#8d8d8d] hover:text-[#ff8389] transition-all cursor-pointer rounded-none ml-1.5"
                title="Disconnect Profile"
              >
                <LogOut className="h-3 w-3" />
              </button>
            </div>
          ) : isGuestMode ? (
            <div className="flex items-center gap-2 bg-[#fe1f2a]/10 border border-[#fe1f2a]/35 py-1 px-2.5 text-xs rounded-none">
              <span className="h-1.5 w-1.5 rounded-none bg-[#fe1f2a] animate-pulse shrink-0" />
              <span className="text-[9px] font-bold text-[#ff8389] uppercase tracking-widest font-mono">Sandbox Mode</span>
              <button
                onClick={() => setIsGuestMode(false)}
                className="text-slate-400 hover:text-white font-semibold underline text-[9px] pl-1 font-mono"
              >
                Sign In
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {/* Main Split Layout: Sidebar + Workspace Fluid Pane */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0">
        
        {/* Left Side Command Rail */}
        <aside className={`w-full md:w-64 bg-[#121212] border-b md:border-b-0 md:border-r border-[#393939] flex flex-col flex-shrink-0 select-none ${isMobileNavOpen ? 'block' : 'hidden md:flex'}`}>
          
          {/* Navigation Category Groups */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">

            {/* GROUP 1: FLEET */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-[#525252] px-4 uppercase tracking-widest block font-sans mb-1.5">
                Fleet
              </span>
              <div className="space-y-px">
                <button
                  onClick={() => {
                    navigate('/fleet');
                    setIsMobileNavOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-[12px] font-sans transition-all flex items-center justify-between border-l-[3px] cursor-pointer ${
                    activeTab === 'fleet'
                      ? 'border-l-[#0f62fe] bg-[#222222] text-white font-semibold'
                      : 'border-l-transparent text-[#a8a8a8] hover:bg-[#1a1a1a] hover:text-[#e0e0e0]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Server className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'fleet' ? 'text-[#78a9ff]' : 'text-[#6f6f6f]'}`} />
                    <span>Fleet Overview</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-none ${activeTab === 'fleet' ? 'bg-[#0f62fe]/20 text-[#78a9ff]' : 'bg-[#262626] border border-[#393939] text-[#6f6f6f]'}`}>
                    {hosts.length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    navigate(activeHostId ? `/node-details/${activeHostId}` : '/node-details');
                    setIsMobileNavOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-[12px] font-sans transition-all flex items-center justify-between border-l-[3px] cursor-pointer ${
                    activeTab === 'node-details'
                      ? 'border-l-[#0f62fe] bg-[#222222] text-white font-semibold'
                      : 'border-l-transparent text-[#a8a8a8] hover:bg-[#1a1a1a] hover:text-[#e0e0e0]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Cpu className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'node-details' ? 'text-[#78a9ff]' : 'text-[#6f6f6f]'}`} />
                    <span>Node Details</span>
                  </div>
                  {activeHost && (
                    <span className="text-[9px] text-[#42be65] font-mono truncate max-w-[72px] leading-none">
                      ● {activeHost.name}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* GROUP 2: OPERATIONS */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-[#525252] px-4 uppercase tracking-widest block font-sans mb-1.5">
                Operations
              </span>
              <div className="space-y-px">
                <button
                  onClick={() => {
                    navigate('/diagnostics');
                    setIsMobileNavOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-[12px] font-sans transition-all flex items-center gap-2.5 border-l-[3px] cursor-pointer ${
                    activeTab === 'diagnostics'
                      ? 'border-l-[#0f62fe] bg-[#222222] text-white font-semibold'
                      : 'border-l-transparent text-[#a8a8a8] hover:bg-[#1a1a1a] hover:text-[#e0e0e0]'
                  }`}
                >
                  <TerminalSquare className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'diagnostics' ? 'text-[#78a9ff]' : 'text-[#6f6f6f]'}`} />
                  <span>Diagnostics Lab</span>
                </button>

                <button
                  onClick={() => {
                    navigate('/whatsapp');
                    setIsMobileNavOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-[12px] font-sans transition-all flex items-center gap-2.5 border-l-[3px] cursor-pointer ${
                    activeTab === 'whatsapp'
                      ? 'border-l-[#0f62fe] bg-[#222222] text-white font-semibold'
                      : 'border-l-transparent text-[#a8a8a8] hover:bg-[#1a1a1a] hover:text-[#e0e0e0]'
                  }`}
                >
                  <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'whatsapp' ? 'text-[#78a9ff]' : 'text-[#6f6f6f]'}`} />
                  <span>SMS Webhook</span>
                </button>
              </div>
            </div>

            {/* GROUP 3: INTELLIGENCE */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-[#525252] px-4 uppercase tracking-widest block font-sans mb-1.5">
                Intelligence
              </span>
              <div className="space-y-px">
                <button
                  onClick={() => {
                    navigate('/chat');
                    setIsMobileNavOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-[12px] font-sans transition-all flex items-center gap-2.5 border-l-[3px] cursor-pointer ${
                    activeTab === 'chat'
                      ? 'border-l-[#0f62fe] bg-[#222222] text-white font-semibold'
                      : 'border-l-transparent text-[#a8a8a8] hover:bg-[#1a1a1a] hover:text-[#e0e0e0]'
                  }`}
                >
                  <Bot className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'chat' ? 'text-[#78a9ff]' : 'text-[#6f6f6f]'}`} />
                  <span>AI Agent</span>
                </button>
              </div>
            </div>

            {/* GROUP 4: ADMIN */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-[#525252] px-4 uppercase tracking-widest block font-sans mb-1.5">
                Admin
              </span>
              <div className="space-y-px">
                <button
                  onClick={() => {
                    navigate('/settings');
                    setIsMobileNavOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-[12px] font-sans transition-all flex items-center gap-2.5 border-l-[3px] cursor-pointer ${
                    activeTab === 'settings'
                      ? 'border-l-[#0f62fe] bg-[#222222] text-white font-semibold'
                      : 'border-l-transparent text-[#a8a8a8] hover:bg-[#1a1a1a] hover:text-[#e0e0e0]'
                  }`}
                >
                  <Settings className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'settings' ? 'text-[#78a9ff]' : 'text-[#6f6f6f]'}`} />
                  <span>System Config</span>
                </button>

                <button
                  onClick={() => {
                    navigate('/operators');
                    setIsMobileNavOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-[12px] font-sans transition-all flex items-center gap-2.5 border-l-[3px] cursor-pointer ${
                    activeTab === 'operators'
                      ? 'border-l-[#0f62fe] bg-[#222222] text-white font-semibold'
                      : 'border-l-transparent text-[#a8a8a8] hover:bg-[#1a1a1a] hover:text-[#e0e0e0]'
                  }`}
                >
                  <Users className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'operators' ? 'text-[#78a9ff]' : 'text-[#6f6f6f]'}`} />
                  <span>Operators</span>
                </button>
              </div>
            </div>

          </div>

          {/* Sidebar Footer Register Node Trigger */}
          {(isGuestMode || authorizedRole === 'admin') && (
            <div className="p-4 border-t border-[#393939] bg-[#161616]">
              <button
                onClick={() => {
                  setEditingHost(null);
                  setIsAddModalOpen(true);
                }}
                className="w-full bg-[#0f62fe] hover:bg-[#0353e9] text-white border border-[#0f62fe] rounded-none text-[11px] font-sans font-semibold tracking-wide py-2.5 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Register Node</span>
              </button>
            </div>
          )}
        </aside>

        {/* Workspace Dynamic Pane (Fully fluid on Desktop) */}
        <main className="flex-1 bg-[#161616] py-6 px-4 md:px-6 overflow-y-auto relative z-10 min-w-0">
          <div className="max-w-7xl mx-auto space-y-6">
        {activeTab === 'fleet' && (
          <div className="space-y-6">
            {/* Host Machines list Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#393939] pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-white font-sans">Active Fleet</h2>
                  <p className="text-[11px] text-[#8d8d8d] font-sans mt-0.5">Node telemetry refreshed every 6s</p>
                </div>
                <span className="text-[10px] text-[#42be65] font-mono flex items-center gap-1.5 select-none">
                  <span className="h-1.5 w-1.5 rounded-none bg-[#42be65] animate-pulse" />
                  Live
                </span>
              </div>

              {hosts.length === 0 ? (
                <div id="no-hosts-status" className="border border-[#393939] bg-[#262626] p-14 rounded-none text-center flex flex-col items-center justify-center">
                  <Server className="h-10 w-10 text-[#8d8d8d] mb-4" />
                  <h3 className="font-bold font-mono text-white text-xs uppercase tracking-wider">No Nodes Registered</h3>
                  <p className="text-xs text-[#a8a8a8] max-w-sm mt-1.5 mb-5 font-sans leading-relaxed">
                    Create virtual sandbox mock nodes or provision real physical VPS home target machines by attaching ssh keys on the dashboard interface.
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-[#0f62fe] hover:bg-[#0353e9] text-white border border-[#0f62fe] text-xs font-mono uppercase tracking-wider font-bold px-5 py-2.5 rounded-none transition-all cursor-pointer"
                  >
                    Register First Node Machine
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Fleet High-Level Aggregate Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-[#262626] border border-[#393939] border-l-2 border-l-[#0f62fe] p-4 rounded-none flex items-start justify-between">
                      <div>
                        <span className="text-[11px] text-[#8d8d8d] font-sans block">Total Nodes</span>
                        <span className="text-2xl font-bold font-mono text-white mt-1.5 block">{hosts.length}</span>
                        <span className="text-[10px] text-[#6f6f6f] font-mono">{hosts.length !== 1 ? 'registered nodes' : 'registered node'}</span>
                      </div>
                      <Server className="h-4 w-4 text-[#4589ff] mt-0.5 shrink-0" />
                    </div>
                    <div className="bg-[#262626] border border-[#393939] border-l-2 border-l-[#24a148] p-4 rounded-none flex items-start justify-between">
                      <div>
                        <span className="text-[11px] text-[#8d8d8d] font-sans block">Health Status</span>
                        <span className="text-2xl font-bold font-mono text-[#42be65] mt-1.5 block">Active</span>
                        <span className="text-[10px] text-[#6f6f6f] font-mono flex items-center gap-1"><span className="h-1.5 w-1.5 bg-[#42be65] rounded-none animate-pulse inline-block" /> monitoring</span>
                      </div>
                      <div className="h-4 w-4 rounded-none bg-[#24a148]/20 border border-[#24a148]/40 flex items-center justify-center mt-0.5 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-none bg-[#24a148] animate-pulse" />
                      </div>
                    </div>
                    <div className="bg-[#262626] border border-[#393939] border-l-2 border-l-[#f1c21b] p-4 rounded-none flex items-start justify-between">
                      <div>
                        <span className="text-[11px] text-[#8d8d8d] font-sans block">Avg CPU Load</span>
                        <span className="text-2xl font-bold font-mono text-white mt-1.5 block">
                          {hosts.length > 0
                            ? `${Math.round(hosts.reduce((acc, h) => acc + (h.simulatedStats?.cpu || 12), 0) / hosts.length)}%`
                            : '—'
                          }
                        </span>
                        <span className="text-[10px] text-[#6f6f6f] font-mono">across fleet</span>
                      </div>
                      <Cpu className="h-4 w-4 text-[#f1c21b] mt-0.5 shrink-0" />
                    </div>
                    <div className="bg-[#262626] border border-[#393939] border-l-2 border-l-[#8a3ffc] p-4 rounded-none flex items-start justify-between">
                      <div>
                        <span className="text-[11px] text-[#8d8d8d] font-sans block">Avg RAM Usage</span>
                        <span className="text-2xl font-bold font-mono text-white mt-1.5 block">
                          {hosts.length > 0
                            ? `${(hosts.reduce((acc, h) => acc + (h.simulatedStats?.ram || 4.2), 0) / hosts.length).toFixed(1)} GB`
                            : '—'
                          }
                        </span>
                        <span className="text-[10px] text-[#6f6f6f] font-mono">per node avg</span>
                      </div>
                      <Layers className="h-4 w-4 text-[#a56eff] mt-0.5 shrink-0" />
                    </div>
                  </div>

                  <div id="nodes-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in">
                    {hosts.map((h) => (
                      <div key={h.id}>
                        <HostCard
                          host={h}
                          isActive={activeHostId === h.id}
                          onSelect={() => {
                            setActiveHostId(h.id);
                            navigate(`/node-details/${h.id}`);
                          }}
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
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'node-details' && (
          <NodeDetailsPage
            host={activeHost}
            hosts={hosts}
            setActiveHostId={setActiveHostId}
            onBackToFeet={() => navigate('/fleet')}
            currentUserRole={isGuestMode ? 'admin' : authorizedRole}
          />
        )}

        {activeTab === 'diagnostics' && (
          <div className="space-y-6">
            {/* Host dropdown selector */}
            <div className="bg-[#262626] border border-[#393939] p-4 rounded-none flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
              <div className="flex items-center gap-3">
                <span className="text-[#8d8d8d] uppercase tracking-wider">Select Active Node target:</span>
                <select
                  value={activeHostId || ''}
                  onChange={(e) => setActiveHostId(e.target.value || null)}
                  className="bg-[#161616] border border-[#393939] text-white text-xs font-mono px-3 py-1.5 focus:outline-none focus:border-[#0f62fe] cursor-pointer"
                >
                  <option value="">-- NO INSTANCE SELECTED --</option>
                  {hosts.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.ip}:{h.port}) - {h.isSimulated ? 'VIRTUAL' : 'PHYSICAL'}
                    </option>
                  ))}
                </select>
              </div>
              {activeHost && (
                <div className="flex items-center gap-3">
                  <span className="text-[#8d8d8d] uppercase tracking-wider">Node Status:</span>
                  <span className="bg-[#1a3821] text-[#42be65] font-semibold text-[11px] px-2.5 py-1 border border-[#24a148]/30 font-sans flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-[#42be65] rounded-none animate-pulse" />
                    Online · Telemetry active
                  </span>
                </div>
              )}
            </div>

            {activeHost ? (
              <div className="space-y-6">
                {/* Node details, metrics, docker & service controls */}
                <NodeMonitor
                  key={activeHostId}
                  host={activeHost}
                  currentUserRole={isGuestMode ? 'admin' : authorizedRole}
                />

                {/* split console and logs */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* SSH Terminal Console */}
                  <div className="lg:col-span-7 flex flex-col">
                    <SSHConsole
                      key={activeHostId}
                      host={activeHost}
                      onLogged={handleLoggedCommand}
                      currentUserRole={isGuestMode ? 'admin' : authorizedRole}
                    />
                  </div>

                  {/* Terminal history audit logs */}
                  <div className="lg:col-span-5 flex flex-col">
                    <div className="bg-[#262626] border border-[#393939] rounded-none p-4 flex flex-col h-full min-h-[300px]">
                      <div className="flex items-center gap-1.5 text-slate-300 font-bold border-b border-[#393939] pb-2 mb-3 select-none font-mono uppercase text-xs">
                        <History className="h-4 w-4 text-[#78a9ff]" />
                        <span>Security Terminal Audit Logs</span>
                      </div>

                      <div id="audit-logs-list" className="flex-grow overflow-y-auto space-y-2 max-h-[320px] scrollbar-thin">
                        {terminalLogs.filter(log => !activeHost || log.hostName === activeHost.name).map((log) => (
                          <div key={log.id} className="flex items-start justify-between gap-4 font-mono text-[10px] p-2.5 bg-[#161616] border border-[#393939] rounded-none">
                            <div className="truncate shrink">
                              <span className={`${log.isError ? 'text-[#ff8389]' : 'text-[#42be65]'}`}>[$]</span>{' '}
                              <code className="text-[#f4f4f4]">{log.command}</code>
                            </div>
                            <span className="text-[9px] text-[#8d8d8d] shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                        ))}
                        {terminalLogs.filter(log => !activeHost || log.hostName === activeHost.name).length === 0 && (
                          <p className="text-[10px] font-mono text-[#8d8d8d] uppercase tracking-wide py-14 text-center select-none">No commands run on {activeHost?.name ?? 'this node'} yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-[#393939] bg-[#262626] p-16 rounded-none text-center flex flex-col items-center justify-center">
                <TerminalSquare className="h-12 w-12 text-[#8d8d8d] mb-4 animate-pulse" />
                <h3 className="font-bold font-mono text-white text-xs uppercase tracking-wider">No Node Selected for Inspection</h3>
                <p className="text-xs text-[#a8a8a8] max-w-sm mt-1.5 mb-6 font-sans leading-relaxed">
                  Choose a node from the dedicated Fleet Dashboard tab, or select an operational VM target from the selector list above to begin diagnostics.
                </p>
                {hosts.length > 0 && (
                  <button
                    onClick={() => setActiveHostId(hosts[0].id)}
                    className="bg-[#0f62fe] hover:bg-[#0353e9] text-white border border-[#0f62fe] text-xs font-mono uppercase tracking-wider font-bold px-5 py-2.5 rounded-none transition-all cursor-pointer"
                  >
                    Diagnose {hosts[0].name}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="min-h-[600px] h-[calc(100vh-200px)] animate-fade-in flex flex-col">
            <VoiceAgent
              hosts={hosts}
              activeHostId={activeHostId}
              onLogged={handleLoggedCommand}
              currentUser={currentUser}
              messages={messages}
              onAddMessage={handleAddChatMessage}
              onClearMessages={handleClearMessages}
              currentUserRole={isGuestMode ? 'admin' : authorizedRole}
              chatSessions={chatSessions}
              activeChatSessionId={activeChatSessionId}
              onSelectSession={setActiveChatSessionId}
              onNewSession={handleCreateNewChatSession}
              onDeleteSession={handleDeleteChatSession}
            />
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="animate-fade-in">
            <WhatsAppPreview />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <LLMConfigPanel onSaved={handleApplyConfig} />
          </div>
        )}

        {activeTab === 'operators' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <UserManagementPanel currentUserRole={isGuestMode ? 'admin' : authorizedRole} />
          </div>
        )}

          </div>
        </main>
      </div>

      {/* Footer Banner */}
      <footer className="bg-[#0d0d0d] border-t border-[#2d2d2d] py-4 px-6 font-sans select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left: attribution */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-[#525252]">Built by</span>
            <a
              href="https://buildwithshashank.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6366f1] hover:text-[#818cf8] font-semibold transition-colors"
            >
              BuildWithShashank
            </a>
            <span className="text-[#393939]">·</span>
            <span className="text-[#525252]">© {new Date().getFullYear()} BuildOS Node Commander</span>
          </div>

          {/* Center: security note */}
          <div className="flex items-center gap-1.5 text-[10px] text-[#3d3d3d]">
            <ShieldCheck className="h-3 w-3 text-[#3d3d3d]" />
            <span>AES-256 encrypted credentials · Firebase Firestore sync</span>
          </div>

          {/* Right: social links */}
          <div className="flex items-center gap-3 text-[11px]">
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
          </div>
        </div>
      </footer>

      {/* Modal overlays */}
      <AddHostModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleCreateOrUpdateHost}
        editingHost={editingHost}
        forceSimulated={isGuestMode}
      />
    </div>
  );
}
