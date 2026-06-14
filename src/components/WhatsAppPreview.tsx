import React, { useState } from 'react';
import { Copy, Check, MessageSquare, Bot, AlertCircle, Sparkles } from 'lucide-react';

interface WhatsAppMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  time: string;
}

export default function WhatsAppPreview() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([
    {
      id: 'm1',
      sender: 'agent',
      text: '🤖 SSH Agent Active.\nSend me queries like "df -h", "docker ps on production" or "uptime staging" to command your machines.',
      time: '12:00 PM',
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhook/whatsapp`
      : 'https://ais-dev-...run.app/api/webhook/whatsapp'
  );
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendSim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg: WhatsAppMessage = {
      id: `m-u-${Date.now()}`,
      sender: 'user',
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    const prompt = inputText;
    setInputText('');
    setLoading(true);

    try {
      // Send directly to webhook endpoint to see Twilio TwiML xml responses
      const response = await fetch('/api/webhook/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Body: prompt, From: '+1234567890' }),
      });

      const xmlText = await response.text();
      // Extract response message inside <Message>...</Message> tags
      const match = xmlText.match(/<Message>([\s\S]*?)<\/Message>/);
      const replyText = match ? match[1].trim() : xmlText || 'No reply generated.';

      setMessages((prev) => [
        ...prev,
        {
          id: `m-a-${Date.now()}`,
          sender: 'agent',
          text: replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);

    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `m-a-err-${Date.now()}`,
          sender: 'agent',
          text: `🚨 Webhook integration failed: ${e.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="whatsapp-integration-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6">
      {/* Settings Guide */}
      <div className="lg:col-span-7 bg-[#262626] border border-[#393939] rounded-none p-6 space-y-4 shadow-md font-sans">
        <div className="flex items-center gap-2 border-b border-[#393939] pb-3.5">
          <MessageSquare className="h-5 w-5 text-[#78a9ff]" />
          <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">WhatsApp Callback Hook & Twilio Setup</h3>
        </div>

        <p className="text-xs text-[#c6c6c6] leading-relaxed">
          The BuildOS dashboard exposes a Twilio-compliant webhook endpoint. You can bind a Twilio WhatsApp phone number to this backend to interact with remote host nodes via instant message queries.
        </p>

        {/* Copy Callback Box */}
        <div className="space-y-2 bg-[#161616] p-4 border border-[#393939] rounded-none">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#78a9ff] select-none uppercase tracking-wider font-mono">Callback Webhook Endpoints</span>
            <button
              onClick={copyUrl}
              className="text-[11px] text-[#8d8d8d] hover:text-white flex items-center gap-1.5 transition font-mono font-semibold"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#24a148]" />
                  <span className="text-[#42be65]">COPIED</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>COPY LINK</span>
                </>
              )}
            </button>
          </div>
          <span className="block font-mono text-[11px] text-slate-300 w-full overflow-x-auto whitespace-nowrap bg-[#262626] p-2.5 border border-[#393939] rounded-none">
            {webhookUrl}
          </span>
        </div>

        {/* Steps */}
        <div className="space-y-4 text-xs text-[#c6c6c6] pt-1 font-sans">
          <div className="flex gap-3 items-start">
            <div className="h-6 w-6 bg-[#161616] text-[#78a9ff] border border-[#393939] text-xs flex items-center justify-center font-bold rounded-none shrink-0 font-mono">01</div>
            <div>
              <p className="font-bold text-[#f4f4f4] uppercase tracking-wider text-[11px]">Set Up Twilio Console</p>
              <p className="text-[#a8a8a8] text-[11.5px] mt-0.5 leading-relaxed">Access Twilio Messaging, select Sandbox or acquire a dedicated outbound phone number with API WhatsApp permissions.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="h-6 w-6 bg-[#161616] text-[#78a9ff] border border-[#393939] text-xs flex items-center justify-center font-bold rounded-none shrink-0 font-mono">02</div>
            <div>
              <p className="font-bold text-[#f4f4f4] uppercase tracking-wider text-[11px]">Bind URL Callback</p>
              <p className="text-[#a8a8a8] text-[11.5px] mt-0.5 leading-relaxed">Paste the copied URL above into the <code className="text-[#78a9ff] font-mono">"WHEN A MESSAGE COMES IN"</code> HTTP POST parameter inside Sandbox Webhook settings.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="h-6 w-6 bg-[#161616] text-[#78a9ff] border border-[#393939] text-xs flex items-center justify-center font-bold rounded-none shrink-0 font-mono">03</div>
            <div>
              <p className="font-bold text-[#f4f4f4] uppercase tracking-wider text-[11px]">Broadcast Test Commands</p>
              <p className="text-[#a8a8a8] text-[11.5px] mt-0.5 leading-relaxed">Send messaging requests directly to the registered phone. The system triggers background SSH actions on target machines and replies back.</p>
            </div>
          </div>
        </div>

        <div className="bg-[#0f62fe]/10 border border-[#0f62fe]/40 p-4 rounded-none flex items-start gap-2.5 text-[#78a9ff] mt-2 font-mono text-[10px]">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-[#78a9ff]" />
          <p className="leading-relaxed uppercase">
            Please ensure model API Keys are configured on the primary Brain system console card to authorize automatic query resolution.
          </p>
        </div>
      </div>

      {/* WhatsApp Simulated Phone Preview */}
      <div className="lg:col-span-5 flex flex-col h-full">
        <div id="smartphone-container" className="border border-[#393939] bg-[#262626] rounded-none overflow-hidden flex flex-col shadow-lg h-[440px] relative">
          
          <div className="bg-[#161616] px-4 py-3 flex items-center gap-2 border-b border-[#393939] select-none font-mono">
            <div className="relative">
              <div className="h-8 w-8 rounded-none bg-[#393939] border border-[#4d4d4d] flex items-center justify-center font-bold text-xs text-white">
                <Bot className="h-3.5 w-3.5 text-[#78a9ff]" />
              </div>
              <div className="absolute right-0 bottom-0 h-1.5 w-1.5 rounded-none bg-[#24a148]" />
            </div>
            <div>
              <h4 className="text-white text-xs font-bold leading-none uppercase tracking-wider">SMS_WEBHOOK_BRIDGE</h4>
              <span className="text-[9px] text-[#8d8d8d] block mt-0.5">VIRTUAL TELEMETRY PORT</span>
            </div>
          </div>

          <div id="whatsapp-threads" className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-[#161616] flex flex-col justify-end">
            <div className="space-y-2.5 max-h-[310px] overflow-y-auto">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[85%] rounded-none px-3 py-2 text-xs text-white border ${
                    m.sender === 'user' 
                      ? 'bg-[#393939] border-[#4d4d4d] self-end ml-auto' 
                      : 'bg-[#262626] border-[#393939] self-start mr-auto text-stone-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                  <span className="text-[9px] text-[#8d8d8d] self-end mt-1 font-mono">{m.time}</span>
                </div>
              ))}

              {loading && (
                <div className="bg-[#262626] border border-[#393939] rounded-none px-3.5 py-2 max-w-[50%] mr-auto text-xs text-[#8d8d8d] animate-pulse flex items-center gap-1.5 self-start font-mono">
                  <span className="h-1.5 w-1.5 rounded-none bg-[#0f62fe] animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-none bg-[#0f62fe] animate-bounce [animation-delay:0.2s]" />
                  <span className="uppercase text-[9px] font-bold">DISPATCHING...</span>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSendSim} className="p-2 border-t border-[#393939] bg-[#161616] flex gap-2 rounded-none">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Query remote hosts..."
              className="flex-1 bg-[#262626] text-white border border-[#393939] rounded-none px-3 py-2 text-xs focus:outline-none focus:border-[#0f62fe] placeholder-[#6f6f6f]"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="bg-[#0f62fe] hover:bg-[#0353e9] rounded-none h-8 px-4 flex items-center justify-center shrink-0 disabled:opacity-50 text-white font-mono text-[11px] font-bold uppercase transition"
            >
              SIM_SEND
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
