'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';

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

const STATUS: Record<ScrapeRun['status'], { label: string; color: string; bg: string; border: string }> = {
  draft:         { label: 'Draft',    color: '#9aa7bd', bg: 'rgba(154,167,189,.08)', border: 'rgba(154,167,189,.2)'  },
  scraping:      { label: 'Scraping', color: '#e8b04b', bg: 'rgba(232,176,75,.08)',  border: 'rgba(232,176,75,.25)' },
  dataset_ready: { label: 'Bereit',   color: '#4fd1c5', bg: 'rgba(79,209,197,.08)',  border: 'rgba(79,209,197,.25)' },
  in_progress:   { label: 'Aktiv',    color: '#e8b04b', bg: 'rgba(232,176,75,.08)',  border: 'rgba(232,176,75,.25)' },
  completed:     { label: 'Fertig',   color: '#4fd1c5', bg: 'rgba(79,209,197,.08)',  border: 'rgba(79,209,197,.25)' },
  failed:        { label: 'Fehler',   color: '#e8736b', bg: 'rgba(232,115,107,.08)', border: 'rgba(232,115,107,.25)'},
};

const FILTERS = ['all', 'dataset_ready', 'completed', 'failed'] as const;
type Filter = typeof FILTERS[number];
const FILTER_LABELS: Record<Filter, string> = {
  all: 'Alle', dataset_ready: 'Bereit', completed: 'Fertig', failed: 'Fehler',
};

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

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '110px 1fr 140px 60px 60px 60px 28px',
    alignItems: 'center',
    gap: 0,
    padding: '0 14px',
    cursor: 'pointer',
    transition: 'background .1s',
    borderBottom: `1px solid ${T.lineS}`,
  };

  const cellStyle: React.CSSProperties = {
    fontFamily: T.mono, fontSize: 11, color: T.inkF, padding: '10px 6px',
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => router.push('/')}
            style={{ fontFamily: T.mono, fontSize: 11, padding: '5px 11px', borderRadius: 5, background: 'transparent', border: `1px solid ${T.lineS}`, color: T.inkD, cursor: 'pointer', flexShrink: 0 }}
          >← Import</button>
          <h1 style={{ fontFamily: T.disp, fontSize: 20, fontWeight: 700, color: T.ink }}>
            Scrape <em style={{ color: T.gold }}>Verlauf</em>
          </h1>
        </div>

        {/* Filter chips + counts */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {FILTERS.map(f => {
            const count = f === 'all' ? runs.length : runs.filter(r => r.status === f).length;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1); }}
                style={{
                  fontFamily: T.mono, fontSize: 10, padding: '4px 10px', borderRadius: 20,
                  border: active ? `1px solid rgba(232,176,75,.4)` : `1px solid ${T.lineS}`,
                  background: active ? 'rgba(232,176,75,.08)' : 'transparent',
                  color: active ? T.gold : T.inkF,
                  cursor: 'pointer', letterSpacing: '.04em',
                }}
              >
                {FILTER_LABELS[f]}
                <span style={{ marginLeft: 5, opacity: .6 }}>{count}</span>
              </button>
            );
          })}
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF, marginLeft: 'auto' }}>
            {filtered.length} Einträge
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', border: `1px solid ${T.lineS}`, borderRadius: 10 }}>
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF }}>Lädt…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', border: `1px solid ${T.lineS}`, borderRadius: 10 }}>
            <p style={{ fontFamily: T.disp, fontSize: 18, color: T.inkF, marginBottom: 6 }}>Keine Runs</p>
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF, opacity: .6 }}>Filter anpassen oder neuen Run starten.</p>
          </div>
        ) : (
          <div style={{ border: `1px solid ${T.lineS}`, borderRadius: 10, overflow: 'hidden' }}>

            {/* Table header */}
            <div style={{ ...rowStyle, cursor: 'default', background: 'rgba(255,255,255,.02)', borderBottom: `1px solid ${T.line}` }}>
              {['Status', 'Quelle / Keywords', 'Erstellt', 'Keep', 'Drop', 'Offen', ''].map((h, i) => (
                <div key={i} style={{ ...cellStyle, color: T.inkF, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', textAlign: i >= 3 ? 'right' : 'left' }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {paginated.map(run => {
              const s  = STATUS[run.status];
              const cr = Object.values(run.classification_results)[0];
              const keywords = (run.scraper_config as any)?.keywords;
              const kw = Array.isArray(keywords) ? keywords.slice(0, 3).join(', ') : (typeof keywords === 'string' ? keywords : run.source);
              return (
                <div
                  key={run.id}
                  style={rowStyle}
                  onClick={() => router.push(`/runs/${run.id}`)}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{ ...cellStyle }}>
                    <span style={{
                      fontFamily: T.mono, fontSize: 9, letterSpacing: '.07em',
                      padding: '2px 8px', borderRadius: 10,
                      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
                    }}>{s.label}</span>
                  </div>
                  <div style={{ ...cellStyle, color: T.inkD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {kw}
                  </div>
                  <div style={{ ...cellStyle, color: T.inkF }}>{fmt(run.created_at)}</div>
                  <div style={{ ...cellStyle, color: '#4fd1c5', fontWeight: 600, fontSize: 13, textAlign: 'right' }}>{cr?.keep ?? '—'}</div>
                  <div style={{ ...cellStyle, color: '#e8736b', textAlign: 'right' }}>{cr?.reject ?? '—'}</div>
                  <div style={{ ...cellStyle, color: '#e8b04b', textAlign: 'right' }}>{cr?.unklar ?? '—'}</div>
                  <div style={{ ...cellStyle, color: T.inkF, textAlign: 'right' }}>→</div>
                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: `1px solid ${T.lineS}`, background: 'rgba(255,255,255,.01)' }}>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF }}>
                  Seite {page} / {totalPages}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['←', -1], ['→', 1]].map(([lbl, dir]) => (
                    <button
                      key={lbl as string}
                      onClick={() => setPage(p => Math.min(totalPages, Math.max(1, p + (dir as number))))}
                      disabled={dir === -1 ? page === 1 : page === totalPages}
                      style={{ fontFamily: T.mono, fontSize: 11, padding: '3px 10px', border: `1px solid ${T.lineS}`, borderRadius: 5, background: 'none', color: T.inkD, cursor: 'pointer' }}
                    >{lbl}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
