'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Papa from 'papaparse';
import { saveCsvText } from '@/lib/csvStorage';
import { loadCsvRun, type CsvRunMeta } from '@/lib/csvRuns';
import { EnrichmentPanel } from '@/app/components/EnrichmentPanel';

const T = {
  panel:  'var(--th-panel)',
  line:   'var(--th-line)',
  lineS:  'var(--th-line-soft)',
  gold:   'var(--th-gold)',
  ink:    'var(--th-ink)',
  inkD:   'var(--th-ink-d)',
  inkF:   'var(--th-ink-f)',
  ffMono: 'var(--ff-mono)',
  ffDisp: 'var(--ff-disp)',
};

export default function EnrichPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [meta,  setMeta]  = useState<CsvRunMeta | null>(null);
  const [rows,  setRows]  = useState<Record<string, string>[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadCsvRun(id)
      .then(({ meta: m, rows: r }) => { setMeta(m); setRows(r); })
      .catch(e => setError(e instanceof Error ? e.message : 'Fehler beim Laden.'));
  }, [id]);

  // Merge enriched emails back into the stored CSV so the table keeps them
  const persistEmails = async (results: { email: string }[]) => {
    if (!meta) return;
    try {
      const merged = rows.map((r, i) => ({ ...r, email_enriched: results[i]?.email ?? r.email_enriched ?? '' }));
      const fields = meta.fields.includes('email_enriched') ? meta.fields : [...meta.fields, 'email_enriched'];
      await saveCsvText(id, Papa.unparse(merged));
      // Drop legacy inline rows so the freshly written IndexedDB CSV wins on reload
      const { data: _d, csv: _c, ...cleanMeta } = meta;
      localStorage.setItem(`csv_run_${id}`, JSON.stringify({ ...cleanMeta, fields, rowCount: merged.length }));
      setRows(merged);
      setSaved(true);
    } catch {}
  };

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontFamily: T.ffMono, fontSize: 13, color: '#e8736b' }}>⚠ {error}</p>
      <button onClick={() => router.push('/')} style={{ fontFamily: T.ffMono, fontSize: 12, padding: '6px 16px', borderRadius: 6, background: T.panel, border: `1px solid ${T.line}`, color: T.inkD, cursor: 'pointer' }}>← Zurück</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 24px 64px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => router.push(`/csv/${id}`)}
            style={{ fontFamily: T.ffMono, fontSize: 11, padding: '5px 11px', borderRadius: 5, background: 'transparent', border: `1px solid ${T.lineS}`, color: T.inkD, cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
          >← Tabelle</button>
          <div>
            <h1 style={{ fontFamily: T.ffDisp, fontSize: 20, fontWeight: 700, color: T.ink, marginBottom: 3 }}>
              Enrichment
            </h1>
            <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF, letterSpacing: '.04em' }}>
              {meta?.filename ?? '…'} · {rows.length} Zeilen
            </p>
          </div>
        </div>

        {saved && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(79,209,197,.3)', background: 'rgba(79,209,197,.06)' }}>
            <p style={{ fontFamily: T.ffMono, fontSize: 11, color: '#4fd1c5' }}>
              ✓ E-Mails als Spalte «email_enriched» in die Tabelle übernommen.
            </p>
          </div>
        )}

        <EnrichmentPanel
          runId=""
          rows={rows}
          leadsCount={rows.length}
          availableColumns={meta?.fields ?? []}
          onEmailColumn={persistEmails}
        />

      </div>
    </div>
  );
}
