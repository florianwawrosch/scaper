'use client';

import { useState, useEffect, useRef, type RefObject } from 'react';
import { buildKnownIndex } from '@/lib/leadIndex';
import { matchKnown, KNOWN_COL, EXPORTED_COL, EMAIL_COL, PHONE_COL } from '@/lib/leadKeys';
import { useToast } from '@/app/components/Toast';
import type { CsvRun } from './useAiColumns';

interface Options {
  id: string;
  run: CsvRun | null;
  /** Immer der aktuelle Datensatz (siehe useAiColumns) */
  runRef: RefObject<CsvRun | null>;
  /** Spalten in den Datensatz schreiben (seriell, persistiert) */
  persistColumnsToCsv: (cols: Record<string, string[]>) => Promise<void>;
}

/**
 * Lead-Gedächtnis eines Datensatzes: Abgleich gegen alle anderen Datensätze
 * («bekannt_aus», «exportiert_am», übernommene E-Mails/Telefonnummern) und
 * das Markieren exportierter Zeilen. Läuft einmal automatisch, wenn ein
 * Datensatz noch keine Abgleich-Spalte hat.
 */
export function useLeadMemory({ id, run, runRef, persistColumnsToCsv }: Options) {
  const { showToast } = useToast();
  const [matching, setMatching] = useState(false);
  const matchedRef = useRef(false);

  /**
   * Lead-Gedächtnis: Zeilen gegen alle anderen Datensätze abgleichen und
   * «bekannt_aus» / «exportiert_am» in den Datensatz schreiben.
   */
  const runMatch = async (opts: { silent?: boolean } = {}) => {
    const cur = runRef.current;
    if (!cur || matching) return;
    setMatching(true);
    try {
      const { index, datasets } = await buildKnownIndex(id);
      // Ohne Vergleichsdatensatz keine leeren Spalten anlegen
      if (datasets === 0 && !cur.fields.includes(KNOWN_COL)) {
        if (!opts.silent) showToast('Abgleich: keine anderen Datensätze vorhanden — alles neu', 'info');
        return;
      }
      const m = matchKnown(cur.data, index);
      const cols: Record<string, string[]> = { [KNOWN_COL]: m.knownFrom, [EXPORTED_COL]: m.exportedAt };
      // Anderswo schon enrichte Kontakte übernehmen — nur, wenn es etwas zu übernehmen gibt
      if (m.emailsCopied > 0) cols[EMAIL_COL] = m.email;
      if (m.phonesCopied > 0) cols[PHONE_COL] = m.phone;
      const unchanged = cur.fields.includes(KNOWN_COL) && m.emailsCopied === 0 && m.phonesCopied === 0
        && cur.data.every((r, i) => String(r[KNOWN_COL] ?? '') === m.knownFrom[i] && String(r[EXPORTED_COL] ?? '') === m.exportedAt[i]);
      if (!unchanged) await persistColumnsToCsv(cols);
      if (!opts.silent || m.known > 0) {
        const copied = [m.emailsCopied > 0 && `${m.emailsCopied} E-Mails`, m.phonesCopied > 0 && `${m.phonesCopied} Telefonnummern`].filter(Boolean).join(' und ');
        showToast(
          datasets === 0
            ? 'Abgleich: keine anderen Datensätze vorhanden — alles neu'
            : `Abgleich mit ${datasets} Datensätzen: ${m.known} bereits bekannt, ${m.exported} bereits exportiert, ${cur.data.length - m.known} neu${copied ? ` · ${copied} aus früheren Enrichments übernommen` : ''}`,
          m.known > 0 ? 'warning' : 'info', 7000,
        );
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Abgleich fehlgeschlagen', 'error');
    } finally { setMatching(false); }
  };

  // Einmal automatisch, sobald ein Datensatz ohne Abgleich-Spalte geladen wurde
  useEffect(() => {
    if (!run || matchedRef.current || run.fields.includes(KNOWN_COL)) return;
    matchedRef.current = true;
    queueMicrotask(() => { runMatch({ silent: true }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  /** Zeilen als exportiert markieren (Outreach-Export) */
  const markExported = (idx: number[]) => {
    const cur = runRef.current;
    if (!cur || idx.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const col = cur.data.map(r => String(r[EXPORTED_COL] ?? ''));
    for (const i of idx) col[i] = today;
    persistColumnsToCsv({ [EXPORTED_COL]: col });
  };

  return { matching, runMatch, markExported };
}
