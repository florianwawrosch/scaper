'use client';

import { useState, useMemo } from 'react';

interface AiColumn {
  name: string;
  values: string[];
}

interface DataTableProps {
  data: Record<string, any>[];
  rawColumns: string[];
  aiColumns?: AiColumn[];
  excludedRows?: Set<number>;
  onExcludeChange?: (indices: Set<number>) => void;
}

const PAGE = 25;

export function DataTable({
  data,
  rawColumns,
  aiColumns = [],
  excludedRows = new Set(),
  onExcludeChange,
}: DataTableProps) {
  const [globalSearch, setGlobalSearch]   = useState('');
  const [colFilters,   setColFilters]     = useState<Record<string, string>>({});
  const [sortCol,      setSortCol]        = useState<string | null>(null);
  const [sortAsc,      setSortAsc]        = useState(true);
  const [page,         setPage]           = useState(1);

  const allColumns = [...rawColumns, ...aiColumns.map(c => c.name)];

  const extended = useMemo(() =>
    data.map((row, i) => {
      const r: Record<string, any> = { ...row, _idx: i };
      for (const col of aiColumns) r[col.name] = col.values[i] ?? '—';
      return r;
    }),
  [data, aiColumns]);

  const filtered = useMemo(() => {
    return extended.filter(row => {
      if (globalSearch) {
        const gs = globalSearch.toLowerCase();
        if (!allColumns.some(c => String(row[c] ?? '').toLowerCase().includes(gs))) return false;
      }
      for (const [col, val] of Object.entries(colFilters)) {
        if (!val) continue;
        if (!String(row[col] ?? '').toLowerCase().includes(val.toLowerCase())) return false;
      }
      return true;
    });
  }, [extended, globalSearch, colFilters, allColumns]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const cmp = String(a[sortCol] ?? '').localeCompare(String(b[sortCol] ?? ''));
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const paginated  = sorted.slice((page - 1) * PAGE, page * PAGE);

  const toggleExclude = (idx: number) => {
    if (!onExcludeChange) return;
    const next = new Set(excludedRows);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    onExcludeChange(next);
  };

  const allVisibleIncluded = paginated.every(row => !excludedRows.has(row._idx));
  const toggleAll = () => {
    if (!onExcludeChange) return;
    const next = new Set(excludedRows);
    if (allVisibleIncluded) paginated.forEach(r => next.add(r._idx));
    else paginated.forEach(r => next.delete(r._idx));
    onExcludeChange(next);
  };

  const sort = (col: string) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
    setPage(1);
  };

  const setFilter = (col: string, val: string) => {
    setColFilters(p => ({ ...p, [col]: val }));
    setPage(1);
  };

  const mono: React.CSSProperties = { fontFamily: "'Spline Sans Mono', monospace" };
  const thStyle: React.CSSProperties = {
    ...mono, fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase',
    padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(255,255,255,.07)', color: '#9aa7bd', cursor: 'pointer', userSelect: 'none',
  };
  const tdStyle: React.CSSProperties = {
    ...mono, fontSize: 11, padding: '5px 8px',
    borderBottom: '1px solid rgba(255,255,255,.04)', color: '#9aa7bd',
    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };
  const filterInput: React.CSSProperties = {
    ...mono, fontSize: 10, width: '100%', minWidth: 50,
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 4, padding: '2px 5px', color: '#f4efe4', outline: 'none',
  };

  const includedCount = data.length - excludedRows.size;

  return (
    <div style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden', fontSize: 11 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <input
          type="text"
          value={globalSearch}
          onChange={e => { setGlobalSearch(e.target.value); setPage(1); }}
          placeholder="Suchen…"
          style={{ ...mono, fontSize: 11, flex: 1, maxWidth: 200, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 5, padding: '3px 8px', color: '#f4efe4', outline: 'none' }}
        />
        {Object.values(colFilters).some(Boolean) && (
          <button onClick={() => { setColFilters({}); setPage(1); }} style={{ ...mono, fontSize: 10, color: '#e8736b', background: 'none', border: 'none', cursor: 'pointer' }}>Filter löschen ×</button>
        )}
        <span style={{ ...mono, fontSize: 10, color: '#5f6e87', marginLeft: 'auto' }}>
          {filtered.length}/{data.length} sichtbar
          {excludedRows.size > 0 && ` · ${excludedRows.size} ausgeschlossen · ${includedCount} inkl.`}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {/* Headers */}
            <tr style={{ background: 'rgba(255,255,255,.03)' }}>
              {onExcludeChange && (
                <th style={{ ...thStyle, width: 28, cursor: 'default' }}>
                  <input type="checkbox" checked={allVisibleIncluded} onChange={toggleAll} style={{ width: 11, height: 11, cursor: 'pointer' }} />
                </th>
              )}
              <th style={{ ...thStyle, width: 28, cursor: 'default', color: '#5f6e87' }}>#</th>
              {rawColumns.map(col => (
                <th key={col} onClick={() => sort(col)} style={thStyle}>
                  {col}{sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
              {aiColumns.map(col => (
                <th key={col.name} onClick={() => sort(col.name)} style={{ ...thStyle, color: '#e8b04b', background: 'rgba(232,176,75,.04)' }}>
                  ✦ {col.name}{sortCol === col.name ? (sortAsc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
            {/* Column filter row */}
            <tr style={{ background: 'rgba(255,255,255,.02)' }}>
              {onExcludeChange && <td style={{ padding: '3px 8px', borderBottom: '1px solid rgba(255,255,255,.06)' }} />}
              <td style={{ padding: '3px 8px', borderBottom: '1px solid rgba(255,255,255,.06)' }} />
              {allColumns.map(col => (
                <td key={col} style={{ padding: '3px 8px', borderBottom: '1px solid rgba(255,255,255,.06)', background: aiColumns.some(c => c.name === col) ? 'rgba(232,176,75,.02)' : undefined }}>
                  <input
                    type="text"
                    placeholder="▼ Filter"
                    value={colFilters[col] || ''}
                    onChange={e => setFilter(col, e.target.value)}
                    style={filterInput}
                  />
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => {
              const excluded = excludedRows.has(row._idx);
              return (
                <tr key={row._idx} style={{ background: excluded ? 'rgba(232,115,107,.04)' : 'transparent', opacity: excluded ? 0.45 : 1, transition: 'opacity .1s' }}>
                  {onExcludeChange && (
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <input type="checkbox" checked={!excluded} onChange={() => toggleExclude(row._idx)} style={{ width: 11, height: 11, cursor: 'pointer' }} />
                    </td>
                  )}
                  <td style={{ ...tdStyle, color: '#5f6e87', fontSize: 10 }}>{(page - 1) * PAGE + i + 1}</td>
                  {rawColumns.map(col => (
                    <td key={col} title={String(row[col] ?? '')} style={tdStyle}>
                      {String(row[col] ?? '—')}
                    </td>
                  ))}
                  {aiColumns.map(col => {
                    const val = String(row[col.name] ?? '—');
                    return (
                      <td key={col.name} style={{ ...tdStyle, background: 'rgba(232,176,75,.02)', maxWidth: 160 }}>
                        <span style={{ ...mono, fontSize: 11, color: '#e8b04b', background: 'rgba(232,176,75,.1)', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                          {val}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={allColumns.length + (onExcludeChange ? 2 : 1)} style={{ ...mono, padding: '28px', textAlign: 'center', fontSize: 11, color: '#5f6e87' }}>
                  Keine Daten
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderTop: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.02)' }}>
          <span style={{ ...mono, fontSize: 10, color: '#5f6e87' }}>{page} / {totalPages}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['←', -1], ['→', 1]].map(([lbl, dir]) => (
              <button
                key={lbl as string}
                onClick={() => setPage(p => Math.min(totalPages, Math.max(1, p + (dir as number))))}
                disabled={dir === -1 ? page === 1 : page === totalPages}
                style={{ ...mono, fontSize: 11, padding: '2px 8px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 4, background: 'none', color: '#9aa7bd', cursor: 'pointer' }}
              >{lbl}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
