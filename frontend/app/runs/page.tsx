'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';

const STATUS_PILL: Record<ScrapeRun['status'], { label: string; cls: string }> = {
  draft:         { label: 'Draft',    cls: 'muted' },
  scraping:      { label: 'Scraping', cls: 'warn'  },
  dataset_ready: { label: 'Bereit',   cls: 'good'  },
  in_progress:   { label: 'Aktiv',    cls: 'warn'  },
  completed:     { label: 'Fertig',   cls: 'good'  },
  failed:        { label: 'Fehler',   cls: 'bad'   },
};

const FILTERS = ['all', 'draft', 'dataset_ready', 'completed', 'failed'] as const;
type Filter = typeof FILTERS[number];
const FILTER_LABELS: Record<Filter, string> = { all: 'Alle', draft: 'Draft', dataset_ready: 'Bereit', completed: 'Fertig', failed: 'Fehler' };

export default function RunsList() {
  const router = useRouter();
  const [runs,    setRuns]    = useState<ScrapeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<Filter>('all');
  const [page,    setPage]    = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    api.runs.list().then(setRuns).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered   = filter === 'all' ? runs : runs.filter(r => r.status === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  const totalKeep   = runs.reduce((s, r) => s + (Object.values(r.classification_results)[0]?.keep ?? 0), 0);
  const totalReject = runs.reduce((s, r) => s + (Object.values(r.classification_results)[0]?.reject ?? 0), 0);

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <button
            onClick={() => router.push('/')}
            style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, letterSpacing: '.1em', color: '#5f6e87', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, display: 'block' }}
          >
            ← Dashboard
          </button>
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <span className="idx">HISTORY</span>
            <h1 style={{ fontSize: 'clamp(24px, 3vw, 38px)' }}>Alle <em style={{ color: '#f5cc77' }}>Runs</em></h1>
            <div className="rule" />
          </div>
        </div>

        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 36 }}>
          {[
            { label: 'Total',       value: runs.length,                                                                   cls: '',     bar: 'muted' },
            { label: 'Fertig',      value: runs.filter(r => r.status === 'completed').length,                             cls: 'teal', bar: 'teal'  },
            { label: 'Leads Keep',  value: totalKeep.toLocaleString('de'),                                                cls: 'gold', bar: ''      },
            { label: 'Fehler',      value: runs.filter(r => r.status === 'failed').length,                                cls: 'rose', bar: 'rose'  },
          ].map(({ label, value, cls, bar }) => (
            <div key={label} className="kpi">
              <div className={`bar-accent ${bar}`} />
              <div className="klbl">{label}</div>
              <div className={`kval ${cls}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`chip ${filter === f ? 'active' : ''}`}
            >
              {FILTER_LABELS[f]}
              {f !== 'all' && (
                <span style={{ marginLeft: 6, opacity: .55 }}>{runs.filter(r => r.status === f).length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', background: '#0f1828', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14 }}>
            <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#5f6e87', letterSpacing: '.1em' }}>Lädt…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '56px', textAlign: 'center', background: '#0f1828', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14 }}>
            <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, color: '#5f6e87', marginBottom: 8 }}>Keine Runs</p>
            <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: '#5f6e87', letterSpacing: '.06em' }}>Filter anpassen oder neuen Run starten.</p>
          </div>
        ) : (
          <div style={{ background: '#0f1828', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Quelle</th>
                  <th>Erstellt</th>
                  <th className="r">Keep</th>
                  <th className="r">Reject</th>
                  <th className="r">Unklar</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {paginated.map(run => {
                  const s  = STATUS_PILL[run.status];
                  const cr = Object.values(run.classification_results)[0];
                  return (
                    <tr key={run.id} onClick={() => router.push(`/runs/${run.id}`)}>
                      <td><span className={`pill ${s.cls}`}>{s.label}</span></td>
                      <td className="mono">{run.source}</td>
                      <td style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#5f6e87' }}>{fmt(run.created_at)}</td>
                      <td className="r" style={{ color: '#4fd1c5', fontFamily: "'Spline Sans Mono', monospace", fontWeight: 600, fontSize: 15 }}>
                        {cr?.keep ?? '—'}
                      </td>
                      <td className="r" style={{ color: '#e8736b', fontFamily: "'Spline Sans Mono', monospace", fontSize: 13 }}>
                        {cr?.reject ?? '—'}
                      </td>
                      <td className="r" style={{ color: '#e8b04b', fontFamily: "'Spline Sans Mono', monospace", fontSize: 13 }}>
                        {cr?.unklar ?? '—'}
                      </td>
                      <td className="r" style={{ color: '#5f6e87' }}>→</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.12)' }}>
                <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: '#5f6e87', letterSpacing: '.04em' }}>
                  {filtered.length} Einträge · Seite {page} / {totalPages}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Zurück</button>
                  <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Weiter →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
