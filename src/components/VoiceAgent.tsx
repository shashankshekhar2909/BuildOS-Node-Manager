import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Volume2, VolumeX, Send, Bot, User, Cpu, AlertCircle, 
  ChevronDown, ChevronUp, Sparkles, Zap, Trash2, Phone, PhoneOff, Radio
} from 'lucide-react';
import { ChatMessage, AgentAction, HostMachine } from '../types';
import { pcmToBase64, playAudioChunk, stopAllPlayerAudio } from '../lib/audio_helper';
import { addFirestoreChat } from '../lib/firestore_sync';

interface VoiceAgentProps {
  hosts: HostMachine[];
  activeHostId: string | null;
  onLogged: (command: string, output: string, isError: boolean) => void;
  currentUser: any; // Firebase user or null for guest
  messages: ChatMessage[];
  onAddMessage: (msg: Omit<ChatMessage, 'id'>) => Promise<void>;
  onClearMessages: () => void;
  currentUserRole?: 'admin' | 'viewer' | null;
}

export default function VoiceAgent({ 
  hosts, 
  activeHostId, 
  onLogged, 
  currentUser, 
  messages, 
  onAddMessage,
  onClearMessages,
  currentUserRole
}: VoiceAgentProps) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<Record<string, boolean>>({});
  
  // Model modes: 'pro' (gemini-3.1-pro-preview), 'flash' (gemini-3.5-flash), 'lite' (gemini-3.1-flash-lite)
  const [modelMode, setModelMode] = useState<'pro' | 'flash' | 'lite'>('flash');

  // Real-time Live API Voice state (gemini-3.1-flash-live-preview)
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveWs, setLiveWs] = useState<WebSocket | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Audio Context references
  const liveAudioCtxRef = useRef<AudioContext | null>(null);
  const liveInputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Audio Transcription Recording State (gemini-3.5-flash)
  const [isRecordingTranscription, setIsRecordingTranscription] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Web Speech API fallback refs
  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll chats to bottom
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isLiveActive]);

  useEffect(() => {
    // Initialize standard fallback browser Speech Recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputText(transcript);
            handleSubmitMessage(transcript);
          }
        };

        rec.onerror = (err: any) => {
          console.error('Speech recognition error:', err);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
    return () => {
      stopLiveSession();
    };
  }, []);

  // Convert AI response to Speech Synthesis (For text chat)
  const speakOutput = (text: string) => {
    if (!isVoiceEnabled || typeof window === 'undefined' || isLiveActive) return;

    const cleanText = text
      .replace(/[*#`_\-]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .substring(0, 250); // safety length cap

    window.speechSynthesis.cancel(); // kill legacy queue
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha') || v.lang.startsWith('en'));
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const toggleListen = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not fully supported in this iframe / browser. Please type your message or try a Chrome-based browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Toggle real-time voice call using Live API and gemini-3.1-flash-live-preview
  const toggleLiveVoiceCall = async () => {
    if (isLiveActive) {
      stopLiveSession();
    } else {
      await startLiveSession();
    }
  };

  const startLiveSession = async () => {
    setIsLiveActive(true);
    setLiveError(null);
    stopAllPlayerAudio();

    try {
      // 1. Initialize audio Contexts
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const playCtx = new AudioCtx({ sampleRate: 24000 });
      const recordCtx = new AudioCtx({ sampleRate: 16000 });
      
      liveAudioCtxRef.current = playCtx;
      liveInputAudioCtxRef.current = recordCtx;

      // 2. Open WebSocket connection to our custom server upgrade path
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-agent`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = async () => {
        console.log('[Live API WS] Connected. Starting mic capture!');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;

          const source = recordCtx.createMediaStreamSource(stream);
          const processor = recordCtx.createScriptProcessor(2048, 1, 1);
          source.connect(processor);
          processor.connect(recordCtx.destination);
          scriptProcessorRef.current = processor;

          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const base64Audio = pcmToBase64(inputData);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ audio: base64Audio }));
            }
          };

        } catch (err: any) {
          console.error('[Live API] Microphone permission declined:', err);
          setLiveError('Microphone permission required for Live voice call.');
          stopLiveSession();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            setLiveError(msg.error);
            stopLiveSession();
          } else if (msg.audio) {
            playAudioChunk(playCtx, msg.audio);
          } else if (msg.interrupted) {
            stopAllPlayerAudio();
          }
        } catch (e) {
          console.error('[Live API] Error parsing server voice payload:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('[Live API WS] Exception encountered:', e);
        setLiveError('WebSocket connection handshake. Is the server running?');
        stopLiveSession();
      };

      ws.onclose = () => {
        console.log('[Live API WS] Server closed connection');
        stopLiveSession();
      };

      setLiveWs(ws);

    } catch (e: any) {
      console.error('[Live API] Initialization exception:', e);
      setLiveError(`Initialization failed: ${e.message}`);
      stopLiveSession();
    }
  };

  const stopLiveSession = () => {
    setIsLiveActive(false);
    stopAllPlayerAudio();

    if (liveWs) {
      try { liveWs.close(); } catch (e) {}
      setLiveWs(null);
    }

    if (scriptProcessorRef.current) {
      try { scriptProcessorRef.current.disconnect(); } catch (e) {}
      scriptProcessorRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }

    if (liveAudioCtxRef.current) {
      try { liveAudioCtxRef.current.close(); } catch (e) {}
      liveAudioCtxRef.current = null;
    }

    if (liveInputAudioCtxRef.current) {
      try { liveInputAudioCtxRef.current.close(); } catch (e) {}
      liveInputAudioCtxRef.current = null;
    }
  };

  // Start audio recording for Google Gemini 3.5-flash Audio Transcription
  const startRecordingTranscription = async () => {
    setTranscriptionError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecordingTranscription(false);
        setLoading(true);

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // convert blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            
            // Send to our /api/transcribe endpoint using gemini-3.5-flash
            const response = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64Data })
            });

            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.error || 'Failed to parse transcription payload.');
            }

            const data = await response.json();
            const transcriptionText = data.text?.trim() || '';

            if (transcriptionText) {
              setInputText(transcriptionText);
            } else {
              setTranscriptionError('Could not transcribe speech. Please speak clearly into your mic.');
            }
            setLoading(false);
          };
        } catch (err: any) {
          console.error('Transcription call failed:', err);
          setTranscriptionError(err.message || 'Failed transcribing audio file.');
          setLoading(false);
        } finally {
          // Stop media stream tracks
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start(250); // slice chunks
      mediaRecorderRef.current = recorder;
      setIsRecordingTranscription(true);

    } catch (err: any) {
      console.error('Failed acquiring mic stream for transcription:', err);
      setTranscriptionError('Microphone permissions are required for speech dictation.');
    }
  };

  const stopRecordingTranscription = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleTrace = (id: string) => {
    setExpandedTrace(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleSubmitMessage(inputText.trim());
  };

  const handleSubmitMessage = async (queryText: string) => {
    setInputText('');
    setLoading(true);

    const userMessage: Omit<ChatMessage, 'id'> = {
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVoice: false
    };

    // Bubble up user message
    await onAddMessage(userMessage);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          chatHistory: messages.slice(-10), // provide last 10 dialogues
          activeHostId,
          hosts,
          modelMode, // Passes 'pro', 'flash', or 'lite' to implement correct backend resolution and low-latency
          currentUserRole
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server rejected query processing.');
      }

      const data = await response.json();

      const agentMessage: Omit<ChatMessage, 'id'> = {
        sender: 'agent',
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: data.actions || []
      };

      // Add response
      await onAddMessage(agentMessage);

      // Speak output aloud
      speakOutput(data.text);

      // Bubble up logs from agent actions inside loop
      if (data.actions && data.actions.length > 0) {
        data.actions.forEach((act: AgentAction) => {
          if (act.command && act.output) {
            onLogged(act.command, act.output, act.status === 'failed');
          }
        });
      }

    } catch (error: any) {
      await onAddMessage({
        sender: 'system',
        text: `⚠️ Agent Dispatch Error: ${error.message || 'Connecting failure inside ReAct controller.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="agent-portal-box" className="border border-[#393939] bg-[#262626] rounded-none overflow-hidden flex flex-col h-full shadow-lg min-h-[460px]">
      
      {/* Header bar */}
      <div className="bg-[#161616] px-4 py-3 border-b border-[#393939] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className={`h-9 w-9 rounded-none border flex items-center justify-center transition-all ${
              isLiveActive 
                ? 'bg-[#24a148]/10 border-[#24a148] animate-pulse' 
                : 'bg-[#0f62fe]/10 border-[#0f62fe]'
            }`}>
              <Bot className={`h-4.5 w-4.5 ${isLiveActive ? 'text-[#42be65]' : 'text-[#78a9ff]'}`} />
            </div>
            {isListening && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full bg-[#da1e28] opacity-75 rounded-none"></span>
                <span className="relative inline-flex h-2.5 w-2.5 bg-[#da1e28] rounded-none"></span>
              </span>
            )}
          </div>
          <div>
            <h3 className="font-bold text-white text-xs select-none uppercase tracking-wider font-mono">HERMES NODE_AGENT</h3>
            <span className="text-[10px] text-[#a8a8a8] font-mono block">
              {isLiveActive ? (
                <span className="text-[#42be65] animate-pulse font-bold uppercase tracking-wider">● TELEPHONY CH_OPEN</span>
              ) : (
                'SYSADMIN COGNITION RECT'
              )}
            </span>
          </div>
        </div>

        {/* Configurations & Modes */}
        <div className="flex items-center gap-2">
          {/* Quick Model Picker Selector */}
          <div className="flex items-center bg-[#161616] rounded-none px-1 py-1 border border-[#393939] gap-1 text-[10px] font-mono">
            <button
              onClick={() => setModelMode('lite')}
              title="Flash Lite: Ultra Low-Latency Quick Responses"
              className={`px-2 py-0.5 rounded-none transition-all font-bold ${
                modelMode === 'lite' 
                  ? 'bg-[#262626] text-[#f1c21b] border border-[#f1c21b]' 
                  : 'text-[#8d8d8d] hover:text-[#e0e0e0]'
              }`}
            >
              LITE
            </button>
            <button
              onClick={() => setModelMode('flash')}
              title="Gemini Flash 3.5: Balanced Generalist AI"
              className={`px-2 py-0.5 rounded-none transition-all font-bold ${
                modelMode === 'flash' 
                  ? 'bg-[#262626] text-[#78a9ff] border border-[#0f62fe]' 
                  : 'text-[#8d8d8d] hover:text-[#e0e0e0]'
              }`}
            >
              FLASH
            </button>
            <button
              onClick={() => setModelMode('pro')}
              title="Gemini Pro 3.1: Complex reasoning, deep analytics"
              className={`px-2 py-0.5 rounded-none transition-all font-bold ${
                modelMode === 'pro' 
                  ? 'bg-[#262626] text-[#a7f3d0] border border-[#24a148]' 
                  : 'text-[#8d8d8d] hover:text-[#e0e0e0]'
              }`}
            >
              PRO
            </button>
          </div>

          {/* Real-time speech call toggle buttons */}
          <button
            onClick={toggleLiveVoiceCall}
            title={isLiveActive ? 'Disconnect real-time Voice Call' : 'Hook real-time Voice Call (Live API)'}
            className={`px-3 py-1.5 rounded-none border transition-all text-[10px] font-bold font-mono flex items-center gap-1.5 ${
              isLiveActive
                ? 'bg-[#da1e28]/15 border-[#da1e28] text-[#ffb3b8] hover:bg-[#da1e28]/25'
                : 'bg-[#24a148]/10 border-[#24a148]/40 text-[#42be65] hover:text-[#34d399] hover:bg-[#24a148]/20'
            }`}
          >
            <Radio className="h-3. w-3" />
            <span>{isLiveActive ? 'DISCONNECT' : 'LIVE CALL'}</span>
          </button>

          {/* Speaker toggle */}
          <button
            onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
            title={isVoiceEnabled ? 'Mute speech output' : 'Enable speech output'}
            className={`p-1.5 rounded-none border transition-all ${
              isVoiceEnabled
                ? 'bg-[#0f62fe]/10 border-[#0f62fe] text-[#78a9ff]'
                : 'bg-[#161616] border-[#393939] text-[#8d8d8d]'
            }`}
          >
            {isVoiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* Clear chats thread cache */}
          <button
            onClick={onClearMessages}
            title="Clear Chat Thread History log"
            className="p-1.5 rounded-none border border-[#393939] bg-[#161616] text-[#8d8d8d] hover:text-[#da1e28] hover:border-[#da1e28]/40 transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Connection / Live status Banner */}
      {liveError && (
        <div className="bg-[#da1e28]/10 border-b border-[#da1e28]/35 px-4 py-2 flex items-center gap-2 text-xs font-mono text-[#ffb3b8]">
          <AlertCircle className="h-4 w-4 text-[#da1e28] shrink-0" />
          <span className="truncate">{liveError}</span>
        </div>
      )}

      {transcriptionError && (
        <div className="bg-[#f1c21b]/10 border-b border-[#f1c21b]/30 px-4 py-2 flex items-center gap-2 text-xs font-mono text-[#fcd34d]">
          <AlertCircle className="h-4 w-4 text-[#f1c21b] shrink-0" />
          <span className="truncate">{transcriptionError}</span>
        </div>
      )}

      {/* Message List */}
      <div id="chats-body" className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[300px] min-h-[220px] bg-[#1c1c1c] leading-relaxed scrollbar-thin">
        
        {/* Holographic Glowing live visualizer when active */}
        {isLiveActive ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4 bg-[#24a148]/5 rounded-none border border-[#24a148]/30 my-4 animate-pulse">
            <Radio className="h-8 w-8 text-[#42be65] animate-bounce" />
            <div className="text-center font-mono">
              <p className="text-white font-bold text-xs uppercase tracking-wider">AUDIO VOICE LINK ACTIVE</p>
              <p className="text-[10px] text-[#8d8d8d] mt-1 uppercase">Listening and talking baseband streaming...</p>
            </div>
            
            {/* Glowing Simulated Hertz bars */}
            <div className="flex items-center gap-1.5 my-2 h-6">
              <span className="w-1 h-2 bg-[#24a148] rounded-none animate-pulse [animation-delay:0.1s]" />
              <span className="w-1 h-5 bg-[#42be65] rounded-none animate-pulse [animation-delay:0.3s]" />
              <span className="w-1 h-7 bg-[#34d399] rounded-none animate-pulse [animation-delay:0.5s]" />
              <span className="w-1 h-4 bg-[#42be65] rounded-none animate-pulse [animation-delay:0.2s]" />
              <span className="w-1 h-1.5 bg-[#24a148] rounded-none animate-pulse [animation-delay:0.4s]" />
            </div>
          </div>
        ) : null}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 text-xs leading-relaxed ${
              m.sender === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            {/* Avatar */}
            <div className={`h-7 w-7 rounded-none flex items-center justify-center shrink-0 border transition-all ${
              m.sender === 'user'
                ? 'bg-[#393939] border-[#4d4d4d] text-[#f4f4f4]'
                : m.sender === 'system'
                ? 'bg-[#da1e28]/10 border-[#da1e28]/35 text-[#ffb3b8]'
                : 'bg-[#0f62fe]/10 border-[#0f62fe]/40 text-[#78a9ff]'
            }`}>
              {m.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            {/* Bubble */}
            <div className={`flex flex-col gap-1 max-w-[80%] ${m.sender === 'user' ? 'items-end' : ''}`}>
              <div className={`p-3 rounded-none border leading-relaxed text-[12px] font-sans ${
                m.sender === 'user'
                  ? 'bg-[#393939] border-[#4d4d4d] text-white'
                  : m.sender === 'system'
                  ? 'bg-[#da1e28]/10 border-[#da1e28]/25 text-[#ffb3b8]'
                  : 'bg-[#262626] border-[#393939] text-[#e0e0e0]'
              }`}>
                {m.text}
              </div>

              {/* ReAct Trace Actions */}
              {m.actions && m.actions.length > 0 && (
                <div className="w-full bg-[#161616] border border-[#393939] rounded-none p-3 mt-1.5 space-y-2 max-w-md">
                  <div className="flex items-center justify-between text-[10px] text-[#8d8d8d] px-0.5 select-none font-bold font-mono leading-none">
                    <span className="flex items-center gap-1.5 text-[#78a9ff] uppercase">
                      <Cpu className="h-3.5 w-3.5 text-[#0f62fe] animate-pulse" />
                      COGNITIVE FLOW TRACE ({m.actions.length})
                    </span>
                  </div>

                  {m.actions.map((act) => {
                     const isExpanded = !!expandedTrace[act.id];
                     return (
                       <div key={act.id} className="border border-[#393939] bg-[#262626] rounded-none">
                         <button
                           onClick={() => toggleTrace(act.id)}
                           type="button"
                           className="w-full px-2.5 py-1.5 flex items-center justify-between text-[10px] text-[#e0e0e0] hover:bg-[#313131] font-mono transition rounded-none"
                         >
                           <span className="flex items-center gap-1.5 truncate">
                             <span className={`h-1.5 w-1.5 rounded-none ${
                               act.status === 'success' ? 'bg-[#24a148]' : act.status === 'failed' ? 'bg-[#da1e28]' : 'bg-[#f1c21b]'
                             }`} />
                             <span className="text-[#8d8d8d]">[{act.hostName}]</span>
                             <span className="text-[#78a9ff] truncate font-bold">{act.command || 'query stats'}</span>
                           </span>
                           {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-[#8d8d8d]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#8d8d8d]" />}
                         </button>
                         
                         {isExpanded && (
                           <div className="p-3 border-t border-[#393939] font-mono text-[10px] text-[#c6c6c6] bg-[#161616] overflow-x-auto max-h-[140px] rounded-none leading-relaxed">
                             <div className="flex items-center justify-between border-b border-[#393939] pb-1 mb-1 text-[#8d8d8d] font-bold uppercase tracking-wider">
                               <span>EXEC RECOVERY TRACE</span>
                               <span>STATUS_VAL: {act.status.toUpperCase()}</span>
                             </div>
                             <pre className="whitespace-pre">{act.output || 'No output stream parameters registered.'}</pre>
                           </div>
                         )}
                       </div>
                     );
                  })}
                </div>
              )}
              
              <span className="text-[9px] text-[#8d8d8d] font-mono px-0.5 leading-none">{m.timestamp}</span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 text-xs">
            <div className="h-7 w-7 rounded-none bg-[#161616] border border-[#393939] text-[#78a9ff] flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 animate-bounce" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-[85%] font-mono">
              <div className="bg-[#1c1c1c] border border-[#393939] rounded-none p-3 text-[#c6c6c6] animate-pulse flex items-center gap-2">
                <div className="flex gap-1 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-none bg-[#0f62fe] animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-none bg-[#0f62fe] animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-none bg-[#0f62fe] animate-bounce [animation-delay:0.4s]" />
                </div>
                <span className="font-bold text-[10px] text-[#78a9ff] uppercase">
                  {isRecordingTranscription ? 'INIT_STT_AUDIO...' : 'HERMES_SYS_INSPECTING...'}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Input textbox / Recording form */}
      <form onSubmit={handleSubmit} className="p-3 bg-[#161616] border-t border-[#393939] flex gap-2 rounded-none">
        {/* Double Speech Button Controller: STT (Speech to Text Fallback) and Transcription (Gemini-based) */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* 1. Transcribe audio (Voice Dictation - records then uploads 3.5-flash for accurate transcribe) */}
          <button
            type="button"
            onClick={isRecordingTranscription ? stopRecordingTranscription : startRecordingTranscription}
            title={isRecordingTranscription ? "Stop & Transcribe speech" : "Transcribe speech (Accurate via Gemini 3.5)"}
            className={`p-2.5 rounded-none border transition-all relative ${
              isRecordingTranscription 
                ? 'bg-[#f1c21b]/20 border-[#f1c21b] text-[#fcd34d] animate-pulse'
                : 'bg-[#262626] border-[#393939] text-[#c6c6c6] hover:text-white'
            }`}
          >
            <Mic className="h-4 w-4" />
            {isRecordingTranscription && (
              <span className="absolute top-0 right-0 h-2 w-2 rounded-none bg-[#da1e28] animate-ping" />
            )}
          </button>

          {/* 2. Web Speech API (Instant Fallback recognition) */}
          <button
            type="button"
            onClick={toggleListen}
            title={isListening ? "Stop listening" : "Speech to Text (Instant fallback)"}
            className={`p-2.5 rounded-none border transition-all ${
              isListening 
                ? 'bg-[#da1e28]/25 border-[#da1e28] text-white font-bold animate-bounce'
                : 'bg-[#262626] border-[#393939] text-[#c6c6c6] hover:text-white'
            }`}
          >
            <Radio className="h-4 w-4" />
          </button>
        </div>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isRecordingTranscription 
              ? "🔴 Recording incoming waves... Click mic again to translate." 
              : isListening 
              ? "Speech capturing buffers active..." 
              : "Ask BuildOS (e.g. check system health on Node A)..."
          }
          className="flex-1 bg-[#262626] text-white rounded-none border border-[#393939] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#0f62fe] placeholder-[#6f6f6f]"
          disabled={loading || isRecordingTranscription}
        />
        <button
          type="submit"
          disabled={loading || !inputText.trim() || isRecordingTranscription}
          className="bg-[#0f62fe] hover:bg-[#0353e9] text-white font-mono font-bold text-[11px] px-4 py-2.5 rounded-none border border-[#0f62fe] transition-all flex items-center justify-center shrink-0 disabled:opacity-40 uppercase"
        >
          <Send className="h-3.5 w-3.5 mr-1" />
          <span>Execute</span>
        </button>
      </form>
    </div>
  );
}
