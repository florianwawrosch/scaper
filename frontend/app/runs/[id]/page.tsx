'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';
import { DataTable } from '@/app/components/DataTable';
import { ExportPanel } from '@/app/components/ExportPanel';
import { EnrichmentPanel } from '@/app/components/EnrichmentPanel';
import { AnalysisPanel } from '@/app/components/AnalysisPanel';

const TABS = ['Scraping', 'Review & Filter', 'Enrichment', 'Export'] as const;
type Tab = typeof TABS[number];

const STATUS_CONFIG: Record<ScrapeRun['status'], { label: string; pillCls: string }> = {
  draft:         { label: 'Draft',           pillCls: 'muted' },
  scraping:      { label: 'Scraping…',       pillCls: 'warn'  },
  dataset_ready: { label: 'Dataset bereit',  pillCls: 'good'  },
  in_progress:   { label: 'In Bearbeitung',  pillCls: 'warn'  },
  completed:     { label: 'Abgeschlossen',   pillCls: 'good'  },
  failed:        { label: 'Fehler',          pillCls: 'bad'   },
};

export default function RunDetail() {
  const router = useRouter();
  const params = useParams();
  const runId  = params.id as string;

  const [run,          setRun]          = useState<ScrapeRun | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<Tab>('Scraping');
  const [error,        setError]        = useState<string | null>(null);
  const [rating,       setRating]       = useState(0);
  const [feedback,     setFeedback]     = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [tableData,    setTableData]    = useState<any[]>([]);
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

  useEffect(() => { loadRun(); }, [loadRun]);

  // Poll every 3s while scraping
  useEffect(() => {
    if (!run || run.status !== 'scraping') return;
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
  }, [run?.status, runId]);

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
      <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#5f6e87', letterSpacing: '.1em' }}>Lädt…</p>
    </div>
  );

  if (!run) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#e8736b' }}>{error || 'Run nicht gefunden'}</p>
    </div>
  );

  const s  = STATUS_CONFIG[run.status];
  const cr = Object.values(run.classification_results)[0];
  const total = (cr?.keep ?? 0) + (cr?.reject ?? 0) + (cr?.unklar ?? 0);

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px 80px' }}>

        {/* Back */}
        <button
          onClick={() => router.push('/runs')}
          style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, letterSpacing: '.1em', color: '#5f6e87', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 24, display: 'block' }}
        >
          ← Alle Runs
        </button>

        {/* ===== Ticket header ===== */}
        <div className="ticket">
          <div className="tag">Scraping Run · {run.source}</div>
          <h1>Run <em style={{ color: '#f5cc77' }}>#{run.id.slice(0, 8)}</em></h1>
          <p className="sub">{fmt(run.created_at)}</p>
          <div className="meta-row">
            <div className="m">
              <span className="k">Status</span>
              <span className="v">{s.label}</span>
            </div>
            <div className="m">
              <span className="k">Quelle</span>
              <span className="v">{run.source}</span>
            </div>
            <div className="m">
              <span className="k">Datensätze</span>
              <span className="v">
                {tableData.length > 0
                  ? excludedRows.size > 0
                    ? `${(tableData.length - excludedRows.size).toLocaleString('de')} / ${tableData.length.toLocaleString('de')}`
                    : tableData.length.toLocaleString('de')
                  : '—'}
              </span>
            </div>
            <div className="m">
              <span className="k">Rating</span>
              <span className="v">{run.rating > 0 ? '★'.repeat(run.rating) : '—'}</span>
            </div>
          </div>
          <div className="ticket-side">
            <span className={`pill ${s.pillCls}`} style={{ fontSize: 11, padding: '4px 12px', marginBottom: 8 }}>{s.label}</span>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 36, fontWeight: 800, color: '#f5cc77', lineHeight: 1 }}>{cr?.keep ?? 0}</span>
            <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.2em', color: '#5f6e87', textTransform: 'uppercase' }}>Keep</span>
          </div>
        </div>

        {/* ===== KPI grid ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 40 }}>
          {[
            { label: 'Keep',    value: cr?.keep ?? 0,   cls: 'teal', bar: 'teal'  },
            { label: 'Reject',  value: cr?.reject ?? 0, cls: 'rose', bar: 'rose'  },
            { label: 'Unklar',  value: cr?.unklar ?? 0, cls: 'gold', bar: ''      },
            { label: 'Gesamt',  value: total,            cls: '',     bar: 'muted' },
          ].map(({ label, value, cls, bar }) => (
            <div key={label} className="kpi">
              <div className={`bar-accent ${bar}`} />
              <div className="klbl">{label}</div>
              <div className={`kval ${cls}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* ===== Tabs ===== */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,.07)', marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map((tab, i) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    fontFamily: "'Spline Sans Mono', monospace",
                    fontSize: 12,
                    letterSpacing: '.08em',
                    color: active ? '#f4efe4' : '#5f6e87',
                    background: 'none',
                    border: 'none',
                    borderBottom: active ? '2px solid #e8b04b' : '2px solid transparent',
                    padding: '10px 20px',
                    cursor: 'pointer',
                    marginBottom: -1,
                    transition: 'all .15s',
                  }}
                >
                  <span style={{ color: '#e8b04b', opacity: .5, marginRight: 8 }}>{String(i + 1).padStart(2, '0')}</span>
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== Tab content ===== */}
        <div style={{ marginBottom: 56 }}>

          {activeTab === 'Scraping' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card">
                <h5 style={{ marginBottom: 20 }}>Run Details</h5>
                <dl style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { k: 'Status',  v: run.status   },
                    { k: 'Quelle',  v: run.source   },
                    { k: 'Erstellt', v: fmt(run.created_at) },
                    { k: 'Run ID',  v: run.id.slice(0, 16) + '…' },
                  ].map(({ k, v }) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <dt style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10.5, color: '#5f6e87', letterSpacing: '.1em', textTransform: 'uppercase' }}>{k}</dt>
                      <dd style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#f4efe4' }}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {run.scraper_config && !run.scraper_config.error && (
                <div className="card">
                  <h5 style={{ marginBottom: 16 }}>Konfiguration</h5>
                  <pre style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--th-ink-d)', overflow: 'auto', whiteSpace: 'pre-wrap', maxHeight: 180, lineHeight: 1.6 }}>
                    {JSON.stringify(run.scraper_config, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error banner */}
              {run.status === 'failed' && !!run.scraper_config?.error && (
                <div className="card" style={{ gridColumn: '1/-1', borderColor: 'rgba(232,115,107,.3)', background: 'rgba(232,115,107,.06)' }}>
                  <p style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: '#e8736b', marginBottom: 8 }}>Fehler</p>
                  <p style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, color: 'var(--th-ink)', lineHeight: 1.6 }}>
                    {String(run.scraper_config.error)}
                  </p>
                </div>
              )}

              {/* Scraping indicator */}
              {run.status === 'scraping' && (
                <div className="card" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--th-gold)', animation: 'pulse 1.5s infinite' }} />
                  <p style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, color: 'var(--th-ink-d)', letterSpacing: '.04em' }}>
                    Scraping läuft… Seite wird automatisch aktualisiert.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Review & Filter' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <AnalysisPanel
                runId={runId}
                rowCount={tableData.length}
                onColumnResult={(name, values) => {
                  setAiColumns(prev => {
                    const existing = prev.findIndex(c => c.name === name);
                    if (existing >= 0) {
                      const next = [...prev];
                      next[existing] = { name, values };
                      return next;
                    }
                    return [...prev, { name, values }];
                  });
                }}
              />
              {tableData.length > 0 ? (
                <DataTable
                  data={tableData}
                  rawColumns={Object.keys(tableData[0]).slice(0, 8)}
                  aiColumns={aiColumns}
                  excludedRows={excludedRows}
                  onExcludeChange={setExcludedRows}
                />
              ) : (
                <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
                  <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, color: '#5f6e87', marginBottom: 6 }}>Kein Dataset</p>
                  <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: '#5f6e87', letterSpacing: '.04em' }}>Lade Daten hoch oder starte ein Scraping.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Enrichment' && (
            <EnrichmentPanel runId={runId} leadsCount={cr?.keep || 0} />
          )}

          {activeTab === 'Export' && (
            <ExportPanel
              runId={runId}
              leads={tableData
                .filter((_, i) => !excludedRows.has(i))
                .slice(0, 500)
                .map((item, i) => ({
                  id:        item.id || `lead-${i}`,
                  name:      item.name || item.company || '—',
                  email:     item.email || item.contact || undefined,
                  phone:     item.phone || undefined,
                  company:   item.company || undefined,
                  status:    'KEEP' as const,
                  reason:    undefined,
                  createdAt: run.created_at,
                }))}
            />
          )}
        </div>

        {/* ===== Rating ===== */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 40 }}>
          <div className="sec-head">
            <span className="idx">★</span>
            <h2>Bewertung & <em style={{ color: '#f5cc77' }}>Feedback</em></h2>
            <div className="rule" />
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#5f6e87', marginBottom: 12 }}>Rating</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    style={{
                      fontSize: 28,
                      color: rating >= star ? '#e8b04b' : 'rgba(95,110,135,.3)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      transition: 'color .15s',
                      lineHeight: 1,
                    }}
                  >★</button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#5f6e87', marginBottom: 12 }}>Kommentar</p>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Dein Feedback zu diesem Run…"
                rows={3}
                style={{ width: '100%', resize: 'none' }}
              />
            </div>
            <button className="btn-primary" onClick={saveRating} disabled={savingRating} style={{ maxWidth: 200 }}>
              {savingRating ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
