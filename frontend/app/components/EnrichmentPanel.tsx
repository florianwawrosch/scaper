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

  const statusIcon = (s?: ProviderStatus) => ({
    idle: null, running: '↻', done: '✓', error: '✕',
  }[s || 'idle']);

  const statusCls = (s?: ProviderStatus) => ({
    idle: 'text-ink-faint', running: 'text-warn', done: 'text-good', error: 'text-bad',
  }[s || 'idle']);

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-panel flex items-center gap-3">
        <span className="text-xs font-mono tracking-wider text-ink uppercase">Enrichment</span>
        <span className="text-xs font-mono text-ink-faint ml-auto">{leadsCount} Leads</span>
      </div>

      <div className="p-5 bg-panel-2 space-y-4">
        {/* Provider selector */}
        <div>
          <label className="block text-xs font-mono tracking-wider text-ink-faint uppercase mb-2">Provider</label>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map(p => {
              const s = status[p.id];
              const icon = statusIcon(s);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={`px-3 py-2.5 rounded border text-left transition-all ${
                    selected === p.id
                      ? 'border-gold bg-gold/10'
                      : 'border-line hover:border-line-soft'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono ${selected === p.id ? 'text-gold' : 'text-ink-dim'}`}>{p.label}</span>
                    {icon && (
                      <span className={`text-xs font-mono ${statusCls(s)}`}>{icon}</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-faint mt-0.5">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-panel-3 border border-good/20 rounded p-3 flex items-center justify-between">
            <span className="text-xs font-mono text-ink-faint">Ergebnis</span>
            <span className="text-xs font-mono text-good font-semibold">
              {result.enriched} / {result.total} enriched
            </span>
          </div>
        )}

        <div className="space-y-2">
          <ul className="text-xs font-mono text-ink-faint space-y-1">
            <li>→ E-Mail Adressen</li>
            <li>→ Telefonnummern</li>
            <li>→ Unternehmensdaten</li>
          </ul>
        </div>

        <button
          onClick={start}
          disabled={running || leadsCount === 0}
          className="w-full py-2.5 rounded bg-gradient-to-r from-gold to-gold-dim hover:from-gold-bright hover:to-gold text-noir text-xs font-semibold font-mono tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? '↻ Läuft…' : '▶ Enrichment starten'}
        </button>
      </div>
    </div>
  );
}
