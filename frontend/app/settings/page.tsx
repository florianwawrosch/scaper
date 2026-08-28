'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/app/components/Toast';
import { loadSettings, saveSettings } from '@/lib/settings';

const PROVIDERS = [
  { id: 'gemini',    name: 'Gemini',  sub: 'Google AI',  models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'anthropic', name: 'Claude',  sub: 'Anthropic',  models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'] },
  { id: 'openai',    name: 'GPT',     sub: 'OpenAI',     models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
] as const;

const KEY_FIELDS = [
  { key: 'gemini',    label: 'Google Gemini',   hint: 'AIzaSy…',       group: 'AI'          },
  { key: 'anthropic', label: 'Anthropic Claude', hint: 'sk-ant-…',      group: 'AI'          },
  { key: 'openai',    label: 'OpenAI',           hint: 'sk-…',          group: 'AI'          },
  { key: 'hunter_io', label: 'Hunter.io',        hint: 'xxxxxxxx…',     group: 'Enrichment'  },
  { key: 'findymail', label: 'FindyMail',        hint: 'Bearer token…', group: 'Enrichment'  },
  { key: 'meta_ads',  label: 'Meta Ads Library', hint: 'EAAxx…',        group: 'Scraping'    },
] as const;

type Section = 'ai' | 'keys';

export default function Settings() {
  const { showToast } = useToast();
  const [section,    setSection]    = useState<Section>('ai');
  const [saving,     setSaving]     = useState(false);
  const [show,       setShow]       = useState<Record<string, boolean>>({});
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel,    setAiModel]    = useState('gemini-2.0-flash');
  const [keys,       setKeys]       = useState<Record<string, string>>({
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
    { id: 'ai',   label: 'AI Modell', desc: 'Provider & Modell'             },
    { id: 'keys', label: 'API Keys',  desc: `${filledKeys} / ${KEY_FIELDS.length} konfiguriert` },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px 80px' }}>

        {/* Title */}
        <div style={{ marginBottom: 48 }}>
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <span className="idx">CONFIG</span>
            <h1 style={{ fontSize: 'clamp(24px, 3vw, 38px)' }}><em style={{ color: '#f5cc77' }}>Einstellungen</em></h1>
            <div className="rule" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32, alignItems: 'start' }}>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.map(n => {
              const active = section === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setSection(n.id)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: active ? '1px solid rgba(232,176,75,.25)' : '1px solid transparent',
                    background: active ? 'rgba(232,176,75,.06)' : 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                >
                  <p style={{ fontFamily: "'Spline Sans', sans-serif", fontSize: 13, fontWeight: 500, color: active ? '#e8b04b' : '#9aa7bd', marginBottom: 3 }}>{n.label}</p>
                  <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, color: '#5f6e87', letterSpacing: '.04em' }}>{n.desc}</p>
                </button>
              );
            })}

            <div style={{ marginTop: 20 }}>
              <button className="btn-primary" onClick={save} disabled={saving} style={{ maxWidth: '100%' }}>
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>

            {/* Key status */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {KEY_FIELDS.map(f => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: keys[f.key] ? '#4fd1c5' : 'rgba(95,110,135,.4)', flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10.5, color: '#5f6e87', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>

            {/* ===== AI section ===== */}
            {section === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
                <div>
                  <div className="sec-head">
                    <span className="idx">01</span>
                    <h2>AI <em style={{ color: '#f5cc77' }}>Provider</em></h2>
                    <div className="rule" />
                  </div>
                  <p style={{ color: '#5f6e87', fontSize: 13.5, marginBottom: 20 }}>
                    Welches Modell für die Lead-Klassifizierung verwendet wird.
                  </p>

                  {/* Provider cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    {PROVIDERS.map(p => {
                      const active = aiProvider === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => { setAiProvider(p.id); setAiModel(p.models[0]); }}
                          style={{
                            padding: '20px 22px',
                            borderRadius: 14,
                            border: active ? '1px solid rgba(232,176,75,.45)' : '1px solid rgba(255,255,255,.07)',
                            background: active ? 'rgba(232,176,75,.07)' : 'rgba(255,255,255,.02)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all .15s',
                            boxShadow: active ? '0 0 28px -6px rgba(232,176,75,.2)' : 'none',
                          }}
                        >
                          <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 600, color: active ? '#f5cc77' : '#f4efe4', marginBottom: 4 }}>{p.name}</p>
                          <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, color: '#5f6e87', letterSpacing: '.1em' }}>{p.sub}</p>
                          <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, color: '#5f6e87', marginTop: 8 }}>{p.models.length} Modelle</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Model selection */}
                <div>
                  <div className="sec-head">
                    <span className="idx">02</span>
                    <h2>Modell</h2>
                    <div className="rule" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {currentProvider.models.map((m, mi) => {
                      const active = aiModel === m;
                      return (
                        <button
                          key={m}
                          onClick={() => setAiModel(m)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: '16px 20px',
                            borderRadius: 10,
                            border: active ? '1px solid rgba(232,176,75,.35)' : '1px solid rgba(255,255,255,.07)',
                            background: active ? 'rgba(232,176,75,.06)' : 'rgba(255,255,255,.02)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all .15s',
                          }}
                        >
                          <div style={{
                            width: 14, height: 14, borderRadius: '50%',
                            border: active ? '2px solid #e8b04b' : '2px solid rgba(95,110,135,.5)',
                            background: active ? '#e8b04b' : 'transparent',
                            flexShrink: 0,
                            transition: 'all .15s',
                          }} />
                          <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 13, color: active ? '#f4efe4' : '#9aa7bd', flex: 1 }}>{m}</span>
                          {mi === 0 && (
                            <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.1em', color: '#e8b04b', opacity: .7 }}>EMPFOHLEN</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ===== Keys section ===== */}
            {section === 'keys' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
                <div>
                  <div className="sec-head" style={{ marginBottom: 8 }}>
                    <span className="idx">KEY</span>
                    <h2>API <em style={{ color: '#f5cc77' }}>Keys</em></h2>
                    <div className="rule" />
                  </div>
                  <p style={{ color: '#5f6e87', fontSize: 13.5, marginBottom: 0 }}>
                    Nur lokal im Browser gespeichert. Nie an externe Server übertragen.
                  </p>
                </div>

                {(['AI', 'Enrichment', 'Scraping'] as const).map(group => {
                  const fields = KEY_FIELDS.filter(f => f.group === group);
                  return (
                    <div key={group}>
                      <div className="sec-head">
                        <span className="idx">{group.toUpperCase()}</span>
                        <h2 style={{ fontSize: 18 }}>{group}</h2>
                        <div className="rule" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {fields.map(({ key, label, hint }) => {
                          const val    = keys[key] || '';
                          const filled = val.length > 0;
                          return (
                            <div
                              key={key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                padding: '14px 20px',
                                borderRadius: 12,
                                border: filled ? '1px solid rgba(79,209,197,.2)' : '1px solid rgba(255,255,255,.07)',
                                background: filled ? 'rgba(79,209,197,.04)' : 'rgba(255,255,255,.02)',
                                transition: 'all .15s',
                              }}
                            >
                              <div style={{ width: 120, flexShrink: 0 }}>
                                <p style={{ fontFamily: "'Spline Sans', sans-serif", fontSize: 13, fontWeight: 500, color: '#f4efe4' }}>{label}</p>
                              </div>
                              <div style={{ flex: 1, position: 'relative' }}>
                                <input
                                  type={show[key] ? 'text' : 'password'}
                                  value={val}
                                  onChange={e => setKeys(p => ({ ...p, [key]: e.target.value }))}
                                  placeholder={hint}
                                  style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: 'none',
                                    padding: 0,
                                    fontSize: 13,
                                    fontFamily: "'Spline Sans Mono', monospace",
                                    color: '#f4efe4',
                                    outline: 'none',
                                    boxShadow: 'none',
                                  }}
                                />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                {filled && <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#4fd1c5' }}>✓</span>}
                                <button
                                  onClick={() => setShow(p => ({ ...p, [key]: !p[key] }))}
                                  style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#5f6e87', width: 16 }}
                                >
                                  {show[key] ? '●' : '○'}
                                </button>
                                {filled && (
                                  <button
                                    onClick={() => setKeys(p => ({ ...p, [key]: '' }))}
                                    style={{ fontSize: 16, color: '#5f6e87', lineHeight: 1 }}
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
