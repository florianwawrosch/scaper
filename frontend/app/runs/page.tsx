'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';

export default function RunsList() {
  const router = useRouter();
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScrapeRun['status'] | 'all'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const loadRuns = async () => {
      try {
        const data = await api.runs.list();
        setRuns(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load runs');
      } finally {
        setLoading(false);
      }
    };
    loadRuns();
  }, []);

  const getStatusBadge = (status: ScrapeRun['status']) => {
    const statusMap = {
      draft: { label: 'KONFIGURIERT', color: 'bg-ink-faint/10 border-ink-faint/35 text-ink-faint' },
      scraping: { label: 'WIRD GESCRAPED', color: 'bg-warn/10 border-warn/35 text-warn' },
      dataset_ready: { label: 'BEREIT', color: 'bg-good/10 border-good/35 text-good' },
      in_progress: { label: 'WIRD BEARBEITET', color: 'bg-warn/10 border-warn/35 text-warn' },
      completed: { label: 'FERTIG', color: 'bg-good/10 border-good/35 text-good' },
      failed: { label: 'FEHLER', color: 'bg-bad/10 border-bad/35 text-bad' },
    };
    return statusMap[status];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const filtered = filter === 'all' ? runs : runs.filter(r => r.status === filter);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const maxPage = Math.ceil(filtered.length / pageSize);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-noir">
        <p className="text-ink-dim">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <button
          onClick={() => router.back()}
          className="text-ink-dim hover:text-gold-bright transition-colors mb-6 text-xs font-mono tracking-wider"
        >
          ← Zurück
        </button>

        <div className="border-t border-gold-dim border-b border-line mb-8 py-4">
          <div className="absolute w-[100px] h-px bg-gold -translate-y-[12px]" />
          <h1 className="text-3xl font-disp font-light mb-1">
            Alle <em className="italic text-gold-bright">Runs</em>
          </h1>
          <p className="text-ink-dim text-xs font-light">{filtered.length} Einträge</p>
        </div>

        {error && (
          <div className="bg-bad/10 border border-bad/35 rounded p-3 mb-6 text-bad text-xs">
            {error}
          </div>
        )}

        {/* Filter */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {(['all', 'draft', 'scraping', 'completed', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setFilter(status);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-mono tracking-wider rounded transition-colors ${
                filter === status
                  ? 'bg-gold text-noir font-semibold'
                  : 'bg-panel-3 border border-line text-ink-faint hover:text-ink'
              }`}
            >
              {status === 'all' ? 'ALLE' : status.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="border border-line-soft rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-panel border-b border-line">
                <th className="text-xs font-mono tracking-wider text-ink-faint text-left px-3 py-2 font-medium">
                  Status
                </th>
                <th className="text-xs font-mono tracking-wider text-ink-faint text-left px-3 py-2 font-medium">
                  Quelle
                </th>
                <th className="text-xs font-mono tracking-wider text-ink-faint text-left px-3 py-2 font-medium">
                  Datum
                </th>
                <th className="text-xs font-mono tracking-wider text-ink-faint text-left px-3 py-2 font-medium">
                  Keep
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((run) => {
                const statusInfo = getStatusBadge(run.status);
                const classificationResult = Object.values(run.classification_results)[0];
                const keepCount = classificationResult?.keep || 0;
                return (
                  <tr
                    key={run.id}
                    onClick={() => router.push(`/runs/${run.id}`)}
                    className="border-b border-line-soft hover:bg-panel-3/50 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono tracking-wider border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-dim">{run.source}</td>
                    <td className="px-3 py-2 text-xs text-ink-dim font-mono">{formatDate(run.created_at)}</td>
                    <td className="px-3 py-2 text-xs font-mono text-good font-semibold">{keepCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {maxPage > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs text-ink-dim">
            <span>{filtered.length} Einträge</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-2 py-1 bg-panel-3 border border-line rounded hover:border-gold-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                ← Zurück
              </button>
              <span className="px-3 py-1">
                {page} / {maxPage}
              </span>
              <button
                onClick={() => setPage(Math.min(maxPage, page + 1))}
                disabled={page === maxPage}
                className="px-2 py-1 bg-panel-3 border border-line rounded hover:border-gold-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                Weiter →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
