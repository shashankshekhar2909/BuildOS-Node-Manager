import React, { useState, useEffect } from 'react';
import { Settings, Save, ShieldCheck, Sparkles, Check } from 'lucide-react';
import { LLMConfig, LLMProvider } from '../types';

interface LLMConfigPanelProps {
  onSaved: (config: LLMConfig) => void;
}

export default function LLMConfigPanel({ onSaved }: LLMConfigPanelProps) {
  const [provider, setProvider] = useState<LLMProvider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('gemini-3.5-flash');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    // Fetch server configuration on load
    fetch('/api/config')
      .then((res) => res.json())
      .then((data: LLMConfig) => {
        setProvider(data.provider || 'gemini');
        setApiKey(data.apiKey || '');
        setModelName(data.modelName || 'gemini-3.5-flash');
        setCustomEndpoint(data.customEndpoint || '');
      })
      .catch((err) => console.error('Error fetching LLM config:', err));
  }, []);

  const handleProviderPreset = (prov: LLMProvider) => {
    setProvider(prov);
    if (prov === 'gemini') {
      setModelName('gemini-3.5-flash');
      setCustomEndpoint('');
    } else if (prov === 'openai') {
      setModelName('gpt-4o-mini');
      setCustomEndpoint('https://api.openai.com/v1');
    } else if (prov === 'anthropic') {
      setModelName('claude-3-5-sonnet-latest');
      setCustomEndpoint('https://api.anthropic.com/v1');
    } else if (prov === 'groq') {
      setModelName('llama-3.3-70b-versatile');
      setCustomEndpoint('');
    } else {
      setModelName('');
      setCustomEndpoint('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSavedSuccess(false);

    const config: LLMConfig = {
      provider,
      apiKey,
      modelName,
      customEndpoint: customEndpoint || undefined
    };

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await response.json();
      setSavedSuccess(true);
      onSaved(data);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving LLM config:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="llm-config-panel" className="bg-[#262626] border border-[#393939] rounded-none p-6 shadow-md space-y-4 font-sans text-xs">
      <div className="flex items-center gap-2 border-b border-[#393939] pb-4 font-mono">
        <Settings className="h-4.5 w-4.5 text-[#78a9ff]" />
        <h3 className="font-bold text-white text-xs uppercase tracking-wider">Agent Brain System (Model Parameters)</h3>
      </div>
      
      <p className="text-xs text-[#c6c6c6] leading-relaxed">
        The Hermes SSH System orchestrates actions across remote node host machines. Configure the provider backend engine parameter variables below. All environment configurations are handled securely.
      </p>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Choose Provider */}
        <div>
          <label className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block mb-1.5 font-mono">Model Engine Provider</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(['gemini', 'openai', 'anthropic', 'groq', 'custom'] as LLMProvider[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleProviderPreset(p)}
                className={`py-2 px-1.5 rounded-none font-bold text-[11px] border uppercase tracking-wider font-mono transition duration-150 ${
                  provider === p
                    ? 'bg-[#0f62fe] border-[#0f62fe] text-white'
                    : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:bg-[#313131]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input variables depending on provider */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block mb-1.5 font-mono">Model ID String</label>
            <input
              type="text"
              required
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. gemini-3.5-flash / gpt-4o-mini"
              className="w-full bg-[#161616] border border-[#393939] rounded-none px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#0f62fe] transition"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block mb-1.5 font-mono">
              {provider === 'gemini' ? 'Gemini API Key (Optional Override)' : provider === 'groq' ? 'Groq Secret Key (Optional Override)' : 'Provider Secret Key'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'gemini' ? 'Injected automatically from secrets' : provider === 'groq' ? 'GROQ_API_KEY from env or custom key' : 'sk-••••••••••••'}
              className="w-full bg-[#161616] border border-[#393939] rounded-none px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#0f62fe] placeholder-zinc-600 transition"
            />
          </div>
        </div>

        {provider === 'custom' && (
          <div>
            <label className="text-[10px] font-bold text-[#8d8d8d] uppercase tracking-wider block mb-1.5 font-mono">Custom Endpoint Base URL</label>
            <input
              type="url"
              required
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="e.g. https://your-llama-proxy.com/v1"
              className="w-full bg-[#161616] border border-[#393939] rounded-none px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#0f62fe] transition"
            />
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#393939] pt-4 mt-2">
          <div className="flex items-center gap-1.5 text-[10px] text-[#8d8d8d] select-none font-mono">
            <ShieldCheck className="h-4 w-4 text-[#78a9ff] shrink-0" />
            <span>KEYS SECURED IN CONTAINER STATE</span>
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 rounded-none text-xs font-mono font-bold uppercase flex items-center gap-1.5 transition-all duration-150 ${
              savedSuccess
                ? 'bg-[#24a148] border-[#24a148] text-white animate-pulse'
                : 'bg-[#0f62fe] hover:bg-[#0353e9] text-white border border-[#0f62fe]'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="h-3.5 w-3.5 animate-bounce" />
                <span>SAVED BRAIN_VAL</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>{loading ? 'STORING...' : 'APPLY BRAIN'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
