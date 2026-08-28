'use client';

import { useState, useEffect } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings';

const SECTIONS = [
  {
    key: 'ai',
    label: 'KI & Analyse',
    icon: '◈',
    services: [
      { key: 'gemini',    label: 'Google Gemini',    hint: 'AIzaSy…',        desc: 'Analysiert und filtert Leads mit KI. Key unter aistudio.google.com.' },
      { key: 'anthropic', label: 'Anthropic Claude',  hint: 'sk-ant-api03-…', desc: 'Alternatives KI-Modell. Key unter console.anthropic.com.' },
      { key: 'openai',    label: 'OpenAI',            hint: 'sk-proj-…',      desc: 'GPT-Modelle für Analyse. Key unter platform.openai.com/api-keys.' },
    ],
  },
  {
    key: 'enrichment',
    label: 'Data Enrichment',
    icon: '⊕',
    services: [
      { key: 'hunter_io',  label: 'Hunter.io',  hint: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', desc: 'E-Mail-Adressen zu Unternehmen finden. Key unter hunter.io/api-keys.' },
      { key: 'findymail',  label: 'FindyMail',  hint: 'Bearer eyJ…',                     desc: 'E-Mail-Verifikation. Bearer Token unter app.findymail.com/settings.' },
    ],
  },
  {
    key: 'scraping',
    label: 'Scraping',
    icon: '⊗',
    services: [
      { key: 'meta_ads', label: 'Meta Ads Library', hint: 'EAAxx…', desc: 'User-Access-Token mit ads_read-Permission. Erstellen unter developers.facebook.com/tools/explorer.' },
    ],
  },
  {
    key: 'design',
    label: 'Design',
    icon: '◐',
    services: [],
  },
] as const;

type SectionKey = typeof SECTIONS[number]['key'];
type ServiceEntry = { key: string; label: string; hint: string; desc: string };

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

const T = {
  bg:     'var(--th-bg)',
  panel:  'var(--th-panel)',
  panel2: 'var(--th-panel2)',
  line:   'var(--th-line)',
  lineS:  'var(--th-line-soft)',
  gold:   'var(--th-gold)',
  goldD:  'var(--th-gold-d)',
  ink:    'var(--th-ink)',
  inkD:   'var(--th-ink-d)',
  inkF:   'var(--th-ink-f)',
  teal:   'rgba(79,209,197,1)',
  tealD:  'rgba(79,209,197,.08)',
  tealB:  'rgba(79,209,197,.2)',
  mono:   'var(--ff-mono)',
  body:   'var(--ff-body)',
  disp:   'var(--ff-disp)',
};

export default function Settings() {
  const [keys,       setKeys]       = useState<Record<string, string>>({});
  const [theme,      setTheme]      = useState<'noir' | 'classic'>('noir');
  const [section,    setSection]    = useState<SectionKey>('ai');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [input,      setInput]      = useState('');
  const [show,       setShow]       = useState<Record<string, boolean>>({});

  useEffect(() => {
    const s = loadSettings();
    setKeys(s.apiKeys as Record<string, string>);
    setTheme(s.theme ?? 'noir');
  }, []);

  const persist = (nextKeys: Record<string, string>, nextTheme: 'noir' | 'classic') => {
    const current = loadSettings();
    saveSettings({ ...current, apiKeys: nextKeys as any, theme: nextTheme });
  };

  const connect = (serviceKey: string) => {
    if (!input.trim()) return;
    const next = { ...keys, [serviceKey]: input.trim() };
    setKeys(next);
    persist(next, theme);
    setInput('');
    setConnecting(null);
  };

  const disconnect = (k: string) => {
    const next = { ...keys, [k]: '' };
    setKeys(next);
    persist(next, theme);
  };

  const applyTheme = (t: 'noir' | 'classic') => {
    setTheme(t);
    if (t === 'classic') document.documentElement.dataset.theme = 'classic';
    else delete document.documentElement.dataset.theme;
    persist(keys, t);
  };

  const currentSection = SECTIONS.find(s => s.key === section)!;

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: 200, flexShrink: 0, borderRight: `1px solid ${T.lineS}`,
        padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <p style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: T.inkF, padding: '0 20px', marginBottom: 10 }}>
          Einstellungen
        </p>
        {SECTIONS.map(s => {
          const connectedCount = s.services.filter(sv => keys[sv.key]).length;
          const active = section === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 20px', background: active ? T.goldD : 'transparent',
                border: 'none', borderLeft: `2px solid ${active ? T.gold : 'transparent'}`,
                cursor: 'pointer', textAlign: 'left', transition: 'all .12s',
              }}
            >
              <span style={{ fontFamily: T.mono, fontSize: 14, color: active ? T.gold : T.inkF, lineHeight: 1 }}>{s.icon}</span>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: active ? T.gold : T.inkD, flex: 1 }}>{s.label}</span>
              {connectedCount > 0 && (
                <span style={{ fontFamily: T.mono, fontSize: 9, background: T.tealD, color: T.teal, border: `1px solid ${T.tealB}`, borderRadius: 10, padding: '1px 6px' }}>
                  {connectedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, padding: '32px 40px', maxWidth: 620 }}>

        <div style={{ marginBottom: 28 }}>
          <p style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: T.inkF, marginBottom: 6 }}>
            {currentSection.icon} {currentSection.label}
          </p>
          <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
            {section === 'ai'         && <><em style={{ color: T.gold }}>KI-Modelle</em> & Analyse</>}
            {section === 'enrichment' && <>Data <em style={{ color: T.gold }}>Enrichment</em></>}
            {section === 'scraping'   && <><em style={{ color: T.gold }}>Scraping</em> Tools</>}
            {section === 'design'     && <>App <em style={{ color: T.gold }}>Design</em></>}
          </h1>
        </div>

        {/* ── Design section ── */}
        {section === 'design' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, lineHeight: 1.6 }}>
              Wähle das Farbschema der App. Die Einstellung wird lokal gespeichert.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['noir', 'classic'] as const).map(t => (
                <button key={t} type="button" onClick={() => applyTheme(t)} style={{
                  fontFamily: T.mono, fontSize: 12, padding: '8px 20px', borderRadius: 6,
                  border: `1px solid ${theme === t ? T.gold : T.lineS}`,
                  background: theme === t ? T.goldD : 'transparent',
                  color: theme === t ? T.gold : T.inkF,
                  cursor: 'pointer', textTransform: 'capitalize', transition: 'all .12s',
                  fontWeight: theme === t ? 600 : 400,
                }}>{t}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Service sections ── */}
        {currentSection.services.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, lineHeight: 1.6, marginBottom: 4 }}>
              API Keys werden ausschließlich lokal in deinem Browser gespeichert.
            </p>
            {currentSection.services.map((svc: ServiceEntry) => {
              const connected = !!keys[svc.key];
              const isConnecting = connecting === svc.key;

              return (
                <div key={svc.key} style={{
                  background: T.panel2, border: `1px solid ${connected ? T.tealB : T.lineS}`,
                  borderRadius: 8, overflow: 'hidden',
                }}>
                  {/* Service header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.ink }}>{svc.label}</p>
                        {connected && (
                          <span style={{ fontFamily: T.mono, fontSize: 9, background: T.tealD, color: T.teal, border: `1px solid ${T.tealB}`, borderRadius: 10, padding: '1px 6px' }}>
                            verbunden
                          </span>
                        )}
                      </div>
                      <p style={{ fontFamily: T.body, fontSize: 12, color: T.inkF, marginTop: 2, lineHeight: 1.5 }}>{svc.desc}</p>
                    </div>
                    {connected ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF, letterSpacing: '.06em' }}>
                          {show[svc.key] ? keys[svc.key] : maskKey(keys[svc.key])}
                        </span>
                        <button type="button" onClick={() => setShow(p => ({ ...p, [svc.key]: !p[svc.key] }))}
                          style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF, background: 'none', border: 'none', cursor: 'pointer' }}>
                          {show[svc.key] ? '●' : '○'}
                        </button>
                        <button type="button" onClick={() => disconnect(svc.key)}
                          style={{ fontFamily: T.mono, fontSize: 13, color: T.inkF, background: 'none', border: 'none', cursor: 'pointer' }}>
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setConnecting(isConnecting ? null : svc.key); setInput(''); }}
                        style={{
                          fontFamily: T.mono, fontSize: 11, padding: '5px 14px', borderRadius: 5,
                          background: isConnecting ? T.goldD : 'transparent',
                          border: `1px solid ${isConnecting ? T.gold : T.lineS}`,
                          color: isConnecting ? T.gold : T.inkD,
                          cursor: 'pointer', transition: 'all .12s', flexShrink: 0,
                        }}
                      >
                        {isConnecting ? 'Abbrechen' : '+ API Key hinzufügen'}
                      </button>
                    )}
                  </div>

                  {/* Inline key input */}
                  {isConnecting && (
                    <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px', alignItems: 'center' }}>
                      <input
                        autoFocus
                        type="password"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && connect(svc.key)}
                        placeholder={svc.hint}
                        style={{
                          flex: 1, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 5,
                          padding: '7px 11px', fontFamily: T.mono, fontSize: 12,
                          color: T.ink, outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => connect(svc.key)}
                        disabled={!input.trim()}
                        style={{
                          fontFamily: T.mono, fontSize: 12, padding: '7px 16px', borderRadius: 5,
                          background: input.trim() ? T.gold : T.panel,
                          border: `1px solid ${T.line}`,
                          color: input.trim() ? '#07070a' : T.inkF,
                          cursor: input.trim() ? 'pointer' : 'default',
                          fontWeight: 600, transition: 'all .12s', flexShrink: 0,
                        }}
                      >
                        Speichern
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
