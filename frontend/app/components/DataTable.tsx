'use client';

import { useState } from 'react';

interface DataRow {
  id: string;
  [key: string]: any;
}

interface DataTableProps {
  data: DataRow[];
  columns: string[];
  onMarkKeep?: (id: string) => void;
  onMarkReject?: (id: string) => void;
}

export function DataTable({ data, columns, onMarkKeep, onMarkReject }: DataTableProps) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = data.filter(row =>
    columns.some(col =>
      String(row[col] || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const sorted = sortBy
    ? [...filtered].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortOrder === 'asc' ? cmp : -cmp;
      })
    : filtered;

  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);
  const maxPage = Math.ceil(sorted.length / pageSize);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        type="text"
        placeholder="Suchen..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setPage(1);
        }}
        className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-xs"
      />

      {/* Table */}
      <div className="border border-line-soft rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-panel border-b border-line">
              <th className="px-2 py-2 text-left font-mono tracking-wider text-ink-faint font-medium w-12">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-2 py-2 text-left font-mono tracking-wider text-ink-faint font-medium cursor-pointer hover:text-ink transition-colors"
                >
                  {col}
                  {sortBy === col && (
                    <span className="ml-1 text-gold-bright">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
              <th className="px-2 py-2 text-left font-mono tracking-wider text-ink-faint font-medium w-20">
                Aktion
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, idx) => (
              <tr
                key={row.id}
                className="border-b border-line-soft hover:bg-panel-3/30 transition-colors"
              >
                <td className="px-2 py-1.5 text-ink-dim font-mono">
                  {(page - 1) * pageSize + idx + 1}
                </td>
                {columns.map((col) => (
                  <td key={`${row.id}-${col}`} className="px-2 py-1.5 text-ink-dim truncate max-w-xs">
                    {String(row[col] || '—')}
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    {onMarkKeep && (
                      <button
                        onClick={() => onMarkKeep(row.id)}
                        className="px-1.5 py-0.5 text-xs bg-good/10 border border-good/35 text-good rounded hover:bg-good/20 transition-colors"
                      >
                        ✓
                      </button>
                    )}
                    {onMarkReject && (
                      <button
                        onClick={() => onMarkReject(row.id)}
                        className="px-1.5 py-0.5 text-xs bg-bad/10 border border-bad/35 text-bad rounded hover:bg-bad/20 transition-colors"
                      >
                        ✗
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {maxPage > 1 && (
        <div className="flex items-center justify-between text-xs text-ink-dim">
          <span>{filtered.length} Einträge</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-2 py-1 bg-panel-3 border border-line rounded hover:border-gold-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <span className="px-2 py-1">
              {page} / {maxPage}
            </span>
            <button
              onClick={() => setPage(Math.min(maxPage, page + 1))}
              disabled={page === maxPage}
              className="px-2 py-1 bg-panel-3 border border-line rounded hover:border-gold-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
