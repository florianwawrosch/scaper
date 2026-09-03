'use client';

import { useState, useEffect } from 'react';
import { loadSettings, saveSettings, type AppSettings } from '@/lib/settings';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { loadBlocklist, addToBlocklist, removeFromBlocklist, type BlockEntry } from '@/lib/blocklist';
import { getEffectivePresets, savePromptOverride, resetPresetOverrides, hasOverride, type ImportPreset } from '@/lib/aiTemplates';

interface Service { key: string; label: string; hint: string; desc: string }
interface Group   { key: string; label: string; desc: string; services: Service[] }

const GROUPS: Group[] = [
  {
    key: 'ai',
    label: 'KI-Modelle',
    desc: 'Für KI-Analyse und Lead-Bewertung',
    services: [
      { key: 'gemini',    label: 'Google Gemini',   hint: 'AIzaSy…',        desc: 'Key unter aistudio.google.com' },
      { key: 'anthropic', label: 'Anthropic Claude', hint: 'sk-ant-api03-…', desc: 'Key unter console.anthropic.com' },
      { key: 'openai',    label: 'OpenAI',           hint: 'sk-proj-…',      desc: 'Key unter platform.openai.com/api-keys' },
    ],
  },
  {
    key: 'enrichment',
    label: 'Data Enrichment',
    desc: 'E-Mail-Adressen und Kontaktdaten anreichern',
    services: [
      { key: 'hunter_io', label: 'Hunter.io',  hint: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', desc: 'Key unter hunter.io/api-keys' },
      { key: 'findymail', label: 'FindyMail',  hint: 'Bearer eyJ…',                     desc: 'Bearer Token unter app.findymail.com/settings' },
    ],
  },
  {
    key: 'scraping',
    label: 'Scraping',
    desc: 'Zugangsdaten für externe Datenquellen',
    services: [
      { key: 'meta_ads', label: 'Meta Ads Library', hint: 'EAAxx…', desc: 'User-Access-Token mit ads_read. Erstellen unter developers.facebook.com/tools/explorer' },
    ],
  },
];

const NAV_KEYS = ['integrations', 'templates', 'blocklist', 'design'] as const;
type NavKey = typeof NAV_KEYS[number];

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
  const [localKeys,  setLocalKeys]  = useState<Record<string, string>>({});
  const [theme,      setTheme]      = useState<'noir' | 'classic'>('noir');
  const [nav,        setNav]        = useState<NavKey>('integrations');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [input,      setInput]      = useState('');
  const [show,       setShow]       = useState<Record<string, boolean>>({});
  const [backendUrl, setBackendUrl] = useState('');
  const [serverKeys, setServerKeys] = useState<Record<string, boolean>>({});
  const [blocklist,  setBlocklist]  = useState<BlockEntry[]>([]);
  const [blockInput, setBlockInput] = useState('');
  // KI-Vorlagen: effektive Presets + lokale Editier-Zustände (Key: presetId:columnName)
  const [tplPresets,    setTplPresets]    = useState<ImportPreset[]>([]);
  const [tplPrompts,    setTplPrompts]    = useState<Record<string, string>>({});
  const [tplVersions,   setTplVersions]   = useState<Record<string, string>>({});
  const [tplSaved,      setTplSaved]      = useState<string | null>(null);
  const [tplOverridden, setTplOverridden] = useState<Set<string>>(new Set());

  const reloadTemplates = () => {
    const eff = getEffectivePresets();
    setTplPresets(eff);
    const prompts: Record<string, string> = {};
    const versions: Record<string, string> = {};
    for (const p of eff) for (const c of p.columns) {
      prompts[`${p.id}:${c.name}`] = c.prompt;
      versions[`${p.id}:${c.name}`] = c.promptVersion ?? '';
    }
    setTplPrompts(prompts);
    setTplVersions(versions);
    // Einmal beim (Neu-)Laden ermitteln statt hasOverride() pro Preset pro Render
    setTplOverridden(new Set(eff.filter(p => hasOverride(p.id)).map(p => p.id)));
  };

  useEffect(() => {
    const s = loadSettings();
    // localStorage gibt es erst im Browser: ein lazy useState würde beim
    // SSR-Prerender leer rendern und beim Hydrate springen — daher Effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKeys(s.apiKeys as Record<string, string>);
    setTheme(s.theme ?? 'noir');
    // Track what's actually in localStorage (vs. env var fallbacks)
    try {
      const raw = localStorage.getItem('appSettings');
      if (raw) setLocalKeys((JSON.parse(raw) as { apiKeys?: Record<string, string> }).apiKeys ?? {});
    } catch {}
    try { setBackendUrl(localStorage.getItem('backendUrl') ?? ''); } catch {}
    // Which keys exist server-side (Vercel/Railway env vars) — booleans only
    fetchKeyAvailability().then(setServerKeys);
    setBlocklist(loadBlocklist());
    reloadTemplates();
    // Deep link: /settings?tab=blocklist
    try {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab && (NAV_KEYS as readonly string[]).includes(tab)) setNav(tab as NavKey);
    } catch {}
  }, []);

  const saveBackendUrl = () => {
    try {
      const v = backendUrl.trim().replace(/\/+$/, '');
      if (v) localStorage.setItem('backendUrl', v);
      else localStorage.removeItem('backendUrl');
      setBackendUrl(v);
    } catch {}
  };

  const persist = (nextKeys: Record<string, string>, nextTheme: 'noir' | 'classic') => {
    const current = loadSettings();
    saveSettings({ ...current, apiKeys: nextKeys as AppSettings['apiKeys'], theme: nextTheme });
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
    if (t === 'classic') document.documentElement.setAttribute('data-theme', 'classic');
    else document.documentElement.removeAttribute('data-theme');
    persist(keys, t);
  };

  const exportKeys = () => {
    const data = JSON.stringify(keys, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lp-api-keys.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const importKeys = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        const next = { ...keys, ...parsed };
        setKeys(next);
        persist(next, theme);
      } catch { /* invalid file — silently ignore */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isActive = (svc: Service) => !!keys[svc.key] || !!serverKeys[svc.key];
  const activeCount = GROUPS.flatMap(g => g.services).filter(isActive).length;
  const groupName = (svcKey: string) => GROUPS.find(g => g.services.some(s => s.key === svcKey))?.label ?? '';

  const NAV: { key: NavKey; label: string; badge?: number }[] = [
    { key: 'integrations', label: 'Integrationen', badge: activeCount || undefined },
    { key: 'templates',    label: 'KI-Vorlagen', badge: tplPresets.length || undefined },
    { key: 'blocklist',    label: 'Blockliste', badge: blocklist.length || undefined },
    { key: 'design',       label: 'Design' },
  ];

  // One service row — used both in the "Aktiv" section and the catalog below.
  const renderServiceCard = (svc: Service, opts?: { showGroup?: boolean }) => {
    const connected    = !!keys[svc.key];
    const isConnecting = connecting === svc.key;
    const fromEnv      = connected && !localKeys[svc.key];
    const onServer     = !connected && !!serverKeys[svc.key];
    const active       = connected || onServer;

    return (
      <div key={svc.key} style={{
        background: active ? ((fromEnv || onServer) ? 'rgba(99,129,255,.05)' : 'rgba(79,209,197,.05)') : T.panel2,
        border: `1px solid ${active ? ((fromEnv || onServer) ? 'rgba(99,129,255,.25)' : 'rgba(79,209,197,.22)') : 'rgba(255,255,255,.06)'}`,
        borderRadius: 7, overflow: 'hidden',
        transition: 'background .2s, border-color .2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: connected ? (fromEnv ? '#6381ff' : T.teal) : onServer ? '#6381ff' : 'rgba(255,255,255,.15)', transition: 'background .2s' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 500, color: active ? T.ink : T.inkD }}>{svc.label}</p>
              {opts?.showGroup && (
                <span style={{ fontFamily: T.mono, fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase', color: T.inkF, background: T.panel, border: `1px solid ${T.lineS}`, borderRadius: 3, padding: '1px 5px' }}>
                  {groupName(svc.key)}
                </span>
              )}
            </div>
            <p style={{ fontFamily: T.body, fontSize: 11, color: T.inkF, marginTop: 1 }}>{svc.desc}</p>
          </div>

          {connected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {fromEnv ? (
                <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.1em', color: '#6381ff', background: 'rgba(99,129,255,.1)', border: '1px solid rgba(99,129,255,.2)', borderRadius: 4, padding: '2px 7px' }}>
                  via Vercel Env
                </span>
              ) : (
                <>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.teal, letterSpacing: '.04em' }}>
                    {show[svc.key] ? keys[svc.key] : maskKey(keys[svc.key])}
                  </span>
                  <button type="button" onClick={() => setShow(p => ({ ...p, [svc.key]: !p[svc.key] }))}
                    style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF, background: 'none', border: 'none', cursor: 'pointer', opacity: .6, lineHeight: 1 }}>
                    {show[svc.key] ? '◉' : '○'}
                  </button>
                  <button type="button" onClick={() => disconnect(svc.key)} title="Key entfernen"
                    style={{ fontSize: 14, color: T.inkF, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, opacity: .5 }}>
                    ×
                  </button>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {onServer && !isConnecting && (
                <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.1em', color: '#6381ff', background: 'rgba(99,129,255,.1)', border: '1px solid rgba(99,129,255,.2)', borderRadius: 4, padding: '2px 7px' }}>
                  ✓ Server-Key aktiv
                </span>
              )}
              {isConnecting && (
                <button type="button" onClick={() => { setConnecting(null); setInput(''); }}
                  style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF, background: 'none', border: 'none', cursor: 'pointer', opacity: .6 }}>
                  Abbrechen
                </button>
              )}
              {!isConnecting && (
                <button type="button" onClick={() => { setConnecting(svc.key); setInput(''); }}
                  style={{
                    fontFamily: T.mono, fontSize: 10, padding: '3px 9px', borderRadius: 4,
                    background: onServer ? 'transparent' : 'rgba(232,176,75,.08)',
                    border: `1px solid ${onServer ? 'rgba(255,255,255,.1)' : 'rgba(232,176,75,.3)'}`,
                    color: onServer ? T.inkD : T.gold, cursor: 'pointer',
                  }}>
                  {onServer ? '+ eigener Key' : '+ Key'}
                </button>
              )}
            </div>
          )}
        </div>

        {isConnecting && (
          <div style={{ display: 'flex', gap: 6, padding: '0 14px 10px', alignItems: 'center' }}>
            <input autoFocus type="text" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && connect(svc.key)}
              placeholder={svc.hint}
              style={{
                flex: 1, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 5,
                padding: '5px 9px', fontFamily: T.mono, fontSize: 11, color: T.ink, outline: 'none',
              }}
            />
            <button type="button" onClick={() => connect(svc.key)} disabled={!input.trim()}
              style={{
                fontFamily: T.mono, fontSize: 10, padding: '5px 12px', borderRadius: 5,
                background: input.trim() ? 'rgba(232,176,75,.12)' : 'transparent',
                border: `1px solid ${input.trim() ? T.gold : 'rgba(255,255,255,.1)'}`,
                color: input.trim() ? T.gold : T.inkF,
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all .12s', flexShrink: 0,
              }}>
              Speichern
            </button>
          </div>
        )}
      </div>
    );
  };

  const activeServices = GROUPS.flatMap(g => g.services).filter(isActive);

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${T.lineS}`, padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: T.inkF, padding: '0 20px', marginBottom: 10 }}>
          Einstellungen
        </p>
        {NAV.map(n => {
          const active = nav === n.key;
          return (
            <button key={n.key} type="button" onClick={() => setNav(n.key)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 20px', background: active ? T.goldD : 'transparent',
              border: 'none', borderLeft: `2px solid ${active ? T.gold : 'transparent'}`,
              cursor: 'pointer', textAlign: 'left', transition: 'all .12s',
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: active ? T.gold : T.inkD, flex: 1 }}>{n.label}</span>
              {n.badge && (
                <span style={{ fontFamily: T.mono, fontSize: 9, background: T.tealD, color: T.teal, border: `1px solid ${T.tealB}`, borderRadius: 10, padding: '1px 6px' }}>
                  {n.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, padding: '32px 40px', maxWidth: 680 }}>

        {/* ── Integrationen ── */}
        {nav === 'integrations' && (
          <>
            <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
                  API <em style={{ color: T.gold }}>Integrationen</em>
                </h1>
                <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, marginTop: 4, lineHeight: 1.6 }}>
                  Keys aus deinem Browser oder aus den Vercel-Umgebungsvariablen (blaues Badge = auf dem Server hinterlegt).
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 4 }}>
                <button type="button" onClick={exportKeys}
                  style={{ fontFamily: T.mono, fontSize: 10, padding: '4px 10px', borderRadius: 5, background: 'transparent', border: `1px solid rgba(255,255,255,.1)`, color: T.inkD, cursor: 'pointer' }}>
                  ↓ Export
                </button>
                <label style={{ fontFamily: T.mono, fontSize: 10, padding: '4px 10px', borderRadius: 5, background: 'transparent', border: `1px solid rgba(255,255,255,.1)`, color: T.inkD, cursor: 'pointer' }}>
                  ↑ Import
                  <input type="file" accept=".json" onChange={importKeys} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

              {/* ── Aktiv: connected integrations, pulled to the top ── */}
              {activeServices.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.teal, flexShrink: 0 }} />
                    <p style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: T.teal }}>
                      Aktiv
                    </p>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF }}>{activeServices.length} verbunden</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {activeServices.map(svc => renderServiceCard(svc, { showGroup: true }))}
                  </div>
                </div>
              )}

              {/* ── Katalog: available integrations grouped, active ones removed ── */}
              {(() => {
                const catalogGroups = GROUPS
                  .map(g => ({ ...g, services: g.services.filter(s => !isActive(s)) }))
                  .filter(g => g.services.length > 0);
                if (catalogGroups.length === 0) return null;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
                    {activeServices.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 1, background: T.lineS }} />
                        <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF }}>Verfügbar</span>
                        <div style={{ flex: 1, height: 1, background: T.lineS }} />
                      </div>
                    )}
                    {catalogGroups.map(group => (
                      <div key={group.key}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <p style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: T.inkD }}>
                            {group.label}
                          </p>
                          <p style={{ fontFamily: T.body, fontSize: 12, color: T.inkF, opacity: .6 }}>{group.desc}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {group.services.map(svc => renderServiceCard(svc))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── Backend URL ── */}
              <div>
                <div style={{ height: 1, background: T.lineS, marginBottom: 24 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <p style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: T.inkF }}>
                    Backend
                  </p>
                  <p style={{ fontFamily: T.body, fontSize: 12, color: T.inkF, opacity: .6 }}>API-Server für Scraping, Analyse und Enrichment</p>
                </div>
                <div style={{ background: T.panel2, border: '1px solid rgba(255,255,255,.06)', borderRadius: 7, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      value={backendUrl}
                      onChange={e => setBackendUrl(e.target.value)}
                      placeholder={process.env.NEXT_PUBLIC_API_URL || 'https://mein-backend.onrender.com'}
                      style={{ fontFamily: T.mono, flex: 1, fontSize: 12, padding: '7px 10px', background: 'rgba(255,255,255,.03)', border: `1px solid ${T.line}`, borderRadius: 5, color: T.ink, outline: 'none' }}
                    />
                    <button type="button" onClick={saveBackendUrl}
                      style={{ fontFamily: T.mono, fontSize: 11, padding: '7px 14px', borderRadius: 5, background: T.gold, border: 'none', color: '#07070a', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                      Speichern
                    </button>
                  </div>
                  <p style={{ fontFamily: T.body, fontSize: 11, color: T.inkF, lineHeight: 1.5 }}>
                    Leer lassen für den Standard{process.env.NEXT_PUBLIC_API_URL ? ` (${process.env.NEXT_PUBLIC_API_URL})` : ''}. Änderung wirkt nach dem Neuladen der Seite.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── KI-Vorlagen ── */}
        {nav === 'templates' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
                KI-<em style={{ color: T.gold }}>Vorlagen</em>
              </h1>
              <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, marginTop: 4, lineHeight: 1.6 }}>
                Standard-KI-Spalten, die beim CSV-Import angeboten werden. Prompt-Änderungen gelten
                für alle zukünftigen Importe (bestehende Datensätze behalten ihre Konfiguration).
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {tplPresets.map(preset => {
                const overridden = tplOverridden.has(preset.id);
                return (
                  <div key={preset.id} style={{ background: T.panel2, border: `1px solid ${overridden ? 'rgba(232,176,75,.3)' : 'rgba(255,255,255,.06)'}`, borderRadius: 8, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <p style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.ink, flex: 1 }}>{preset.name}</p>
                      {overridden && (
                        <>
                          <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.08em', color: T.gold, background: T.goldD, border: '1px solid rgba(232,176,75,.3)', borderRadius: 4, padding: '2px 7px' }}>
                            angepasst
                          </span>
                          <button type="button"
                            onClick={() => { resetPresetOverrides(preset.id); reloadTemplates(); }}
                            title="Prompt auf den eingebauten Standard zurücksetzen"
                            style={{ fontFamily: T.mono, fontSize: 10, padding: '3px 9px', borderRadius: 4, background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: T.inkD, cursor: 'pointer' }}>
                            ↺ Standard
                          </button>
                        </>
                      )}
                    </div>
                    {preset.description && (
                      <p style={{ fontFamily: T.body, fontSize: 11, color: T.inkF, marginBottom: 12 }}>{preset.description}</p>
                    )}

                    {preset.columns.map(col => {
                      const k = `${preset.id}:${col.name}`;
                      const dirty = tplPrompts[k] !== col.prompt || (tplVersions[k] ?? '') !== (col.promptVersion ?? '');
                      return (
                        <div key={col.name} style={{ marginTop: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.teal }}>{col.name}</span>
                            {col.outputFields && (
                              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF }}>→ {col.outputFields.join(', ')}</span>
                            )}
                            <div style={{ flex: 1 }} />
                            <label style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, letterSpacing: '.08em', textTransform: 'uppercase' }}>Version</label>
                            <input
                              value={tplVersions[k] ?? ''}
                              onChange={e => setTplVersions(p => ({ ...p, [k]: e.target.value }))}
                              placeholder="z.B. v2"
                              style={{ width: 52, fontFamily: T.mono, fontSize: 10, padding: '3px 7px', borderRadius: 4, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none' }}
                            />
                          </div>
                          {col.inputColumns && (
                            <p style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, opacity: .7, marginBottom: 6 }}>
                              Eingabespalten: {col.inputColumns.join(', ')}
                            </p>
                          )}
                          <textarea
                            value={tplPrompts[k] ?? ''}
                            onChange={e => setTplPrompts(p => ({ ...p, [k]: e.target.value }))}
                            rows={10}
                            spellCheck={false}
                            style={{
                              width: '100%', boxSizing: 'border-box', resize: 'vertical',
                              fontFamily: T.mono, fontSize: 10.5, lineHeight: 1.55,
                              padding: '10px 12px', borderRadius: 6,
                              border: `1px solid ${dirty ? 'rgba(232,176,75,.4)' : T.line}`,
                              background: T.panel, color: T.ink, outline: 'none',
                            }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                            <div style={{ flex: 1 }}>
                              {tplSaved === k && (
                                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.teal }}>✓ Gespeichert — gilt für neue Importe</span>
                              )}
                            </div>
                            <button type="button"
                              disabled={!dirty}
                              onClick={() => {
                                savePromptOverride(preset.id, col.name, {
                                  prompt: tplPrompts[k] ?? '',
                                  promptVersion: (tplVersions[k] ?? '').trim() || undefined,
                                });
                                reloadTemplates();
                                setTplSaved(k);
                                setTimeout(() => setTplSaved(s => (s === k ? null : s)), 3000);
                              }}
                              style={{
                                fontFamily: T.mono, fontSize: 11, padding: '5px 14px', borderRadius: 5,
                                border: `1px solid ${dirty ? T.gold : 'rgba(255,255,255,.1)'}`,
                                background: dirty ? 'rgba(232,176,75,.12)' : 'transparent',
                                color: dirty ? T.gold : T.inkF,
                                cursor: dirty ? 'pointer' : 'default',
                              }}>
                              Speichern
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Blockliste ── */}
        {nav === 'blocklist' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
                Block<em style={{ color: T.gold }}>liste</em>
              </h1>
              <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkD, marginTop: 4, lineHeight: 1.6 }}>
                Seiten, die grundsätzlich aus Scrape-Ergebnissen ausgeschlossen werden.
                Hinzufügen auch direkt aus der Ergebnistabelle: Zeilen abwählen und oben
                «Seiten blocken» klicken.
              </p>
            </div>

            {/* Add entry */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <input
                type="text" value={blockInput}
                onChange={e => setBlockInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && blockInput.trim()) {
                    setBlocklist(addToBlocklist(blockInput));
                    setBlockInput('');
                  }
                }}
                placeholder="Seitenname, z.B. «Fitness Coach Max»"
                style={{ flex: 1, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 6, padding: '9px 12px', fontFamily: T.mono, fontSize: 12, color: T.ink, outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => { if (blockInput.trim()) { setBlocklist(addToBlocklist(blockInput)); setBlockInput(''); } }}
                disabled={!blockInput.trim()}
                style={{
                  fontFamily: T.mono, fontSize: 12, fontWeight: 600, padding: '9px 18px', borderRadius: 6, cursor: blockInput.trim() ? 'pointer' : 'default',
                  border: 'none',
                  background: blockInput.trim() ? T.gold : T.panel2,
                  color: blockInput.trim() ? '#07070a' : T.inkF,
                }}
              >+ Blocken</button>
            </div>

            {/* List */}
            {blocklist.length === 0 ? (
              <div style={{ padding: '36px 24px', textAlign: 'center', border: `1px dashed ${T.line}`, borderRadius: 10, background: T.panel }}>
                <p style={{ fontFamily: T.mono, fontSize: 12, color: T.inkD }}>Noch keine Seiten geblockt.</p>
                <p style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF, marginTop: 6 }}>Oben einen Seitennamen eintragen oder aus der Ergebnistabelle blocken.</p>
              </div>
            ) : (
              <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', background: T.panel, borderBottom: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: T.inkF }}>Geblockte Seiten</span>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.gold }}>{blocklist.length}</span>
                </div>
                {blocklist.map((e, i) => (
                  <div key={e.pageName} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: i % 2 ? 'transparent' : 'rgba(255,255,255,.015)', borderBottom: i < blocklist.length - 1 ? `1px solid ${T.lineS}` : 'none' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e8736b', flexShrink: 0 }} />
                    <span style={{ fontFamily: T.mono, fontSize: 12, color: T.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.pageName}
                    </span>
                    {e.pageId && (
                      <span style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF }}>ID {e.pageId}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setBlocklist(removeFromBlocklist(e.pageName))}
                      title="Von Blockliste entfernen"
                      style={{ fontFamily: T.mono, fontSize: 15, color: T.inkD, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                      onMouseEnter={ev => ((ev.currentTarget as HTMLElement).style.color = '#e8736b')}
                      onMouseLeave={ev => ((ev.currentTarget as HTMLElement).style.color = T.inkD)}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Design ── */}
        {nav === 'design' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
                App <em style={{ color: T.gold }}>Design</em>
              </h1>
              <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, marginTop: 4 }}>
                Farbschema der App. Wird lokal gespeichert.
              </p>
            </div>
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
          </>
        )}

      </div>
    </div>
  );
}
