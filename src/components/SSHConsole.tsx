import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Trash2, ArrowRight, Sparkles, AlertCircle, RefreshCw, X, FileText } from 'lucide-react';
import { HostMachine } from '../types';

interface SSHConsoleProps {
  host: HostMachine | null;
  onLogged: (command: string, output: string, isError: boolean) => void;
  currentUserRole?: 'admin' | 'viewer' | null;
}

interface CommandHistory {
  cmd: string;
  res: string;
  isErr: boolean;
  time: string;
}

export default function SSHConsole({ host, onLogged, currentUserRole }: SSHConsoleProps) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Gemini Intelligence diagnostic states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    // Clear terminal history when selected host ID changes (not on object ref change)
    setHistory([]);
    setDiagnosticReport(null);
    setAnalysisError(null);
  }, [host?.id]);

  useEffect(() => {
    // Scroll to bottom on updates
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  if (!host) {
    return (
      <div id="no-console" className="h-[380px] flex flex-col items-center justify-center text-center p-6 bg-[#262626] border border-[#393939] rounded-none shadow-lg">
        <Terminal className="h-8 w-8 text-[#8d8d8d] mb-4 animate-pulse" />
        <p className="text-xs font-bold text-white uppercase tracking-wider font-mono">No Host Node Selected</p>
        <p className="text-xs text-[#a8a8a8] mt-2.5 max-w-xs leading-relaxed">
          Select a connected machine card from the primary workspace grid to establish an interactive SSH commands shell.
        </p>
      </div>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmdRun = command.trim();
    if (!cmdRun) return;

    setCommand('');
    setLoading(true);

    const userEntry: CommandHistory = {
      cmd: cmdRun,
      res: 'In transit...',
      isErr: false,
      time: new Date().toLocaleTimeString()
    };

    setHistory((prev) => [...prev, userEntry]);

    try {
      const response = await fetch('/api/ssh/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hostId: host.id, 
          host: host, // Send rich host content so we bypass DB constraints
          command: cmdRun 
        }),
      });

      const data = await response.json();

      setHistory((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last) {
          last.res = data.output;
          last.isErr = !!data.isError;
        }
        return copy;
      });

      // Bubble up logs
      onLogged(cmdRun, data.output, !!data.isError);

    } catch (error: any) {
      setHistory((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last) {
          last.res = `Connection Failure: ${error.message || 'Cannot reach SSH Agent Gateway.'}`;
          last.isErr = true;
        }
        return copy;
      });
    } finally {
      setLoading(false);
    }
  };

  // Run Gemini Intelligence node-audit on active machine
  const runDiagnosticsAudit = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setDiagnosticReport(null);
    setShowReportModal(true);

    try {
      const response = await fetch('/api/analyze-diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          logs: history.map(h => ({ command: h.cmd, output: h.res, isError: h.isErr }))
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Diagnostic computation failed.');
      }

      const data = await response.json();
      setDiagnosticReport(data.text);
    } catch (e: any) {
      console.error(e);
      setAnalysisError(e.message || 'Connecting failure to diagnostics compiler.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <div id="ssh-terminal-card" className="border border-[#393939] bg-[#262626] rounded-none flex flex-col h-full shadow-lg">
      
      {/* Title block */}
      <div className="bg-[#161616] px-4 py-3.5 border-b border-[#393939] flex flex-wrap items-center justify-between gap-3 font-mono">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-none bg-[#0f62fe] animate-pulse" />
          <span className="text-[11px] font-semibold text-[#f4f4f4] select-all tracking-wider">
            {host.username}@{host.ip}:{host.port} {host.isSimulated && '(VIRTUAL)'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Gemini AI Intelligence Action */}
          <button
            onClick={runDiagnosticsAudit}
            title="Inspect server metrics and security with Gemini AI"
            className="bg-[#0f62fe] hover:bg-[#0353e9] text-white rounded-none px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI AUDIT NODE</span>
          </button>

          <span className="text-[10px] hidden sm:block bg-[#393939] text-[#c6c6c6] font-bold px-2 py-0.5 border border-[#4d4d4d] select-none rounded-none">
            SHELL SHOLD
          </span>

          {history.length > 0 && (
            <button
              onClick={clearHistory}
              title="Clear terminal text log window"
              className="p-1 px-2 text-[#8d8d8d] hover:text-[#da1e28] transition rounded-none bg-[#161616] border border-[#393939]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal lines wrapper */}
      <div
        ref={scrollRef}
        id="ssh-terminal-body"
        className="flex-1 p-4 font-mono text-[11px] text-[#c6c6c6] overflow-y-auto space-y-3 bg-[#161616] min-h-[180px] max-h-[300px] leading-relaxed"
      >
        <p className="text-[#8d8d8d] italic">
          Last login: {new Date().toDateString()} via IBM-Plex-Carbon-Agent
        </p>
        <p className="text-[#78a9ff] font-semibold">
          * Node connection {host.name} state established. Command interface ready.
        </p>

        {history.map((h, i) => (
          <div key={i} className="space-y-1.5 animate-fade-in">
            <div className="flex items-center justify-between text-[#8d8d8d] text-[10px]">
              <span className="flex items-center gap-1">
                <ArrowRight className="h-2.5 w-2.5 text-[#0f62fe]" />
                {host.username}@{host.ip}
              </span>
              <span>{h.time}</span>
            </div>
            <div className="font-bold text-white uppercase tracking-wider">$ {h.cmd}</div>
            <pre className={`whitespace-pre-wrap p-3 leading-relaxed border rounded-none ${
              h.isErr
                ? 'bg-[#da1e28]/10 border-[#da1e28]/40 text-[#ffb3b8]'
                : h.res === 'In transit...'
                ? 'bg-[#262626]/40 border-[#393939] text-[#8d8d8d] animate-pulse'
                : 'bg-[#262626] border-[#393939] text-[#e0e0e0]'
            }`}>
              {h.res}
            </pre>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-[#8d8d8d] animate-pulse text-[10px]">
            <span className="h-1.5 w-1.5 rounded-none bg-[#0f62fe] animate-bounce" />
            <span>EXPATIATING NODE AGENT CHANNELS...</span>
          </div>
        )}
      </div>

      {/* Form command field */}
      <form onSubmit={handleSend} className="p-3 bg-[#161616] border-t border-[#393939] flex gap-2 rounded-none">
        <label className="text-[#8d8d8d] font-mono text-xs self-center select-none font-bold">$</label>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={currentUserRole === 'viewer' ? "READ-ONLY: Custom terminal executions blocked for viewers." : "Enter custom host shell command (e.g. docker ps, df -h, ls -la)..."}
          className="flex-1 bg-[#262626] text-[#78a9ff] font-mono text-xs border border-[#393939] rounded-none px-3.5 py-2.5 focus:outline-none focus:border-[#0f62fe] placeholder-[#6f6f6f] disabled:opacity-60"
          disabled={loading || currentUserRole === 'viewer'}
        />
        <button
          type="submit"
          className="bg-[#0f62fe] hover:bg-[#0353e9] text-white rounded-none px-4 py-2 transition-all flex items-center justify-center shrink-0 disabled:opacity-50 font-bold border border-[#0f62fe]"
          disabled={loading || !command.trim() || currentUserRole === 'viewer'}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>

      {/* Gemini Diagnostic Intelligence Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-none flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-[#393939] rounded-none w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="bg-[#262626] px-6 py-4 border-b border-[#393939] flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono">
                <Sparkles className="h-4.5 w-4.5 text-[#78a9ff] animate-pulse" />
                <h3 className="font-semibold text-white text-[12px] uppercase tracking-wider">AI DIAGNOSTIC HEALTH EVALUATION</h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 px-2 border border-[#393939] bg-[#161616] text-[#c6c6c6] hover:text-white transition rounded-none text-xs"
              >
                CLOSE [X]
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs leading-relaxed text-[#c6c6c6]">
              
              <div className="flex items-center gap-2.5 bg-[#0f62fe]/10 border border-[#0f62fe]/40 p-3 rounded-none text-[#78a9ff] font-mono">
                <FileText className="h-4.5 w-4.5 shrink-0" />
                <span>
                  INTELLIGENCE ENGINE SCANNING NODE: <strong>{host.name}</strong> ({host.ip})
                </span>
              </div>

              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4 font-mono">
                  <RefreshCw className="h-6 w-6 text-[#0f62fe] animate-spin" />
                  <p className="font-bold text-white text-[11px] uppercase tracking-widest">EVALUATING HEURISTICS TABLE_STACK...</p>
                  <p className="text-[10px] text-[#8d8d8d]">Mapping Postgres configurations & memory leakage vectors...</p>
                </div>
              ) : analysisError ? (
                <div className="flex items-center gap-2 p-3 bg-[#da1e28]/10 border border-[#da1e28]/30 text-[#ffb3b8] rounded-none font-mono">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{analysisError}</span>
                </div>
              ) : (
                <div className="font-sans leading-relaxed text-[#e0e0e0] max-w-none space-y-4 whitespace-pre-wrap text-xs border border-[#393939] bg-[#1c1c1c] p-4 rounded-none scrollbar-thin">
                  {diagnosticReport}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#262626] px-6 py-3 border-t border-[#393939] flex items-center justify-between font-mono">
              <span className="text-[9px] text-[#8d8d8d]">COMPILED BY COGNITIVE_FLASH_3.5</span>
              <button
                onClick={() => setShowReportModal(false)}
                className="bg-[#0f62fe] hover:bg-[#0353e9] text-white font-bold text-xs px-5 py-2 rounded-none border border-[#0f62fe] transition-all"
              >
                Close Report
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
