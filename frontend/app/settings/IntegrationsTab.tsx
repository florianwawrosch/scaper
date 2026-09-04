'use client';

import { useState, useEffect } from 'react';
import { loadSettings, saveSettings, type AppSettings } from '@/lib/settings';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { ConfirmDelete } from '@/app/components/ConfirmDelete';
import { T } from '@/app/theme';

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

/** Alle bekannten Service-Keys (für das Badge beim ersten Laden) */
export const SERVICE_KEYS = GROUPS.flatMap(g => g.services.map(s => s.key));

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

interface Props {
  /** Anzahl aktiver Integrationen (Badge in der Navigation) */
  onCountChange?: (n: number) => void;
}

/** Einstellungen → Integrationen: API-Keys im Browser, Server-Keys (Vercel) als Badge. Keys verlassen den Browser nie (kein Export/Import). */
export function IntegrationsTab({ onCountChange }: Props) {
  const [keys,       setKeys]       = useState<Record<string, string>>({});
  const [localKeys,  setLocalKeys]  = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const [input,      setInput]      = useState('');
  const [show,       setShow]       = useState<Record<string, boolean>>({});
  const [serverKeys, setServerKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // localStorage gibt es erst im Browser: ein lazy useState würde beim
    // SSR-Prerender leer rendern und beim Hydrate springen — daher Effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKeys(loadSettings().apiKeys as Record<string, string>);
    // Track what's actually in localStorage (vs. env var fallbacks)
    try {
      const raw = localStorage.getItem('appSettings');
      if (raw) setLocalKeys((JSON.parse(raw) as { apiKeys?: Record<string, string> }).apiKeys ?? {});
    } catch {}
    // Which keys exist server-side (Vercel env vars) — booleans only
    fetchKeyAvailability().then(setServerKeys);
  }, []);

  const isActive = (svc: Service) => !!keys[svc.key] || !!serverKeys[svc.key];
  const activeServices = GROUPS.flatMap(g => g.services).filter(isActive);
  const groupName = (svcKey: string) => GROUPS.find(g => g.services.some(s => s.key === svcKey))?.label ?? '';

  useEffect(() => { onCountChange?.(activeServices.length); }, [activeServices.length, onCountChange]);

  const persist = (nextKeys: Record<string, string>) => {
    setKeys(nextKeys);
    // Was der Nutzer selbst eingetragen hat, ist ab jetzt ein Browser-Key (kein Env-Fallback)
    setLocalKeys(nextKeys);
    saveSettings({ ...loadSettings(), apiKeys: nextKeys as AppSettings['apiKeys'] });
  };

  const connect = (serviceKey: string) => {
    if (!input.trim()) return;
    persist({ ...keys, [serviceKey]: input.trim() });
    setInput('');
    setConnecting(null);
  };

  const disconnect = (k: string) => persist({ ...keys, [k]: '' });


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
                  <ConfirmDelete title="Key entfernen" question="Key entfernen?" onConfirm={() => disconnect(svc.key)} style={{ display: 'inline-flex', alignItems: 'center' }} />
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

  return (
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
      </div>
    </>
  );
}
