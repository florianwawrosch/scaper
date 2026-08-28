'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/app/components/Toast';
import { loadSettings, saveSettings } from '@/lib/settings';

const KEY_FIELDS = [
  { key: 'gemini',    label: 'Google Gemini',   hint: 'AIzaSy…',       group: 'AI'         },
  { key: 'anthropic', label: 'Anthropic Claude', hint: 'sk-ant-…',      group: 'AI'         },
  { key: 'openai',    label: 'OpenAI',           hint: 'sk-…',          group: 'AI'         },
  { key: 'hunter_io', label: 'Hunter.io',        hint: 'xxxxxxxx…',     group: 'Enrichment' },
  { key: 'findymail', label: 'FindyMail',        hint: 'Bearer token…', group: 'Enrichment' },
  { key: 'meta_ads',  label: 'Meta Ads Library', hint: 'EAAxx…',        group: 'Scraping'   },
] as const;

export default function Settings() {
  const { showToast } = useToast();
  const [saving, setSaving]   = useState(false);
  const [show,   setShow]     = useState<Record<string, boolean>>({});
  const [keys,   setKeys]     = useState<Record<string, string>>({
    gemini: '', anthropic: '', openai: '', hunter_io: '', findymail: '', meta_ads: '',
  });

  useEffect(() => {
    const s = loadSettings();
    setKeys(s.apiKeys);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const current = loadSettings();
      saveSettings({ ...current, apiKeys: keys as any });
      showToast('Gespeichert', 'success');
    } catch {
      showToast('Fehler', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filledKeys = KEY_FIELDS.filter(f => keys[f.key]?.length > 0).length;

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px 80px' }}>

        {/* Title */}
        <div style={{ marginBottom: 48 }}>
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <span className="idx">CONFIG</span>
            <h1 style={{ fontSize: 'clamp(24px, 3vw, 38px)' }}><em style={{ color: '#f5cc77' }}>API Keys</em></h1>
            <div className="rule" />
          </div>
          <p style={{ fontFamily: "'Spline Sans', sans-serif", fontSize: 14, color: '#5f6e87', marginTop: 16 }}>
            Nur lokal im Browser gespeichert. Nie an externe Server übertragen.
            Die KI-Auswahl erfolgt pro Run.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32, alignItems: 'start' }}>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Key status dots */}
            <div style={{ background: '#0f1828', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: '#5f6e87', marginBottom: 4 }}>
                {filledKeys} / {KEY_FIELDS.length} konfiguriert
              </p>
              {KEY_FIELDS.map(f => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: keys[f.key] ? '#4fd1c5' : 'rgba(95,110,135,.35)', flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: keys[f.key] ? '#9aa7bd' : '#5f6e87', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                </div>
              ))}
            </div>

            <button className="btn-primary" onClick={save} disabled={saving} style={{ maxWidth: '100%' }}>
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
          </div>

          {/* Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
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
                            display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                            borderRadius: 12,
                            border: filled ? '1px solid rgba(79,209,197,.2)' : '1px solid rgba(255,255,255,.07)',
                            background: filled ? 'rgba(79,209,197,.04)' : 'rgba(255,255,255,.02)',
                            transition: 'all .15s',
                          }}
                        >
                          <div style={{ width: 130, flexShrink: 0 }}>
                            <p style={{ fontFamily: "'Spline Sans', sans-serif", fontSize: 13, fontWeight: 500, color: '#f4efe4' }}>{label}</p>
                          </div>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <input
                              type={show[key] ? 'text' : 'password'}
                              value={val}
                              onChange={e => setKeys(p => ({ ...p, [key]: e.target.value }))}
                              placeholder={hint}
                              style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, fontSize: 13, fontFamily: "'Spline Sans Mono', monospace", color: '#f4efe4', outline: 'none', boxShadow: 'none' }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            {filled && <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#4fd1c5' }}>✓</span>}
                            <button onClick={() => setShow(p => ({ ...p, [key]: !p[key] }))} style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#5f6e87', width: 16 }}>
                              {show[key] ? '●' : '○'}
                            </button>
                            {filled && (
                              <button onClick={() => setKeys(p => ({ ...p, [key]: '' }))} style={{ fontSize: 16, color: '#5f6e87', lineHeight: 1 }}>×</button>
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
        </div>
      </div>
    </div>
  );
}
