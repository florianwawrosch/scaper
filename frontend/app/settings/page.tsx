'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/app/components/Toast';
import { loadSettings, saveSettings, type AppSettings } from '@/lib/settings';

const API_KEY_FIELDS = [
  { key: 'gemini',    label: 'Google Gemini',       placeholder: 'AIza…' },
  { key: 'anthropic', label: 'Anthropic',            placeholder: 'sk-ant-…' },
  { key: 'openai',    label: 'OpenAI',               placeholder: 'sk-…' },
  { key: 'meta_ads',  label: 'Meta Ads Library Token', placeholder: 'EAAxx…' },
  { key: 'hunter_io', label: 'Hunter.io',            placeholder: 'xxxxxxxx…' },
  { key: 'findymail', label: 'FindyMail',            placeholder: 'Bearer token…' },
] as const;

const MODELS: Record<string, string[]> = {
  gemini:    ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
  openai:    ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
};

export default function Settings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    gemini: '', anthropic: '', openai: '', meta_ads: '', hunter_io: '', findymail: '',
  });
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-2.0-flash');

  useEffect(() => {
    const s = loadSettings();
    setApiKeys(s.apiKeys);
    setAiProvider(s.aiConfig.provider);
    setAiModel(s.aiConfig.model);
    setLoading(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      saveSettings({
        apiKeys: apiKeys as any,
        aiConfig: { provider: aiProvider as 'gemini' | 'anthropic' | 'openai', model: aiModel },
        defaults: { countries: ['DE', 'AT'], platforms: ['FACEBOOK', 'INSTAGRAM'] },
      });
      showToast('Einstellungen gespeichert', 'success');
    } catch {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-noir flex items-center justify-center">
        <p className="text-ink-faint font-mono text-xs tracking-wider animate-pulse">Lädt…</p>
      </div>
    );
  }

  const toggleShow = (key: string) => setShowKeys(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="min-h-screen bg-noir">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-10">
          <p className="text-gold font-mono text-xs tracking-widest uppercase mb-2">Konfiguration</p>
          <h1 className="text-4xl font-disp font-light tracking-tight">
            <em className="italic text-gold-bright">Einstellungen</em>
          </h1>
        </div>

        <div className="space-y-3">
          {/* AI Provider */}
          <div className="border border-line rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-line bg-panel flex items-center gap-3">
              <span className="text-gold font-mono text-xs tracking-widest">01</span>
              <span className="text-xs font-mono tracking-wider text-ink uppercase">AI Konfiguration</span>
            </div>
            <div className="p-5 bg-panel-2 space-y-4">
              <div>
                <label className="block text-xs font-mono tracking-wider text-ink-faint uppercase mb-2">Provider</label>
                <div className="flex gap-2">
                  {Object.keys(MODELS).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setAiProvider(p);
                        setAiModel(MODELS[p][0]);
                      }}
                      className={`px-3 py-1.5 text-xs font-mono tracking-wide rounded border transition-all ${
                        aiProvider === p
                          ? 'bg-gold text-noir border-gold font-semibold'
                          : 'border-line text-ink-faint hover:border-gold-dim hover:text-ink'
                      }`}
                    >
                      {p === 'gemini' ? 'Gemini' : p === 'anthropic' ? 'Anthropic' : 'OpenAI'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-ink-faint uppercase mb-2">Modell</label>
                <div className="flex gap-2 flex-wrap">
                  {MODELS[aiProvider]?.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAiModel(m)}
                      className={`px-3 py-1.5 text-xs font-mono tracking-wide rounded border transition-all ${
                        aiModel === m
                          ? 'border-gold-dim text-gold bg-gold/10'
                          : 'border-line text-ink-faint hover:border-line-soft hover:text-ink'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* API Keys */}
          <div className="border border-line rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-line bg-panel flex items-center gap-3">
              <span className="text-gold font-mono text-xs tracking-widest">02</span>
              <span className="text-xs font-mono tracking-wider text-ink uppercase">API Keys</span>
              <span className="ml-auto text-xs font-mono text-ink-faint">nur lokal gespeichert</span>
            </div>
            <div className="p-5 bg-panel-2 space-y-3">
              {API_KEY_FIELDS.map(({ key, label, placeholder }) => {
                const val = apiKeys[key] || '';
                const hasValue = val.length > 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-mono tracking-wider text-ink-faint">{label}</label>
                      {hasValue && (
                        <span className="text-xs font-mono text-good tracking-wider">✓ gesetzt</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type={showKeys[key] ? 'text' : 'password'}
                        value={val}
                        onChange={e => setApiKeys(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="flex-1 bg-panel-3 border border-line rounded text-ink text-xs font-mono px-3 py-2 focus:outline-none focus:border-gold-dim transition-colors placeholder:text-ink-faint/40"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShow(key)}
                        className="px-2.5 border border-line rounded text-ink-faint hover:text-ink transition-colors text-xs"
                        title={showKeys[key] ? 'Verbergen' : 'Anzeigen'}
                      >
                        {showKeys[key] ? '●' : '○'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info */}
          <div className="bg-panel-2 border border-line rounded-lg p-4 flex gap-3">
            <div className="w-1 bg-gold-dim rounded shrink-0" />
            <div className="text-xs text-ink-faint space-y-1">
              <p className="text-ink font-mono tracking-wide">Datenschutz</p>
              <p>API-Keys werden ausschließlich lokal im Browser-Speicher (localStorage) gespeichert.</p>
              <p>Keine Übertragung an externe Server — nur direkte API-Calls von deinem Browser.</p>
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-gold to-gold-dim hover:from-gold-bright hover:to-gold text-noir font-semibold text-sm tracking-wide transition-all disabled:opacity-40"
          >
            {saving ? 'Speichert…' : 'Einstellungen speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
