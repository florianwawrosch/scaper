'use client';

import { useState } from 'react';
import { getApiKey } from '@/lib/settings';
import { useToast } from './Toast';

interface Props {
  runId: string;
  leadsCount: number;
  onEnrichmentComplete?: () => void;
}

type ProviderStatus = 'idle' | 'running' | 'done' | 'error';

const PROVIDERS = [
  { id: 'hunter_io', label: 'Hunter.io', desc: 'E-Mail Finder' },
  { id: 'findymail', label: 'FindyMail', desc: 'E-Mail Verifikation' },
] as const;

const mono: React.CSSProperties = { fontFamily: "'Spline Sans Mono', monospace" };

const T = {
  panel:  'var(--th-panel)',
  panel2: 'var(--th-panel2)',
  line:   'var(--th-line)',
  lineS:  'var(--th-line-soft)',
  gold:   'var(--th-gold)',
  ink:    'var(--th-ink)',
  inkD:   'var(--th-ink-d)',
  inkF:   'var(--th-ink-f)',
};

export function EnrichmentPanel({ runId, leadsCount, onEnrichmentComplete }: Props) {
  const { showToast } = useToast();
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string>('hunter_io');
  const [status, setStatus] = useState<Record<string, ProviderStatus>>({});
  const [result, setResult] = useState<{ enriched: number; total: number } | null>(null);

  const start = async () => {
    const apiKey = getApiKey(selected as any);
    if (!apiKey) {
      showToast(`Kein API-Key für ${selected} konfiguriert`, 'warning');
      return;
    }
    if (leadsCount === 0) return showToast('Keine Leads zum Enrichment', 'warning');

    setRunning(true);
    setStatus(p => ({ ...p, [selected]: 'running' }));

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/runs/${runId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selected, apiKey }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setResult({ enriched: data.enriched, total: data.total });
      setStatus(p => ({ ...p, [selected]: 'done' }));
      showToast(`${data.enriched} von ${data.total} Leads enriched`, 'success');
      onEnrichmentComplete?.();
    } catch (e) {
      setStatus(p => ({ ...p, [selected]: 'error' }));
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    } finally {
      setRunning(false);
    }
  };

  const statusIcon = (s?: ProviderStatus) =>
    ({ idle: null, running: '↻', done: '✓', error: '✕' }[s ?? 'idle']);

  const statusColor = (s?: ProviderStatus) =>
    ({ idle: T.inkF, running: '#e8b04b', done: '#4fd1c5', error: '#e8736b' }[s ?? 'idle']);

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.line}`, background: T.panel, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...mono, fontSize: 10, letterSpacing: '.1em', color: T.inkF, textTransform: 'uppercase' }}>Enrichment</span>
        <span style={{ ...mono, fontSize: 11, color: T.inkF, marginLeft: 'auto' }}>{leadsCount} Leads</span>
      </div>

      <div style={{ padding: '16px', background: T.panel2, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Provider selector */}
        <div>
          <p style={{ ...mono, fontSize: 9, letterSpacing: '.1em', color: T.inkF, textTransform: 'uppercase', marginBottom: 8 }}>Provider</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PROVIDERS.map(p => {
              const s = status[p.id];
              const icon = statusIcon(s);
              const isActive = selected === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 7, textAlign: 'left', cursor: 'pointer',
                    border: isActive ? '1px solid rgba(232,176,75,.4)' : `1px solid ${T.line}`,
                    background: isActive ? 'rgba(232,176,75,.06)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ ...mono, fontSize: 11, color: isActive ? T.gold : T.inkD }}>{p.label}</span>
                    {icon && (
                      <span style={{ ...mono, fontSize: 11, color: statusColor(s) }}>{icon}</span>
                    )}
                  </div>
                  <p style={{ ...mono, fontSize: 10, color: T.inkF }}>{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Result */}
        {result && (
          <div style={{ padding: '10px 12px', border: '1px solid rgba(79,209,197,.2)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...mono, fontSize: 11, color: T.inkF }}>Ergebnis</span>
            <span style={{ ...mono, fontSize: 12, color: '#4fd1c5', fontWeight: 600 }}>{result.enriched} / {result.total} enriched</span>
          </div>
        )}

        {/* Field list */}
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, listStyle: 'none', padding: 0, margin: 0 }}>
          {['E-Mail Adressen', 'Telefonnummern', 'Unternehmensdaten'].map(f => (
            <li key={f} style={{ ...mono, fontSize: 11, color: T.inkF }}>→ {f}</li>
          ))}
        </ul>

        {/* Run button */}
        <button
          onClick={start}
          disabled={running || leadsCount === 0}
          style={{
            ...mono, width: '100%', padding: '9px 0', borderRadius: 7, cursor: 'pointer',
            border: '1px solid rgba(232,176,75,.35)', background: 'rgba(232,176,75,.1)',
            color: '#e8b04b', fontSize: 12, fontWeight: 600, letterSpacing: '.06em',
            opacity: running || leadsCount === 0 ? 0.4 : 1,
          }}
        >
          {running ? '↻ Läuft…' : '▶ Enrichment starten'}
        </button>

      </div>
    </div>
  );
}
