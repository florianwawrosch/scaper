'use client';

import { useState, useRef } from 'react';
import { useToast } from '@/app/components/Toast';
import { appendUsage } from '@/lib/usageLog';

export type EnrichField = 'email' | 'phone';
export interface EnrichResult { email: string; phone: string; enriched: boolean }
export type ProviderStatus = 'idle' | 'running' | 'done' | 'error';

/** Der Server verarbeitet max. 50 Zeilen pro Aufruf (Kosten-Schutz) */
export const ENRICH_BATCH = 50;

export interface EnrichRunOptions {
  provider: string;
  /** Für das Verbrauchsprotokoll */
  dataset?: { id: string; name: string };
  rows: Record<string, string>[];
  fields: EnrichField[];
  mapping: { nameColumn: string; companyColumn: string; linkedinColumn: string };
  /** Nach JEDER Charge mit allen bisherigen Ergebnissen (Index = Zeile in rows) — zum Zwischenspeichern */
  onResults?: (all: EnrichResult[]) => void | Promise<void>;
  onComplete?: () => void;
}

/**
 * Enrichment-Lauf über alle Chargen: Fortschritt, Ergebnis, Abbruch.
 * Abbruch oder Reload verliert nichts, weil nach jeder Charge onResults läuft.
 */
export function useEnrichmentRun() {
  const { showToast } = useToast();
  const [running,  setRunning]  = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; enriched: number } | null>(null);
  const [result,   setResult]   = useState<{ enriched: number; total: number } | null>(null);
  const [status,   setStatus]   = useState<Record<string, ProviderStatus>>({});
  const stopRef  = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const start = async ({ provider, dataset, rows, fields, mapping, onResults, onComplete }: EnrichRunOptions) => {
    const wantEmail = fields.includes('email');
    const wantPhone = fields.includes('phone');
    setRunning(true);
    stopRef.current = false;
    setStatus(p => ({ ...p, [provider]: 'running' }));
    setResult(null);

    const all: EnrichResult[] = [];
    let enrichedTotal = 0, emailsTotal = 0, phonesTotal = 0, processed = 0;
    let firstError: string | null = null;
    const t0 = Date.now();
    setProgress({ done: 0, total: rows.length, enriched: 0 });

    try {
      for (let off = 0; off < rows.length && !stopRef.current; off += ENRICH_BATCH) {
        const batch = rows.slice(off, off + ENRICH_BATCH);
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const res = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, rows: batch, ...mapping, fields }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          let msg = await res.text();
          try { msg = JSON.parse(msg).detail ?? msg; } catch {}
          throw new Error(msg);
        }
        const data = await res.json();
        const results: EnrichResult[] = (data.results ?? []).map((r: Partial<EnrichResult>) => ({ email: r.email ?? '', phone: r.phone ?? '', enriched: !!r.enriched }));
        all.push(...results);
        enrichedTotal += Number(data.enriched) || 0;
        emailsTotal   += Number(data.emails)   || 0;
        phonesTotal   += Number(data.phones)   || 0;
        processed += batch.length;
        if (data.error && !firstError) firstError = data.error;
        setProgress({ done: processed, total: rows.length, enriched: enrichedTotal });
        await onResults?.([...all]);
      }
      const stopped = processed < rows.length;
      setResult({ enriched: enrichedTotal, total: processed });
      setStatus(p => ({ ...p, [provider]: enrichedTotal === 0 && firstError ? 'error' : 'done' }));
      const found = [wantEmail && `${emailsTotal} E-Mails`, wantPhone && `${phonesTotal} Telefonnummern`].filter(Boolean).join(', ');
      showToast(`${found} gefunden bei ${processed} Leads${stopped ? ' — abgebrochen, Rest beim nächsten Start' : ''}`, 'success');
      if (firstError) showToast(`Teilweise Fehler: ${firstError}`, 'warning', 6000);
      onComplete?.();
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      if (processed > 0) setResult({ enriched: enrichedTotal, total: processed });
      setStatus(p => ({ ...p, [provider]: aborted ? 'done' : 'error' }));
      showToast(
        aborted
          ? `Abgebrochen — ${enrichedTotal} von ${processed} Leads gespeichert, Rest beim nächsten Start`
          : `${e instanceof Error ? e.message : 'Fehler'}${processed > 0 ? ` — ${processed} Zeilen bereits gespeichert` : ''}`,
        aborted ? 'info' : 'error', 8000,
      );
    } finally {
      // Verbrauchsprotokoll — auch nach Abbruch zählt, was schon bezahlt wurde
      if (processed > 0) {
        appendUsage({
          kind: 'enrich', datasetId: dataset?.id ?? '', dataset: dataset?.name ?? '',
          what: [wantEmail && 'E-Mail', wantPhone && 'Telefon'].filter(Boolean).join(' + '),
          provider, rows: processed, found: emailsTotal + phonesTotal, ms: Date.now() - t0,
        });
      }
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  };

  /** Der laufende Request wird abgebrochen; Gespeichertes bleibt. */
  const stop = () => { stopRef.current = true; abortRef.current?.abort(); };

  return { running, progress, result, status, start, stop };
}
