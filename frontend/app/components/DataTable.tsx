'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';

interface AiColumn { name: string; values: string[] }

interface DataTableProps {
  data: Record<string, any>[];
  rawColumns: string[];
  aiColumns?: AiColumn[];
  excludedRows?: Set<number>;
  onExcludeChange?: (indices: Set<number>) => void;
}

interface ColFilter { text: string; values: Set<string> | null }

const PAGE = 25;
const mono: React.CSSProperties = { fontFamily: "'Spline Sans Mono', monospace" };

function FilterDropdown({
  col, allVals, filter, onClose, onChange,
  anchorRect,
}: {
  col: string;
  allVals: string[];
  filter: ColFilter;
  onClose: () => void;
  onChange: (f: ColFilter) => void;
  anchorRect: DOMRect;
}) {
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const selected = filter.values ?? new Set(allVals);
  const displayed = search
    ? allVals.filter(v => v.toLowerCase().includes(search.toLowerCase()))
    : allVals;

  const toggleVal = (v: string) => {
    const cur = filter.values ?? new Set(allVals);
    const next = new Set(cur);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange({ ...filter, values: next.size === allVals.length ? null : next });
  };

  const allChecked = filter.values === null || filter.values.size === allVals.length;

  const left = Math.min(anchorRect.left, window.innerWidth - 240);
  const top  = anchorRect.bottom + 4;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left, top, zIndex: 9999,
        width: 230, background: '#10111a', border: '1px solid rgba(255,255,255,.12)',
        borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,.5)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {/* Text filter input */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <input
          type="text"
          value={filter.text}
          onChange={e => onChange({ ...filter, text: e.target.value })}
          placeholder="Textsuche…"
          autoFocus
          style={{ ...mono, fontSize: 11, width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 5, padding: '4px 8px', color: '#f4efe4', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Value list header */}
      <div style={{ padding: '5px 10px 3px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Werte suchen…"
          style={{ ...mono, fontSize: 10, flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 4, padding: '2px 6px', color: '#9aa7bd', outline: 'none' }}
        />
        <button
          onClick={() => onChange({ ...filter, values: null })}
          style={{ ...mono, fontSize: 10, color: '#8ab4f8', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}
        >Alle</button>
        <button
          onClick={() => onChange({ ...filter, values: new Set() })}
          style={{ ...mono, fontSize: 10, color: '#e8736b', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}
        >Keine</button>
      </div>

      {/* Checkbox list */}
      <div style={{ overflowY: 'auto', maxHeight: 220, padding: '2px 0 6px' }}>
        {displayed.length === 0 ? (
          <p style={{ ...mono, fontSize: 10, color: '#5f6e87', padding: '8px 12px' }}>Keine Treffer</p>
        ) : displayed.map(v => (
          <label
            key={v}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 12px', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <input
              type="checkbox"
              checked={selected.has(v)}
              onChange={() => toggleVal(v)}
              style={{ width: 12, height: 12, cursor: 'pointer', accentColor: '#4fd1c5', flexShrink: 0 }}
            />
            <span style={{ ...mono, fontSize: 11, color: '#c4cdd8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || <em style={{ color: '#5f6e87' }}>(leer)</em>}</span>
          </label>
        ))}
      </div>

      {/* Clear + Done */}
      <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={() => onChange({ text: '', values: null })}
          style={{ ...mono, fontSize: 10, color: '#e8736b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >Filter löschen</button>
        <button
          onClick={onClose}
          style={{ ...mono, fontSize: 10, color: '#4fd1c5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >Fertig</button>
      </div>
    </div>
  );
}

export function DataTable({
  data, rawColumns, aiColumns = [], excludedRows = new Set(), onExcludeChange,
}: DataTableProps) {
  const [globalSearch, setGlobalSearch]   = useState('');
  const [colFilters,   setColFilters]     = useState<Record<string, ColFilter>>({});
  const [sortCol,      setSortCol]        = useState<string | null>(null);
  const [sortAsc,      setSortAsc]        = useState(true);
  const [page,         setPage]           = useState(1);
  const [openFilter,   setOpenFilter]     = useState<{ col: string; rect: DOMRect } | null>(null);

  const allColumns = [...rawColumns, ...aiColumns.map(c => c.name)];

  const extended = useMemo(() =>
    data.map((row, i) => {
      const r: Record<string, any> = { ...row, _idx: i };
      for (const col of aiColumns) r[col.name] = col.values[i] ?? '—';
      return r;
    }),
  [data, aiColumns]);

  const uniqueValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of allColumns) {
      const set = new Set(extended.map(row => String(row[col] ?? '')));
      map[col] = [...set].sort((a, b) => a.localeCompare(b, 'de'));
    }
    return map;
  }, [extended, allColumns]);

  const filtered = useMemo(() => {
    return extended.filter(row => {
      if (globalSearch) {
        const gs = globalSearch.toLowerCase();
        if (!allColumns.some(c => String(row[c] ?? '').toLowerCase().includes(gs))) return false;
      }
      for (const [col, f] of Object.entries(colFilters)) {
        const cell = String(row[col] ?? '');
        if (f.text && !cell.toLowerCase().includes(f.text.toLowerCase())) return false;
        if (f.values !== null && !f.values.has(cell)) return false;
      }
      return true;
    });
  }, [extended, globalSearch, colFilters, allColumns]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const cmp = String(a[sortCol] ?? '').localeCompare(String(b[sortCol] ?? ''), 'de');
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

  const allVisibleIncluded = paginated.every(r => !excludedRows.has(r._idx));
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

  const activeFilters = Object.values(colFilters).filter(f => f.text || f.values !== null).length;

  const thStyle: React.CSSProperties = {
    ...mono, fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase',
    padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(255,255,255,.07)', color: '#9aa7bd',
    userSelect: 'none',
  };
  const tdStyle: React.CSSProperties = {
    ...mono, fontSize: 11, padding: '5px 8px',
    borderBottom: '1px solid rgba(255,255,255,.04)', color: '#9aa7bd',
    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };

  const includedCount = data.length - excludedRows.size;

  const openFilterFor = (col: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setOpenFilter(prev => prev?.col === col ? null : { col, rect });
  };

  return (
    <div style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden', fontSize: 11 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <input
          type="text"
          value={globalSearch}
          onChange={e => { setGlobalSearch(e.target.value); setPage(1); }}
          placeholder="Alle Spalten durchsuchen…"
          style={{ ...mono, fontSize: 11, flex: 1, maxWidth: 240, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 5, padding: '3px 8px', color: '#f4efe4', outline: 'none' }}
        />
        {activeFilters > 0 && (
          <button
            onClick={() => { setColFilters({}); setPage(1); }}
            style={{ ...mono, fontSize: 10, color: '#e8736b', background: 'rgba(232,115,107,.08)', border: '1px solid rgba(232,115,107,.2)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
          >
            {activeFilters} Filter ×
          </button>
        )}
        <span style={{ ...mono, fontSize: 10, color: '#5f6e87', marginLeft: 'auto' }}>
          {filtered.length}/{data.length} sichtbar
          {excludedRows.size > 0 && ` · ${includedCount} inkl.`}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,.03)' }}>
              {onExcludeChange && (
                <th style={{ ...thStyle, width: 28, cursor: 'default' }}>
                  <input type="checkbox" checked={allVisibleIncluded} onChange={toggleAll} style={{ width: 11, height: 11, cursor: 'pointer' }} />
                </th>
              )}
              <th style={{ ...thStyle, width: 28, cursor: 'default', color: '#5f6e87' }}>#</th>
              {rawColumns.map(col => {
                const hasFilter = colFilters[col] && (colFilters[col].text || colFilters[col].values !== null);
                return (
                  <th key={col} style={{ ...thStyle, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ cursor: 'pointer' }} onClick={() => { sort(col); }}>
                        {col}{sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
                      </span>
                      <button
                        onClick={e => openFilterFor(col, e)}
                        title="Filter"
                        style={{
                          ...mono, fontSize: 9, padding: '1px 4px', borderRadius: 3, cursor: 'pointer',
                          background: hasFilter ? 'rgba(79,209,197,.2)' : 'rgba(255,255,255,.06)',
                          border: hasFilter ? '1px solid rgba(79,209,197,.4)' : '1px solid rgba(255,255,255,.1)',
                          color: hasFilter ? '#4fd1c5' : '#5f6e87',
                          lineHeight: 1,
                        }}
                      >▼</button>
                    </div>
                  </th>
                );
              })}
              {aiColumns.map(col => {
                const hasFilter = colFilters[col.name] && (colFilters[col.name].text || colFilters[col.name].values !== null);
                return (
                  <th key={col.name} style={{ ...thStyle, color: '#e8b04b', background: 'rgba(232,176,75,.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ cursor: 'pointer' }} onClick={() => { sort(col.name); }}>
                        ✦ {col.name}{sortCol === col.name ? (sortAsc ? ' ↑' : ' ↓') : ''}
                      </span>
                      <button
                        onClick={e => openFilterFor(col.name, e)}
                        style={{
                          ...mono, fontSize: 9, padding: '1px 4px', borderRadius: 3, cursor: 'pointer',
                          background: hasFilter ? 'rgba(79,209,197,.2)' : 'rgba(255,255,255,.06)',
                          border: hasFilter ? '1px solid rgba(79,209,197,.4)' : '1px solid rgba(255,255,255,.1)',
                          color: hasFilter ? '#4fd1c5' : '#5f6e87',
                          lineHeight: 1,
                        }}
                      >▼</button>
                    </div>
                  </th>
                );
              })}
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

      {/* Filter dropdown portal */}
      {openFilter && (
        <FilterDropdown
          col={openFilter.col}
          allVals={uniqueValues[openFilter.col] ?? []}
          filter={colFilters[openFilter.col] ?? { text: '', values: null }}
          anchorRect={openFilter.rect}
          onChange={f => {
            setColFilters(prev => ({ ...prev, [openFilter.col]: f }));
            setPage(1);
          }}
          onClose={() => setOpenFilter(null)}
        />
      )}
    </div>
  );
}
