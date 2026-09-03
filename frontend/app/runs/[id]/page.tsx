'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';
import { DataTable } from '@/app/components/DataTable';
import { ExportPanel } from '@/app/components/ExportPanel';
import { EnrichmentPanel } from '@/app/components/EnrichmentPanel';
import { AnalysisPanel } from '@/app/components/AnalysisPanel';

const T = {
  bg:    'var(--th-bg)',
  panel: 'var(--th-panel)',
  panel2:'var(--th-panel2)',
  line:  'var(--th-line)',
  lineS: 'var(--th-line-soft)',
  gold:  'var(--th-gold)',
  goldD: 'var(--th-gold-d)',
  ink:   'var(--th-ink)',
  inkD:  'var(--th-ink-d)',
  inkF:  'var(--th-ink-f)',
  teal:  'var(--th-teal)',
  mono:  'var(--ff-mono)',
  disp:  'var(--ff-disp)',
};

const TABS = ['Daten', 'KI-Analyse', 'Enrichment', 'Export'] as const;
type Tab = typeof TABS[number];

const STATUS: Record<ScrapeRun['status'], { label: string; color: string; bg: string; border: string }> = {
  draft:         { label: 'Draft',           color: '#9aa7bd', bg: 'rgba(154,167,189,.08)', border: 'rgba(154,167,189,.2)'  },
  scraping:      { label: 'Scraping…',       color: '#e8b04b', bg: 'rgba(232,176,75,.08)',  border: 'rgba(232,176,75,.25)' },
  dataset_ready: { label: 'Dataset bereit',  color: '#4fd1c5', bg: 'rgba(79,209,197,.08)',  border: 'rgba(79,209,197,.25)' },
  in_progress:   { label: 'In Bearbeitung',  color: '#e8b04b', bg: 'rgba(232,176,75,.08)',  border: 'rgba(232,176,75,.25)' },
  completed:     { label: 'Abgeschlossen',   color: '#4fd1c5', bg: 'rgba(79,209,197,.08)',  border: 'rgba(79,209,197,.25)' },
  failed:        { label: 'Fehler',          color: '#e8736b', bg: 'rgba(232,115,107,.08)', border: 'rgba(232,115,107,.25)'},
};

const card: React.CSSProperties = {
  background: T.panel,
  border: `1px solid ${T.line}`,
  borderRadius: 10,
  padding: '16px 18px',
};

export default function RunDetail() {
  const router = useRouter();
  const params = useParams();
  const runId  = params.id as string;

  const [run,          setRun]          = useState<ScrapeRun | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<Tab>('Daten');
  const [error,        setError]        = useState<string | null>(null);
  const [rating,       setRating]       = useState(0);
  const [feedback,     setFeedback]     = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [tableData,    setTableData]    = useState<Record<string, unknown>[]>([]);
  const [aiColumns,    setAiColumns]    = useState<{ name: string; values: string[] }[]>([]);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());

  const loadRun = useCallback(async () => {
    try {
      const data = await api.runs.get(runId);
      setRun(data);
      setRating(data.rating || 0);
      setFeedback(data.feedback || '');
      try {
        const ds = await api.runs.getDataset(runId);
        if (ds.df_data?.length) setTableData(ds.df_data);
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  // loadRun ist async — jedes setState darin passiert erst nach einem await,
  // der Linter sieht nur den synchronen Aufruf.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadRun(); }, [loadRun]);

  const status = run?.status;
  useEffect(() => {
    if (status !== 'scraping') return;
    const t = setInterval(async () => {
      try {
        const data = await api.runs.get(runId);
        setRun(data);
        if (data.status !== 'scraping') {
          clearInterval(t);
          try {
            const ds = await api.runs.getDataset(runId);
            if (ds.df_data?.length) setTableData(ds.df_data);
          } catch {}
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [status, runId]);

  const saveRating = async () => {
    if (!run) return;
    setSavingRating(true);
    try { const updated = await api.runs.update(runId, { rating, feedback }); setRun(updated); } catch {}
    setSavingRating(false);
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: T.mono, fontSize: 12, color: T.inkF }}>Lädt…</p>
    </div>
  );

  if (!run) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: T.mono, fontSize: 12, color: '#e8736b' }}>{error || 'Run nicht gefunden'}</p>
    </div>
  );

  const s  = STATUS[run.status];
  const cr = Object.values(run.classification_results)[0];
  const keywords = run.scraper_config?.keywords;
  const kwLabel = Array.isArray(keywords) ? keywords.join(', ') : (typeof keywords === 'string' ? keywords : run.source);

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 24px 80px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => router.push('/')}
            style={{ fontFamily: T.mono, fontSize: 11, padding: '5px 11px', borderRadius: 5, background: 'transparent', border: `1px solid ${T.lineS}`, color: T.inkD, cursor: 'pointer', flexShrink: 0, marginTop: 3 }}
          >← Import</button>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{ fontFamily: T.disp, fontSize: 20, fontWeight: 700, color: T.ink }}>
                {kwLabel || 'Scrape Run'}
              </h1>
              <span style={{
                fontFamily: T.mono, fontSize: 9, letterSpacing: '.07em', padding: '2px 8px', borderRadius: 10,
                background: s.bg, border: `1px solid ${s.border}`, color: s.color,
              }}>{s.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF }}>{fmt(run.created_at)}</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF }}>{run.source}</span>
              {tableData.length > 0 && (
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF }}>
                  {excludedRows.size > 0
                    ? `${tableData.length - excludedRows.size} / ${tableData.length} ausgewählt`
                    : `${tableData.length} Datensätze`}
                </span>
              )}
            </div>
          </div>

          {/* Keep count */}
          {cr && (cr.keep > 0 || cr.reject > 0) && (
            <div style={{ flexShrink: 0, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: T.disp, fontSize: 28, fontWeight: 700, color: '#4fd1c5', lineHeight: 1 }}>{cr.keep}</div>
                <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.15em', color: T.inkF, textTransform: 'uppercase', marginTop: 2 }}>Keep</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 600, color: '#e8736b', lineHeight: 1 }}>{cr.reject}</div>
                <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.15em', color: T.inkF, textTransform: 'uppercase', marginTop: 2 }}>Drop</div>
              </div>
            </div>
          )}
        </div>

        {/* Error banner */}
        {run.status === 'failed' && (
          <div style={{ marginBottom: 16, padding: '16px 18px', borderRadius: 10, border: '1px solid rgba(232,115,107,.4)', background: 'rgba(232,115,107,.08)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>⚠</span>
            <div>
              <p style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: '#e8736b', marginBottom: 6, fontWeight: 600 }}>Scraping fehlgeschlagen</p>
              <p style={{ fontFamily: T.mono, fontSize: 13, color: '#f4efe4', lineHeight: 1.65, wordBreak: 'break-word' }}>
                {run.scraper_config?.error ? String(run.scraper_config.error) : 'Unbekannter Fehler — bitte API-Token in den Einstellungen prüfen.'}
              </p>
            </div>
          </div>
        )}

        {/* Scraping indicator */}
        {run.status === 'scraping' && (
          <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.gold, flexShrink: 0 }} />
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkD }}>Scraping läuft… Seite wird automatisch aktualisiert.</p>
          </div>
        )}

        {/* Tabs */}
        <div style={{ borderBottom: `1px solid ${T.lineS}`, marginBottom: 20, display: 'flex', gap: 0 }}>
          {TABS.map((tab, i) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontFamily: T.mono, fontSize: 11, letterSpacing: '.06em',
                  color: active ? T.ink : T.inkF,
                  background: 'none', border: 'none',
                  borderBottom: `2px solid ${active ? T.gold : 'transparent'}`,
                  padding: '8px 16px', cursor: 'pointer', marginBottom: -1,
                  transition: 'color .12s',
                }}
              >
                <span style={{ color: T.gold, opacity: .4, marginRight: 6, fontSize: 9 }}>{String(i + 1).padStart(2, '0')}</span>
                {tab}
              </button>
            );
          })}
        </div>

        {/* Tab content */}

        {activeTab === 'Daten' && (
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {tableData.length > 0 ? (
                <DataTable
                  data={tableData}
                  rawColumns={Object.keys(tableData[0]).slice(0, 12)}
                  aiColumns={aiColumns}
                  excludedRows={excludedRows}
                  onExcludeChange={setExcludedRows}
                />
              ) : (
                <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
                  <p style={{ fontFamily: T.disp, fontSize: 18, color: T.inkF, marginBottom: 6 }}>Kein Dataset</p>
                  <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF, opacity: .6 }}>Starte ein Scraping um Daten zu laden.</p>
                </div>
              )}
            </div>

            {/* Right: run details */}
            <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ ...card }}>
                <p style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 10 }}>Run Details</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { k: 'ID',       v: run.id.slice(0, 12) + '…' },
                    { k: 'Quelle',   v: run.source },
                    { k: 'Erstellt', v: fmt(run.created_at) },
                  ].map(({ k, v }) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: T.inkF }}>{k}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkD, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {run.scraper_config && !run.scraper_config.error && (
                <div style={{ ...card }}>
                  <p style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 8 }}>Konfiguration</p>
                  <pre style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF, overflow: 'auto', whiteSpace: 'pre-wrap', maxHeight: 200, lineHeight: 1.5, margin: 0 }}>
                    {JSON.stringify(run.scraper_config, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'KI-Analyse' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              {tableData.length > 0 ? (
                <DataTable
                  data={tableData}
                  rawColumns={Object.keys(tableData[0]).slice(0, 12)}
                  aiColumns={aiColumns}
                  excludedRows={excludedRows}
                  onExcludeChange={setExcludedRows}
                />
              ) : (
                <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
                  <p style={{ fontFamily: T.disp, fontSize: 18, color: T.inkF }}>Kein Dataset</p>
                </div>
              )}
            </div>
            <div style={{ position: 'sticky', top: 20 }}>
              <AnalysisPanel
                runId={runId}
                rowCount={tableData.length}
                onColumnResult={(name, values) => {
                  setAiColumns(prev => {
                    const idx = prev.findIndex(c => c.name === name);
                    if (idx >= 0) { const next = [...prev]; next[idx] = { name, values }; return next; }
                    return [...prev, { name, values }];
                  });
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'Enrichment' && (
          <div style={{ maxWidth: 480 }}>
            <EnrichmentPanel runId={runId} leadsCount={cr?.keep || tableData.length} />
          </div>
        )}

        {activeTab === 'Export' && (
          <div style={{ maxWidth: 560 }}>
            <ExportPanel
              runId={runId}
              leads={tableData
                .filter((_, i) => !excludedRows.has(i))
                .slice(0, 500)
                .map((item, i) => {
                  const s = (v: unknown) => (v == null || v === '' ? undefined : String(v));
                  return ({
                  id:        s(item.id) ?? `lead-${i}`,
                  name:      s(item.name) ?? s(item.company) ?? '—',
                  email:     s(item.email) ?? s(item.contact) ?? '',
                  phone:     s(item.phone),
                  company:   s(item.company),
                  status:    'KEEP' as const,
                  reason:    undefined,
                  createdAt: run.created_at,
                  });
                })}
            />
          </div>
        )}

        {/* Rating */}
        <div style={{ borderTop: `1px solid ${T.lineS}`, marginTop: 40, paddingTop: 28 }}>
          <p style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 14 }}>Bewertung & Notiz</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  style={{ fontSize: 24, color: rating >= star ? T.gold : 'rgba(95,110,135,.25)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', lineHeight: 1 }}
                >★</button>
              ))}
            </div>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Notiz zu diesem Run…"
              rows={3}
              style={{ fontFamily: T.mono, fontSize: 11, color: T.inkD, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 7, padding: '8px 10px', resize: 'vertical', outline: 'none', lineHeight: 1.6 }}
            />
            <button
              onClick={saveRating}
              disabled={savingRating}
              style={{ fontFamily: T.mono, fontSize: 11, padding: '7px 18px', borderRadius: 6, alignSelf: 'flex-start', background: 'rgba(232,176,75,.1)', border: `1px solid rgba(232,176,75,.3)`, color: T.gold, cursor: 'pointer', opacity: savingRating ? .5 : 1 }}
            >{savingRating ? 'Speichert…' : 'Speichern'}</button>
          </div>
        </div>

      </div>
    </div>
  );
}
