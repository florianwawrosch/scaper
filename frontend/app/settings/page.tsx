'use client';

import { useState, useEffect, useRef } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings';

const SERVICES = [
  {
    key: 'gemini',
    label: 'Google Gemini',
    group: 'KI-Analyse',
    desc: 'Analysiert und filtert deine Leads mit KI. Hol dir deinen Key unter aistudio.google.com.',
    hint: 'AIzaSy…',
  },
  {
    key: 'anthropic',
    label: 'Anthropic Claude',
    group: 'KI-Analyse',
    desc: 'Alternatives KI-Modell für die Lead-Bewertung. Key unter console.anthropic.com.',
    hint: 'sk-ant-api03-…',
  },
  {
    key: 'openai',
    label: 'OpenAI',
    group: 'KI-Analyse',
    desc: 'GPT-Modelle für die Analyse. Key unter platform.openai.com/api-keys.',
    hint: 'sk-proj-…',
  },
  {
    key: 'hunter_io',
    label: 'Hunter.io',
    group: 'Data Enrichment',
    desc: 'Findet E-Mail-Adressen zu Unternehmen und Personen. Key unter hunter.io/api-keys.',
    hint: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  },
  {
    key: 'findymail',
    label: 'FindyMail',
    group: 'Data Enrichment',
    desc: 'E-Mail-Verifikation und -Suche. Bearer Token unter app.findymail.com/settings.',
    hint: 'Bearer eyJ…',
  },
  {
    key: 'meta_ads',
    label: 'Meta Ads Library',
    group: 'Scraping',
    desc: 'Zugriff auf die Meta Ad Library API. User-Access-Token mit ads_read-Permission. Erstellen unter developers.facebook.com/tools/explorer.',
    hint: 'EAAxx…',
  },
] as const;

type ServiceKey = typeof SERVICES[number]['key'];

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

export default function Settings() {
  const [keys,     setKeys]     = useState<Record<string, string>>({});
  const [theme,    setTheme]    = useState<'noir' | 'classic'>('noir');
  const [selected, setSelected] = useState<ServiceKey | ''>('');
  const [input,    setInput]    = useState('');
  const [show,     setShow]     = useState<Record<string, boolean>>({});
  const [saved,    setSaved]    = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const s = loadSettings();
    setKeys(s.apiKeys as Record<string, string>);
    setTheme(s.theme ?? 'noir');
  }, []);

  const persist = (nextKeys: Record<string, string>, nextTheme: 'noir' | 'classic') => {
    const current = loadSettings();
    saveSettings({ ...current, apiKeys: nextKeys as any, theme: nextTheme });
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  };

  const connect = () => {
    if (!selected || !input.trim()) return;
    const next = { ...keys, [selected]: input.trim() };
    setKeys(next);
    persist(next, theme);
    setInput('');
    setSelected('');
  };

  const remove = (k: string) => {
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

  const configured = SERVICES.filter(s => keys[s.key]);
  const available  = SERVICES.filter(s => !keys[s.key]);
  const selectedSvc = SERVICES.find(s => s.key === selected);

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
    mono:   'var(--ff-mono)',
    body:   'var(--ff-body)',
    disp:   'var(--ff-disp)',
  };

  return (
    <div style={{ minHeight: '100vh', padding: '40px 32px 80px', maxWidth: 680, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: T.inkF, marginBottom: 8 }}>Einstellungen</p>
        <h1 style={{ fontFamily: T.disp, fontSize: 28, fontWeight: 700, color: T.ink, marginBottom: 6 }}>
          API Keys & <em style={{ color: T.gold }}>Integrationen</em>
        </h1>
        <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, lineHeight: 1.6 }}>
          Verbinde externe Dienste für KI-Analyse und Data Enrichment. Alle Keys werden ausschließlich lokal in deinem Browser gespeichert.
        </p>
      </div>

      {/* Design toggle */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: T.inkF, marginBottom: 10 }}>Design</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['noir', 'classic'] as const).map(t => (
            <button key={t} onClick={() => applyTheme(t)} style={{
              fontFamily: T.mono, fontSize: 11, padding: '4px 14px', borderRadius: 4,
              border: `1px solid ${theme === t ? T.gold : T.lineS}`,
              background: theme === t ? T.goldD : 'transparent',
              color: theme === t ? T.gold : T.inkF,
              cursor: 'pointer', textTransform: 'capitalize', transition: 'all .12s',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Add integration */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: T.inkF, marginBottom: 10 }}>Dienst verbinden</p>
        <div style={{ background: T.panel2, border: `1px solid ${T.lineS}`, borderRadius: 8, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Service picker */}
          <div>
            <p style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF, marginBottom: 6 }}>Dienst auswählen</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SERVICES.map(s => {
                const active = selected === s.key;
                const done   = !!keys[s.key];
                return (
                  <button
                    key={s.key}
                    onClick={() => { if (!done) setSelected(active ? '' : s.key); }}
                    disabled={done}
                    style={{
                      fontFamily: T.mono, fontSize: 11, padding: '4px 12px', borderRadius: 4,
                      border: `1px solid ${active ? T.gold : done ? 'rgba(79,209,197,.25)' : T.lineS}`,
                      background: active ? T.goldD : done ? 'rgba(79,209,197,.06)' : 'transparent',
                      color: active ? T.gold : done ? '#4fd1c5' : T.inkD,
                      cursor: done ? 'default' : 'pointer', transition: 'all .12s',
                      opacity: done ? .7 : 1,
                    }}
                  >
                    {done ? `✓ ${s.label}` : s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description + input when selected */}
          {selectedSvc && (
            <>
              <div style={{ borderLeft: `2px solid ${T.gold}`, paddingLeft: 12 }}>
                <p style={{ fontFamily: T.mono, fontSize: 10, color: T.gold, marginBottom: 3 }}>{selectedSvc.group}</p>
                <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkD, lineHeight: 1.6 }}>{selectedSvc.desc}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  type="password"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && connect()}
                  placeholder={selectedSvc.hint}
                  style={{
                    flex: 1, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 6,
                    padding: '8px 12px', fontFamily: T.mono, fontSize: 12,
                    color: T.ink, outline: 'none',
                  }}
                />
                <button
                  onClick={connect}
                  disabled={!input.trim()}
                  style={{
                    fontFamily: T.mono, fontSize: 12, padding: '8px 18px', borderRadius: 6,
                    background: input.trim() ? T.gold : T.panel, border: `1px solid ${T.line}`,
                    color: input.trim() ? '#07070a' : T.inkF,
                    cursor: input.trim() ? 'pointer' : 'default', fontWeight: 600, transition: 'all .12s',
                  }}
                >
                  Verbinden {saved && '✓'}
                </button>
              </div>
            </>
          )}

          {!selectedSvc && available.length === 0 && (
            <p style={{ fontFamily: T.mono, fontSize: 11, color: '#4fd1c5' }}>✓ Alle Dienste verbunden</p>
          )}
          {!selectedSvc && available.length > 0 && (
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF }}>Wähle einen Dienst oben aus, um ihn zu verbinden.</p>
          )}
        </div>
      </div>

      {/* Connected list */}
      {configured.length > 0 && (
        <div>
          <p style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: T.inkF, marginBottom: 10 }}>
            Verbunden ({configured.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {configured.map(s => (
              <div key={s.key} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: T.panel2,
                borderRadius: 6, border: `1px solid rgba(79,209,197,.15)`,
              }}>
                <div>
                  <p style={{ fontFamily: T.mono, fontSize: 12, color: T.ink }}>{s.label}</p>
                  <p style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF, marginTop: 1 }}>{s.group}</p>
                </div>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF, letterSpacing: '.08em' }}>
                  {show[s.key] ? keys[s.key] : maskKey(keys[s.key])}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShow(p => ({ ...p, [s.key]: !p[s.key] }))}
                    style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF, background: 'none', border: 'none', cursor: 'pointer' }}>
                    {show[s.key] ? '●' : '○'}
                  </button>
                  <button onClick={() => remove(s.key)}
                    style={{ fontFamily: T.mono, fontSize: 13, color: T.inkF, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
