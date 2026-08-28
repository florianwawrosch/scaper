'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';

const STATUS_MAP: Record<ScrapeRun['status'], { label: string; cls: string }> = {
  draft:         { label: 'Draft',    cls: 'text-ink-faint border-ink-faint/30 bg-ink-faint/5' },
  scraping:      { label: 'Scraping', cls: 'text-warn border-warn/40 bg-warn/8' },
  dataset_ready: { label: 'Bereit',   cls: 'text-good border-good/40 bg-good/8' },
  in_progress:   { label: 'Aktiv',    cls: 'text-warn border-warn/40 bg-warn/8' },
  completed:     { label: 'Fertig',   cls: 'text-good border-good/40 bg-good/8' },
  failed:        { label: 'Fehler',   cls: 'text-bad border-bad/40 bg-bad/8' },
};

const FILTERS = ['all', 'draft', 'dataset_ready', 'completed', 'failed'] as const;
type Filter = typeof FILTERS[number];

export default function RunsList() {
  const router = useRouter();
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    api.runs.list()
      .then(setRuns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? runs : runs.filter(r => r.status === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const FILTER_LABELS: Record<Filter, string> = {
    all: 'Alle',
    draft: 'Draft',
    dataset_ready: 'Bereit',
    completed: 'Fertig',
    failed: 'Fehler',
  };

  return (
    <div className="min-h-screen bg-noir">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-10">
          <button
            onClick={() => router.push('/')}
            className="text-ink-faint hover:text-gold-bright font-mono text-xs tracking-wider transition-colors mb-6 block"
          >
            ← Dashboard
          </button>
          <p className="text-gold font-mono text-xs tracking-widest uppercase mb-2">Pipeline History</p>
          <h1 className="text-4xl font-disp font-light tracking-tight">
            Alle <em className="italic text-gold-bright">Runs</em>
          </h1>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total', value: runs.length, cls: 'text-ink' },
            { label: 'Fertig', value: runs.filter(r => r.status === 'completed').length, cls: 'text-good' },
            { label: 'Aktiv', value: runs.filter(r => r.status === 'in_progress' || r.status === 'scraping').length, cls: 'text-warn' },
            { label: 'Fehler', value: runs.filter(r => r.status === 'failed').length, cls: 'text-bad' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-panel-2 border border-line rounded-lg px-4 py-3">
              <p className="text-xs font-mono tracking-wider text-ink-faint mb-1 uppercase">{label}</p>
              <p className={`text-2xl font-disp font-light ${cls}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-mono tracking-wider rounded border transition-all ${
                filter === f
                  ? 'bg-gold text-noir border-gold font-semibold'
                  : 'bg-panel-3 border-line text-ink-faint hover:text-ink hover:border-line-soft'
              }`}
            >
              {FILTER_LABELS[f]}
              {f !== 'all' && (
                <span className="ml-1.5 opacity-60">
                  {runs.filter(r => r.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="border border-line rounded-lg bg-panel-2 p-12 text-center">
            <p className="text-ink-faint font-mono text-xs tracking-wider">Lädt…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-line rounded-lg bg-panel-2 p-12 text-center">
            <p className="text-ink-faint font-mono text-xs">Keine Runs gefunden</p>
          </div>
        ) : (
          <div className="border border-line rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-panel border-b border-line">
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-wider text-ink-faint uppercase">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-wider text-ink-faint uppercase">Quelle</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-wider text-ink-faint uppercase hidden sm:table-cell">Erstellt</th>
                  <th className="text-right px-4 py-2.5 text-xs font-mono tracking-wider text-ink-faint uppercase">Keep</th>
                  <th className="text-right px-4 py-2.5 text-xs font-mono tracking-wider text-ink-faint uppercase">Reject</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {paginated.map(run => {
                  const s = STATUS_MAP[run.status];
                  const cr = Object.values(run.classification_results)[0];
                  return (
                    <tr
                      key={run.id}
                      onClick={() => router.push(`/runs/${run.id}`)}
                      className="hover:bg-panel-3/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono tracking-wide ${s.cls}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-ink-dim">{run.source}</td>
                      <td className="px-4 py-3 text-xs font-mono text-ink-faint hidden sm:table-cell">{fmt(run.created_at)}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-semibold text-good">
                        {cr?.keep ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-bad">
                        {cr?.reject ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-ink-faint group-hover:text-gold-bright transition-colors">
                        →
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-line bg-panel flex items-center justify-between">
                <span className="text-xs font-mono text-ink-faint">
                  {filtered.length} Einträge · Seite {page} / {totalPages}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1 text-xs font-mono border border-line rounded text-ink-faint hover:border-gold-dim hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Zurück
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2.5 py-1 text-xs font-mono border border-line rounded text-ink-faint hover:border-gold-dim hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Weiter →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
