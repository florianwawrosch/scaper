'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';
import { deleteCsvText } from '@/lib/csvStorage';
import { ConfirmDelete } from '@/app/components/ConfirmDelete';
import { T } from '@/app/theme';

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

interface LocalRun {
  id: string;
  filename: string;
  createdAt: string;
  rowCount: number;
  isScrape: boolean;
  configSummary?: string;
}

/** One-line human summary of the settings a scrape was run with. */
function summarizeConfig(c: Record<string, unknown> | undefined): string {
  if (!c) return '';
  const parts: string[] = [];
  const country = c.country ?? (Array.isArray(c.countries) ? c.countries[0] : undefined);
  if (country) parts.push(country === 'ALL' ? 'Alle Länder' : String(country));
  if (Array.isArray(c.platforms) && c.platforms.length) parts.push(c.platforms.map((p) => { const s = String(p); return s[0] + s.slice(1).toLowerCase(); }).join('+'));
  if (c.adStatus) parts.push(c.adStatus === 'ACTIVE' ? 'Aktiv' : String(c.adStatus));
  if (c.limit) parts.push(`max ${c.limit}`);
  return parts.join(' · ');
}

export default function RunsList() {
  const router = useRouter();
  const [runs,      setRuns]      = useState<ScrapeRun[]>([]);
  const [localRuns, setLocalRuns] = useState<LocalRun[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<Filter>('all');
  const [page,      setPage]      = useState(1);
  const PAGE_SIZE = 25;

  const deleteLocal = async (id: string) => {
    try { localStorage.removeItem(`csv_run_${id}`); await deleteCsvText(id); } catch {}
    setLocalRuns(prev => prev.filter(x => x.id !== id));
  };

  useEffect(() => {
    // Local entries (scrapes + CSV imports) render instantly
    const items: LocalRun[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('csv_run_csv_')) {
        try {
          const val = JSON.parse(localStorage.getItem(key)!);
          items.push({
            id: key.replace('csv_run_', ''),
            filename: val.filename ?? '?',
            createdAt: val.createdAt ?? '',
            rowCount: val.rowCount ?? val.data?.length ?? 0,
            isScrape: String(val.filename ?? '').startsWith('Meta:'),
            configSummary: summarizeConfig(val.scrapeConfig),
          });
        } catch {}
      }
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // localStorage gibt es erst im Browser: ein lazy useState würde beim
    // SSR-Prerender leer rendern und beim Hydrate springen — daher Effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalRuns(items);
    setLoading(false);
    // Backend runs (if a backend exists) merge in afterwards
    api.runs.list().then(setRuns).catch(() => {});
  }, []);

  const filtered   = filter === 'all' ? runs : runs.filter(r => r.status === filter);
  // Local entries appear in the "Alle" view, newest first alongside backend runs
  const showLocal  = filter === 'all' ? localRuns : [];
  const totalCount = filtered.length + showLocal.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const merged: ({ kind: 'backend'; run: ScrapeRun } | { kind: 'local'; run: LocalRun })[] = [
    ...showLocal.map(r => ({ kind: 'local' as const, run: r })),
    ...filtered.map(r => ({ kind: 'backend' as const, run: r })),
  ].sort((a, b) => {
    const da = a.kind === 'local' ? a.run.createdAt : a.run.created_at;
    const db = b.kind === 'local' ? b.run.createdAt : b.run.created_at;
    return String(db).localeCompare(String(da));
  });
  const paginated = merged.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
            {totalCount} Einträge
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', border: `1px solid ${T.lineS}`, borderRadius: 10 }}>
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF }}>Lädt…</p>
          </div>
        ) : totalCount === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', border: `1px solid ${T.lineS}`, borderRadius: 10 }}>
            <p style={{ fontFamily: T.disp, fontSize: 18, color: T.inkF, marginBottom: 6 }}>Keine Runs</p>
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF, opacity: .6 }}>Filter anpassen oder neuen Run starten.</p>
          </div>
        ) : (
          <div style={{ border: `1px solid ${T.lineS}`, borderRadius: 10, overflow: 'hidden' }}>

            {/* Table header */}
            <div style={{ ...rowStyle, cursor: 'default', background: 'rgba(255,255,255,.02)', borderBottom: `1px solid ${T.line}` }}>
              {['Status', 'Quelle / Keywords', 'Erstellt', 'Zeilen', 'Drop', 'Offen', ''].map((h, i) => (
                <div key={i} style={{ ...cellStyle, color: T.inkF, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', textAlign: i >= 3 ? 'right' : 'left' }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {paginated.map(entry => {
              if (entry.kind === 'local') {
                const r = entry.run;
                return (
                  <div
                    key={r.id}
                    style={rowStyle}
                    onClick={() => router.push(`/csv/${r.id}`)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{ ...cellStyle }}>
                      <span style={{
                        fontFamily: T.mono, fontSize: 9, letterSpacing: '.07em',
                        padding: '2px 8px', borderRadius: 10,
                        background: r.isScrape ? 'rgba(232,176,75,.08)' : 'rgba(99,129,255,.08)',
                        border: r.isScrape ? '1px solid rgba(232,176,75,.25)' : '1px solid rgba(99,129,255,.25)',
                        color: r.isScrape ? '#e8b04b' : '#6381ff',
                      }}>{r.isScrape ? 'Scrape' : 'CSV'}</span>
                    </div>
                    <div style={{ ...cellStyle, overflow: 'hidden' }}>
                      <div style={{ color: T.inkD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.filename}</div>
                      {r.configSummary && (
                        <div style={{ fontSize: 9, color: T.inkF, opacity: .7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{r.configSummary}</div>
                      )}
                    </div>
                    <div style={{ ...cellStyle, color: T.inkF }}>{r.createdAt ? fmt(r.createdAt) : '—'}</div>
                    <div style={{ ...cellStyle, color: '#4fd1c5', fontWeight: 600, fontSize: 13, textAlign: 'right' }}>{r.rowCount}</div>
                    <div style={{ ...cellStyle, color: T.inkF, textAlign: 'right' }}>—</div>
                    <div style={{ ...cellStyle, color: T.inkF, textAlign: 'right' }}>—</div>
                    <div style={{ ...cellStyle, display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                      <ConfirmDelete onConfirm={() => deleteLocal(r.id)} title="Eintrag löschen" />
                    </div>
                  </div>
                );
              }
              const run = entry.run;
              const s  = STATUS[run.status];
              const cr = Object.values(run.classification_results)[0];
              const keywords = run.scraper_config?.keywords;
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
