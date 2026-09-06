'use client';

import { useState, useEffect } from 'react';
import { fetchKeySetup } from '@/lib/keyAvailability';
import type { KeySetup } from '@/lib/serverKeys';
import { T } from '@/app/theme';

interface Service { key: string; label: string; group: string; where: string }

const SERVICES: Service[] = [
  { key: 'gemini',    label: 'Google Gemini',    group: 'KI-Modelle', where: 'aistudio.google.com' },
  { key: 'anthropic', label: 'Anthropic Claude', group: 'KI-Modelle', where: 'console.anthropic.com' },
  { key: 'openai',    label: 'OpenAI',           group: 'KI-Modelle', where: 'platform.openai.com/api-keys' },
  { key: 'hunter_io', label: 'Hunter.io',        group: 'Enrichment', where: 'hunter.io/api-keys' },
  { key: 'findymail', label: 'FindyMail',        group: 'Enrichment', where: 'app.findymail.com/settings (Bearer-Token)' },
  { key: 'meta_ads',  label: 'Meta Ads Library', group: 'Scraping',   where: 'developers.facebook.com/tools/explorer (User-Token mit ads_read)' },
];

/** Alle bekannten Service-Keys (für das Badge beim ersten Laden) */
export const SERVICE_KEYS = SERVICES.map(s => s.key);

const th: React.CSSProperties = { fontFamily: T.mono, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: T.inkF, textAlign: 'left', padding: '8px 12px', fontWeight: 500, borderBottom: `1px solid ${T.line}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { fontFamily: T.mono, fontSize: 11, color: T.inkD, padding: '9px 12px', borderBottom: `1px solid ${T.lineS}`, verticalAlign: 'middle' };

interface Props {
  /** Anzahl aktiver Integrationen (Badge in der Navigation) */
  onCountChange?: (n: number) => void;
}

/**
 * Einstellungen → Integrationen: API-Keys liegen NUR auf dem Server
 * (Umgebungsvariablen). Hier steht, welcher Dienst einen Key hat, wie die
 * Variable heißt und wo man sie setzt — die Keys selbst sieht der Browser nie.
 */
export function IntegrationsTab({ onCountChange }: Props) {
  const [setup, setSetup] = useState<KeySetup | null | 'loading'>('loading');

  useEffect(() => { fetchKeySetup().then(s => setSetup(s)); }, []);

  const providers = setup && setup !== 'loading' ? setup.providers : {};
  const activeCount = SERVICES.filter(s => providers[s.key]).length;
  useEffect(() => { onCountChange?.(activeCount); }, [activeCount, onCountChange]);

  const info = setup !== 'loading' ? setup : null;
  const onVercel = info?.hosted === 'vercel';
  const directLink = !!info && info.settingsUrl !== 'https://vercel.com/dashboard';

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
          API <em style={{ color: T.gold }}>Integrationen</em>
        </h1>
        <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, marginTop: 4, lineHeight: 1.6 }}>
          Welche Dienste angebunden sind und wo die Keys gesetzt werden.
        </p>
      </div>

      {/* Wo die Keys liegen — mit Link und Klickpfad */}
      <div data-testid="keys-info" style={{ background: 'rgba(99,129,255,.06)', border: '1px solid rgba(99,129,255,.25)', borderRadius: 8, padding: '14px 16px', marginBottom: 22, maxWidth: 760 }}>
        <p style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: '#8fa3ff', marginBottom: 6 }}>
          API-Keys liegen auf dem Server, nicht im Browser
        </p>
        <p style={{ fontFamily: T.body, fontSize: 12.5, color: T.inkD, lineHeight: 1.6, marginBottom: 10 }}>
          Keys werden als Umgebungsvariablen gesetzt. So nutzen alle Kollegen dieselben Dienste,
          und auf keinem Rechner bleibt ein Key zurück. In der App selbst wird nichts eingetragen.
        </p>
        {setup === 'loading' ? (
          <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF }}>Serverstatus wird geladen…</p>
        ) : !info ? (
          <p style={{ fontFamily: T.mono, fontSize: 11, color: '#e8b04b' }}>Serverstatus nicht abrufbar — Seite neu laden.</p>
        ) : onVercel ? (
          <ol style={{ fontFamily: T.body, fontSize: 12.5, color: T.inkD, lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
            <li>
              <a data-testid="keys-env-link" href={info.settingsUrl} target="_blank" rel="noreferrer"
                style={{ fontFamily: T.mono, fontSize: 11, color: '#8fa3ff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                {directLink ? 'Umgebungsvariablen öffnen ↗' : 'Vercel-Dashboard öffnen ↗'}
              </a>
              {!directLink && (
                <span> → Projekt <strong style={{ color: T.ink }}>{info.project || 'auswählen'}</strong> → <strong style={{ color: T.ink }}>Settings</strong> → <strong style={{ color: T.ink }}>Environment Variables</strong></span>
              )}
            </li>
            <li>Variable mit dem Namen aus der Tabelle anlegen, Wert = der Key, für alle Environments.</li>
            <li><strong style={{ color: T.ink }}>Deployments</strong> → neuestes Deployment → ⋯ → <strong style={{ color: T.ink }}>Redeploy</strong>. Erst danach ist der Key aktiv.</li>
          </ol>
        ) : (
          <p style={{ fontFamily: T.body, fontSize: 12.5, color: T.inkD, lineHeight: 1.6 }}>
            Lokaler Dev-Server: Variablen aus der Tabelle in <code style={{ fontFamily: T.mono, color: T.ink }}>frontend/.env.local</code> eintragen und den Dev-Server neu starten.
            Auf Vercel gehören sie in die Projekt-Einstellungen unter Environment Variables.
          </p>
        )}
      </div>

      <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, overflow: 'hidden', background: T.panel }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Dienst</th>
              <th style={th}>Bereich</th>
              <th style={th}>Variable</th>
              <th style={th}>Status</th>
              <th style={th}>Key holen bei</th>
            </tr>
          </thead>
          <tbody>
            {SERVICES.map(s => {
              const active = !!providers[s.key];
              const envName = info?.envNames[s.key] ?? '';
              return (
                <tr key={s.key} data-testid={`integration-${s.key}`}>
                  <td style={{ ...td, color: T.ink, fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</td>
                  <td style={{ ...td, color: T.inkF }}>{s.group}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}><code style={{ fontFamily: T.mono, fontSize: 11, color: T.ink, background: 'rgba(255,255,255,.04)', border: `1px solid ${T.lineS}`, borderRadius: 4, padding: '2px 6px' }}>{envName || '…'}</code></td>
                  <td style={td}>
                    <span data-testid={`integration-status-${s.key}`} style={{
                      fontFamily: T.mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap',
                      color: active ? T.teal : '#e8b04b',
                      background: active ? 'rgba(79,209,197,.08)' : 'rgba(232,176,75,.08)',
                      border: `1px solid ${active ? 'rgba(79,209,197,.25)' : 'rgba(232,176,75,.3)'}`,
                    }}>{setup === 'loading' ? '…' : active ? '✓ gesetzt' : 'fehlt'}</span>
                  </td>
                  <td style={{ ...td, color: T.inkF, fontSize: 10 }}>{s.where}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
