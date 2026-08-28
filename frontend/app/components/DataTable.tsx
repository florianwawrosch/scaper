'use client';

import { useState } from 'react';

interface DataTableProps {
  data: Record<string, any>[];
  columns: string[];
  onMarkKeep?: (id: string) => void;
  onMarkReject?: (id: string) => void;
}

export function DataTable({ data, columns, onMarkKeep, onMarkReject }: DataTableProps) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE = 15;

  const filtered = data.filter(row =>
    columns.some(c => String(row[c] ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const cmp = String(a[sortCol] ?? '').localeCompare(String(b[sortCol] ?? ''));
        return sortAsc ? cmp : -cmp;
      })
    : filtered;

  const paginated = sorted.slice((page - 1) * PAGE, page * PAGE);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE));

  const sort = (col: string) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
  };

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      {/* Search bar */}
      <div className="px-4 py-2.5 border-b border-line bg-panel flex items-center gap-3">
        <span className="text-xs font-mono tracking-wider text-ink-faint uppercase">Dataset</span>
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Suchen…"
          className="flex-1 max-w-xs bg-panel-3 border border-line rounded text-ink text-xs font-mono px-2.5 py-1 focus:outline-none focus:border-gold-dim transition-colors placeholder:text-ink-faint/40"
        />
        <span className="text-xs font-mono text-ink-faint ml-auto">{filtered.length} Zeilen</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line bg-panel-2">
              <th className="px-3 py-2 text-left font-mono tracking-wider text-ink-faint w-10">#</th>
              {columns.map(col => (
                <th
                  key={col}
                  onClick={() => sort(col)}
                  className="px-3 py-2 text-left font-mono tracking-wider text-ink-faint cursor-pointer hover:text-ink transition-colors select-none whitespace-nowrap"
                >
                  {col}
                  {sortCol === col && (
                    <span className="ml-1 text-gold">{sortAsc ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
              {(onMarkKeep || onMarkReject) && (
                <th className="px-3 py-2 w-16" />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {paginated.map((row, idx) => (
              <tr key={row.id || idx} className="hover:bg-panel-3/30 transition-colors">
                <td className="px-3 py-2 font-mono text-ink-faint/60 tabular-nums">
                  {(page - 1) * PAGE + idx + 1}
                </td>
                {columns.map(col => (
                  <td key={col} className="px-3 py-2 text-ink-dim font-mono truncate max-w-[200px]">
                    {String(row[col] ?? '—')}
                  </td>
                ))}
                {(onMarkKeep || onMarkReject) && (
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {onMarkKeep && (
                        <button
                          onClick={() => onMarkKeep(row.id || idx)}
                          className="w-6 h-5 text-xs bg-good/10 border border-good/30 text-good rounded hover:bg-good/20 transition-colors"
                        >
                          ✓
                        </button>
                      )}
                      {onMarkReject && (
                        <button
                          onClick={() => onMarkReject(row.id || idx)}
                          className="w-6 h-5 text-xs bg-bad/10 border border-bad/30 text-bad rounded hover:bg-bad/20 transition-colors"
                        >
                          ✗
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-8 text-center text-ink-faint font-mono">
                  Keine Daten
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-2.5 border-t border-line bg-panel flex items-center justify-between">
          <span className="text-xs font-mono text-ink-faint">{page} / {totalPages}</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-xs font-mono border border-line rounded text-ink-faint hover:border-gold-dim hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ←
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs font-mono border border-line rounded text-ink-faint hover:border-gold-dim hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
