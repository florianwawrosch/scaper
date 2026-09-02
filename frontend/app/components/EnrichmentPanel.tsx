'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiKey, loadSettings } from '@/lib/settings';
import { apiFetch } from '@/lib/api';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { useToast } from './Toast';

interface Props {
  runId: string;
  leadsCount: number;
  onEnrichmentComplete?: () => void;
  /** For CSV imports: pick which columns hold name + company */
  availableColumns?: string[];
  resolveRunId?: () => Promise<string>;
  /** Called with the enriched email values so the caller can add a table column */
  onEmailColumn?: (values: { email: string }[]) => void;
  /** When provided, enrichment runs directly via the Vercel route /api/enrich */
  rows?: Record<string, string>[];
}

type ProviderStatus = 'idle' | 'running' | 'done' | 'error';

const ALL_PROVIDERS = [
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

export function EnrichmentPanel({ runId, leadsCount, onEnrichmentComplete, availableColumns, resolveRunId, onEmailColumn, rows }: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [status, setStatus] = useState<Record<string, ProviderStatus>>({});
  const [result, setResult] = useState<{ enriched: number; total: number } | null>(null);
  const [nameCol,    setNameCol]    = useState('');
  const [companyCol, setCompanyCol] = useState('');
  const [available,  setAvailable]  = useState<Record<string, boolean>>({});
  const [keysReady,  setKeysReady]  = useState(false);

  useEffect(() => {
    fetchKeyAvailability().then(server => {
      const local = loadSettings().apiKeys as Record<string, string>;
      const merged: Record<string, boolean> = {};
      for (const p of ALL_PROVIDERS) merged[p.id] = !!local[p.id] || !!server[p.id];
      setAvailable(merged);
      setKeysReady(true);
      // Preselect the first configured provider
      const first = ALL_PROVIDERS.find(p => merged[p.id]);
      if (first) setSelected(prev => prev && merged[prev] ? prev : first.id);
    });
  }, []);

  // Auto-select common column names (e.g. LinkedIn imports use voller_name/firma)
  // so the mapping doesn't have to be picked by hand on every visit. Derived,
  // not synced into state: nameCol/companyCol hold only an explicit user choice
  // ('' = none), the effective value falls back to the auto-pick.
  const pickCol = (candidates: string[]) =>
    availableColumns?.find(c => candidates.includes(c.toLowerCase())) ?? '';
  const effNameCol    = nameCol    || pickCol(['voller_name', 'name', 'full_name', 'vollername']);
  const effCompanyCol = companyCol || pickCol(['firma', 'company', 'unternehmen', 'company_domain', 'domain']);

  // Only show providers that are actually configured (browser key or server env)
  const PROVIDERS = ALL_PROVIDERS.filter(p => available[p.id]);

  const needsMapping = !!availableColumns?.length;

  const start = async () => {
    if (!selected) return showToast('Kein Enrichment-Provider konfiguriert', 'warning');
    // Key from browser settings if present — otherwise the server reads
    // it from its env vars, so don't block when it's missing locally.
    const apiKey = getApiKey(selected as any);
    if (leadsCount === 0) return showToast('Keine Leads zum Enrichment', 'warning');
    if (needsMapping && (!effNameCol || !effCompanyCol)) {
      return showToast('Bitte Name- und Firmen-Spalte auswählen', 'warning');
    }

    setRunning(true);
    setStatus(p => ({ ...p, [selected]: 'running' }));

    try {
      // Backend run id only needed when no rows were passed (backend mode)
      let rid = '';
      if (!rows?.length) {
        rid = runId || (resolveRunId ? await resolveRunId() : '');
        if (!rid) throw new Error('Kein Backend verbunden');
      }

      // Direct mode (rows given): Vercel route, no Python backend needed
      const res = rows?.length
        ? await fetch('/api/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: selected,
              rows,
              nameColumn: effNameCol,
              companyColumn: effCompanyCol,
              ...(apiKey && { apiKey }),
            }),
          })
        : await apiFetch(`/api/runs/${rid}/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: selected,
              ...(apiKey && { apiKey }),
              ...(needsMapping && { nameColumn: effNameCol, companyColumn: effCompanyCol }),
            }),
          });

      if (!res.ok) {
        let msg = await res.text();
        try { msg = JSON.parse(msg).detail ?? msg; } catch {}
        throw new Error(msg);
      }

      const data = await res.json();
      setResult({ enriched: data.enriched, total: data.total });
      setStatus(p => ({ ...p, [selected]: 'done' }));
      showToast(`${data.enriched} von ${data.total} Leads enriched`, 'success');
      if (data.error) showToast(`Teilweise Fehler: ${data.error}`, 'warning', 6000);
      onEmailColumn?.(data.results ?? []);
      onEnrichmentComplete?.();
    } catch (e) {
      setStatus(p => ({ ...p, [selected]: 'error' }));
      showToast(e instanceof Error ? e.message : 'Fehler', 'error', 8000);
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

        {/* No provider configured */}
        {keysReady && PROVIDERS.length === 0 && (
          <div style={{ padding: '14px 16px', border: '1px dashed rgba(255,255,255,.09)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ ...mono, fontSize: 11, color: T.inkF }}>Kein Enrichment-Provider konfiguriert. Hunter.io- oder FindyMail-Key in den Einstellungen bzw. in Vercel hinterlegen.</p>
            <button
              onClick={() => router.push('/settings')}
              style={{ ...mono, fontSize: 10, alignSelf: 'flex-start', padding: '3px 10px', borderRadius: 4, border: '1px solid rgba(99,129,255,.3)', background: 'rgba(99,129,255,.08)', color: '#6381ff', cursor: 'pointer' }}
            >→ Einstellungen</button>
          </div>
        )}

        {/* Provider selector — only configured providers are shown */}
        {PROVIDERS.length > 0 && (
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
        )}

        {/* Column mapping (CSV imports) */}
        {PROVIDERS.length > 0 && needsMapping && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ ...mono, fontSize: 9, letterSpacing: '.1em', color: T.inkF, textTransform: 'uppercase' }}>Spalten-Zuordnung</p>
            {[
              { label: 'Name',  value: effNameCol,    set: setNameCol },
              { label: 'Firma / Domain', value: effCompanyCol, set: setCompanyCol },
            ].map(({ label, value, set }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...mono, fontSize: 10, color: T.inkD, width: 90, flexShrink: 0 }}>{label}</span>
                <select
                  value={value}
                  onChange={e => set(e.target.value)}
                  style={{ ...mono, flex: 1, fontSize: 11, background: 'rgba(255,255,255,.04)', border: `1px solid ${T.line}`, borderRadius: 5, color: T.inkD, padding: '5px 8px', outline: 'none' }}
                >
                  <option value="">— wählen —</option>
                  {availableColumns!.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

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

        {leadsCount > 50 && (
          <p style={{ ...mono, fontSize: 10, color: '#e8b04b', lineHeight: 1.5 }}>
            ⓘ Max. 50 Zeilen pro Lauf (API-Kosten-Schutz). Es werden die ersten 50 verarbeitet.
          </p>
        )}

        {/* Run button */}
        {PROVIDERS.length > 0 && (
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
        )}

      </div>
    </div>
  );
}
