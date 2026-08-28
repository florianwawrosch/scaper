'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Papa from 'papaparse';
import { api } from '@/lib/api';
import { DataTable } from '@/app/components/DataTable';
import { AnalysisPanel } from '@/app/components/AnalysisPanel';

interface CsvRun {
  data: Record<string, string>[];
  fields: string[];
  filename: string;
  createdAt: string;
  backendRunId?: string;
}

interface StoredCsvRun {
  csv?: string;           // new format: raw CSV text
  data?: Record<string, string>[]; // old format: parsed data
  fields: string[];
  filename: string;
  createdAt: string;
  rowCount?: number;
  backendRunId?: string;
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
  teal:   'var(--th-teal)',
  ffMono: 'var(--ff-mono)',
  ffBody: 'var(--ff-body)',
  ffDisp: 'var(--ff-disp)',
};

export default function CsvViewer() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [run,        setRun]        = useState<CsvRun | null>(null);
  const [error,      setError]      = useState('');
  const [aiColumns,  setAiColumns]  = useState<{ name: string; values: string[] }[]>([]);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [backendRunId, setBackendRunId] = useState<string | null>(null);
  const [uploadingToBackend, setUploadingToBackend] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`csv_run_${id}`);
      if (!raw) { setError('Datei nicht gefunden. Bitte erneut hochladen.'); return; }
      const stored: StoredCsvRun = JSON.parse(raw);
      if (stored.backendRunId) setBackendRunId(stored.backendRunId);

      if (stored.csv) {
        // New format: parse raw CSV text
        Papa.parse<Record<string, string>>(stored.csv, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setRun({
              data: results.data,
              fields: stored.fields,
              filename: stored.filename,
              createdAt: stored.createdAt,
              backendRunId: stored.backendRunId,
            });
          },
          error: () => setError('CSV konnte nicht gelesen werden.'),
        });
      } else if (stored.data) {
        // Old format: data already parsed
        setRun({
          data: stored.data,
          fields: stored.fields,
          filename: stored.filename,
          createdAt: stored.createdAt,
          backendRunId: stored.backendRunId,
        });
      } else {
        setError('Ungültiges Dateiformat. Bitte erneut hochladen.');
      }
    } catch {
      setError('Fehler beim Laden der Datei.');
    }
  }, [id]);

  const resolveBackendRunId = useCallback(async (): Promise<string> => {
    if (backendRunId) return backendRunId;
    if (!run) throw new Error('Keine CSV-Daten vorhanden');

    setUploadingToBackend(true);
    try {
      const r = await api.runs.create('csv_import', { filename: run.filename });
      const mapping: Record<string, string> = {};
      for (const f of run.fields) mapping[f] = f;
      await api.runs.saveDataset(r.id, run.data, mapping);

      const updated: CsvRun = { ...run, backendRunId: r.id };
      localStorage.setItem(`csv_run_${id}`, JSON.stringify(updated));
      setBackendRunId(r.id);
      return r.id;
    } finally {
      setUploadingToBackend(false);
    }
  }, [backendRunId, run, id]);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontFamily: T.ffMono, fontSize: 13, color: '#e8736b' }}>⚠ {error}</p>
      <button onClick={() => router.push('/')} style={{ fontFamily: T.ffMono, fontSize: 12, padding: '6px 16px', borderRadius: 6, background: T.panel, border: `1px solid ${T.line}`, color: T.inkD, cursor: 'pointer' }}>← Zurück</button>
    </div>
  );

  if (!run) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: T.ffMono, fontSize: 12, color: T.inkF }}>Lädt…</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px 64px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => router.push('/')}
            style={{ fontFamily: T.ffMono, fontSize: 11, padding: '5px 11px', borderRadius: 5, background: 'transparent', border: `1px solid ${T.lineS}`, color: T.inkD, cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
          >← Import</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: T.ffDisp, fontSize: 20, fontWeight: 700, color: T.ink, marginBottom: 3 }}>
              {run.filename}
            </h1>
            <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF, letterSpacing: '.04em' }}>
              importiert {fmt(run.createdAt)}
            </p>
          </div>
        </div>

        {/* Main grid: table + analysis panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

          {/* Table */}
          <div style={{ minWidth: 0 }}>
            <DataTable
              data={run.data}
              rawColumns={run.fields}
              aiColumns={aiColumns}
              excludedRows={excludedRows}
              onExcludeChange={setExcludedRows}
            />
          </div>

          {/* Right panel: AI analysis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 20 }}>

            {uploadingToBackend && (
              <div style={{ background: T.panel2, border: `1px solid ${T.lineS}`, borderRadius: 7, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.gold, flexShrink: 0 }} />
                <p style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkD }}>Daten werden zum Backend übertragen…</p>
              </div>
            )}

            <AnalysisPanel
              runId={backendRunId ?? ''}
              resolveRunId={resolveBackendRunId}
              rowCount={run.data.length}
              onColumnResult={(name, values) => {
                setAiColumns(prev => {
                  const idx = prev.findIndex(c => c.name === name);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = { name, values };
                    return next;
                  }
                  return [...prev, { name, values }];
                });
              }}
            />

          </div>
        </div>

      </div>
    </div>
  );
}
