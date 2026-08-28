'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/app/components/Toast';
import { loadSettings, saveSettings } from '@/lib/settings';

const PROVIDERS = [
  { id: 'gemini',    name: 'Gemini',    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'anthropic', name: 'Claude',    models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'] },
  { id: 'openai',    name: 'GPT',       models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
] as const;

const KEY_FIELDS = [
  { key: 'gemini',    label: 'Google Gemini',   hint: 'AIzaSy…', group: 'AI' },
  { key: 'anthropic', label: 'Anthropic Claude', hint: 'sk-ant-…', group: 'AI' },
  { key: 'openai',    label: 'OpenAI',           hint: 'sk-…', group: 'AI' },
  { key: 'hunter_io', label: 'Hunter.io',        hint: 'xxxxxxxx…', group: 'Enrichment' },
  { key: 'findymail', label: 'FindyMail',        hint: 'Bearer token…', group: 'Enrichment' },
  { key: 'meta_ads',  label: 'Meta Ads Library', hint: 'EAAxx…', group: 'Scraping' },
] as const;

type Section = 'ai' | 'keys';

export default function Settings() {
  const { showToast } = useToast();
  const [section, setSection] = useState<Section>('ai');
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-2.0-flash');
  const [keys, setKeys] = useState<Record<string, string>>({
    gemini: '', anthropic: '', openai: '', hunter_io: '', findymail: '', meta_ads: '',
  });

  useEffect(() => {
    const s = loadSettings();
    setKeys(s.apiKeys);
    setAiProvider(s.aiConfig.provider);
    setAiModel(s.aiConfig.model);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      saveSettings({
        apiKeys: keys as any,
        aiConfig: { provider: aiProvider as any, model: aiModel },
        defaults: { countries: ['DE', 'AT'], platforms: ['FACEBOOK', 'INSTAGRAM'] },
      });
      showToast('Gespeichert', 'success');
    } catch {
      showToast('Fehler', 'error');
    } finally {
      setSaving(false);
    }
  };

  const currentProvider = PROVIDERS.find(p => p.id === aiProvider)!;
  const filledKeys = KEY_FIELDS.filter(f => keys[f.key]?.length > 0).length;

  const NAV: { id: Section; label: string; desc: string }[] = [
    { id: 'ai',   label: 'AI Modell',  desc: 'Provider & Modell auswählen' },
    { id: 'keys', label: 'API Keys',   desc: `${filledKeys} / ${KEY_FIELDS.length} konfiguriert` },
  ];

  return (
    <div className="min-h-screen bg-noir">
      <div className="max-w-6xl mx-auto px-8 py-12">

        {/* Page Header */}
        <div className="mb-12">
          <p className="text-gold font-mono text-xs tracking-widest uppercase mb-3">Konfiguration</p>
          <h1 className="font-disp text-5xl font-light tracking-tight text-ink mb-1">
            <em className="italic text-gold-bright">Einstellungen</em>
          </h1>
        </div>

        <div className="grid grid-cols-[220px_1fr] gap-8">

          {/* Sidebar */}
          <div className="space-y-1">
            {NAV.map(n => (
              <button
                key={n.id}
                onClick={() => setSection(n.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                  section === n.id
                    ? 'bg-panel-2 border border-gold-dim/40'
                    : 'hover:bg-panel-2/50 border border-transparent'
                }`}
              >
                <p className={`text-sm font-medium transition-colors ${section === n.id ? 'text-gold' : 'text-ink-dim'}`}>
                  {n.label}
                </p>
                <p className="text-xs text-ink-faint mt-0.5 font-mono">{n.desc}</p>
              </button>
            ))}

            <div className="pt-6">
              <button
                onClick={save}
                disabled={saving}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-gold to-gold-dim hover:from-gold-bright hover:to-gold text-noir text-sm font-semibold transition-all disabled:opacity-40"
              >
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>

            {/* Status */}
            <div className="pt-4 space-y-2">
              {KEY_FIELDS.map(f => (
                <div key={f.key} className="flex items-center gap-2 px-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${keys[f.key] ? 'bg-good' : 'bg-line'}`} />
                  <span className="text-xs font-mono text-ink-faint truncate">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            {section === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-disp font-light mb-1">AI <em className="italic text-gold-bright">Provider</em></h2>
                  <p className="text-sm text-ink-faint">Welches Modell für die Lead-Klassifizierung verwendet wird.</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setAiProvider(p.id); setAiModel(p.models[0]); }}
                      className={`p-5 rounded-xl border text-left transition-all ${
                        aiProvider === p.id
                          ? 'border-gold bg-gold/8 shadow-[0_0_30px_-8px_rgba(201,163,95,0.2)]'
                          : 'border-line bg-panel-2 hover:border-line-soft'
                      }`}
                    >
                      <p className={`text-base font-semibold mb-1 ${aiProvider === p.id ? 'text-gold' : 'text-ink'}`}>
                        {p.name}
                      </p>
                      <p className="text-xs font-mono text-ink-faint">{p.models.length} Modelle</p>
                    </button>
                  ))}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-ink mb-3">Modell auswählen</h3>
                  <div className="space-y-2">
                    {currentProvider.models.map(m => (
                      <button
                        key={m}
                        onClick={() => setAiModel(m)}
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-lg border text-left transition-all ${
                          aiModel === m
                            ? 'border-gold-dim bg-panel-2'
                            : 'border-line bg-panel-2/50 hover:border-line-soft hover:bg-panel-2'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full border-2 transition-colors shrink-0 ${
                          aiModel === m ? 'border-gold bg-gold' : 'border-ink-faint'
                        }`} />
                        <span className={`font-mono text-sm ${aiModel === m ? 'text-ink' : 'text-ink-dim'}`}>{m}</span>
                        {m === currentProvider.models[0] && (
                          <span className="ml-auto text-xs font-mono text-gold-dim">empfohlen</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {section === 'keys' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-disp font-light mb-1">API <em className="italic text-gold-bright">Keys</em></h2>
                  <p className="text-sm text-ink-faint">Nur lokal im Browser gespeichert. Nie an externe Server übertragen.</p>
                </div>

                {(['AI', 'Enrichment', 'Scraping'] as const).map(group => {
                  const fields = KEY_FIELDS.filter(f => f.group === group);
                  return (
                    <div key={group}>
                      <p className="text-xs font-mono tracking-widest text-ink-faint uppercase mb-3">{group}</p>
                      <div className="space-y-2">
                        {fields.map(({ key, label, hint }) => {
                          const val = keys[key] || '';
                          const filled = val.length > 0;
                          return (
                            <div
                              key={key}
                              className={`flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${
                                filled ? 'border-good/30 bg-panel-2' : 'border-line bg-panel-2/60'
                              }`}
                            >
                              <div className="w-28 shrink-0">
                                <p className="text-sm font-medium text-ink">{label}</p>
                              </div>
                              <div className="flex-1 relative">
                                <input
                                  type={show[key] ? 'text' : 'password'}
                                  value={val}
                                  onChange={e => setKeys(p => ({ ...p, [key]: e.target.value }))}
                                  placeholder={hint}
                                  className="w-full bg-transparent border-0 text-sm font-mono text-ink placeholder:text-ink-faint/30 outline-none py-0"
                                />
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {filled && (
                                  <span className="text-xs font-mono text-good">✓</span>
                                )}
                                <button
                                  onClick={() => setShow(p => ({ ...p, [key]: !p[key] }))}
                                  className="text-ink-faint hover:text-ink transition-colors text-xs font-mono w-4"
                                >
                                  {show[key] ? '●' : '○'}
                                </button>
                                {filled && (
                                  <button
                                    onClick={() => setKeys(p => ({ ...p, [key]: '' }))}
                                    className="text-ink-faint hover:text-bad transition-colors text-xs"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
