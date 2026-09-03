'use client';

import { useState, useRef, useEffect } from 'react';
import { isPendingAiValue, isAiError } from '@/lib/ai';
import { Glyph } from './Glyph';
import { FilterDropdown } from './FilterDropdown';
import { useTableState, PAGE_SIZE as PAGE } from '@/app/hooks/useTableState';
import { linkTarget } from '@/lib/tableQuery';
import { downloadCsv, downloadXlsx } from '@/lib/tableExport';
import { mono } from '@/app/theme';

interface AiColumn { name: string; values: string[]; label?: string }

/** Auswertungs-Chip über der Tabelle; mit filter wird er zum Ein-Klick-Filter */
export interface StatChip {
  text: string;
  tone: 'gold' | 'teal';
  filter?: { column: string; value: string };
}

/**
 * Zusätzlicher Export-Button in der Toolbar. `transform` bekommt die aktuell
 * sichtbaren, nicht abgewählten Zeilen (Filter/Sortierung/Abwahl der Tabelle
 * gelten also) und liefert die fertigen CSV-Spalten/-Zeilen — oder null, wenn
 * es nichts zu exportieren gibt (der Aufrufer meldet das selbst).
 */
export interface ExportPreset {
  label: string;
  /** Unicode-Icon vor dem Label, z.B. '↓' */
  icon?: string;
  title?: string;
  transform: (rows: Record<string, unknown>[]) => { filename: string; columns: string[]; rows: Record<string, string>[] } | null;
}

interface DataTableProps {
  data: Record<string, unknown>[];
  rawColumns: string[];
  aiColumns?: AiColumn[];
  excludedRows?: Set<number>;
  onExcludeChange?: (indices: Set<number>) => void;
  /** Auswertungs-Chips über der Toolbar (Klick filtert die Tabelle) */
  stats?: StatChip[];
  /** Bei Erhöhung scrollt die Tabelle ans rechte Ende (Parent hat eine Spalte angelegt) */
  scrollSignal?: number;
  /** "+ KI-Spalte" header button: creates a new AI column directly in the table */
  onAddAiColumn?: () => void;
  /** ⚙ in an AI column header: open the configuration for that column */
  onConfigureAiColumn?: (name: string) => void;
  /** ▶ in an AI column header: run the analysis for that column */
  onRunAiColumn?: (name: string) => void;
  /** Toolbar action: add the pages of the DESELECTED rows to the Blockliste */
  onBlockPages?: (rows: Record<string, unknown>[]) => void;
  /** Weitere Export-Buttons neben ↓ CSV / ↓ XLSX (z.B. Outreach-CSV) */
  exportPresets?: ExportPreset[];
  /** Zusätzliches Toolbar-Element links von «+ KI-Spalte» (z.B. Vorlagen-Menü) */
  toolbarExtra?: React.ReactNode;
}


export function DataTable({
  data, rawColumns, aiColumns = [], excludedRows = new Set(), onExcludeChange,
  stats, scrollSignal = 0, onAddAiColumn, onConfigureAiColumn, onRunAiColumn, onBlockPages,
  exportPresets = [], toolbarExtra,
}: DataTableProps) {
  const {
    globalSearch, setGlobalSearch, colFilters, setColFilters, activeFilters,
    sortCol, sortAsc, sort, page, setPage, totalPages, hiddenCols, setHiddenCols,
    allColumns, visibleRawColumns, extended, uniqueValues, sorted, paginated,
    chipFilterActive, toggleChipFilter,
  } = useTableState(data, rawColumns, aiColumns);
  const [openFilter,  setOpenFilter]  = useState<{ col: string; rect: DOMRect } | null>(null);
  const [colMenuOpen, setColMenuOpen] = useState(false);

  // When the parent creates an AI column it bumps scrollSignal — the new column
  // appears at the right end, so scroll there (otherwise "+ KI-Spalte" feels
  // like it did nothing). Restored columns after a reload don't bump the signal.
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevScrollSignal = useRef(scrollSignal);
  useEffect(() => {
    if (scrollSignal > prevScrollSignal.current && scrollRef.current) {
      const el = scrollRef.current;
      requestAnimationFrame(() => { el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }); });
    }
    prevScrollSignal.current = scrollSignal;
  }, [scrollSignal]);

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

  /** Sichtbare, nicht abgewählte Zeilen — Basis für jeden Export */
  const exportRows = () => sorted.filter(row => !excludedRows.has(row._idx));

  const exportCsv = () =>
    downloadCsv(`export_${new Date().toISOString().slice(0, 10)}.csv`, allColumns, exportRows());

  const exportPreset = (p: ExportPreset) => {
    const out = p.transform(exportRows());
    if (out) downloadCsv(out.filename, out.columns, out.rows);
  };

  const exportXlsx = () =>
    downloadXlsx(`export_${new Date().toISOString().slice(0, 10)}.xlsx`, allColumns, exportRows());

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

  // URLs and bare domains (e.g. "app.quiz-akademie.de") become clickable links
  const renderCell = (val: string) => {
    const href = linkTarget(val);
    if (!href) return val || '—';
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        style={{ color: '#8ab4f8', textDecoration: 'none' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
      >{val.trim()}</a>
    );
  };

  return (
    <div style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden', fontSize: 11 }}>

      {/* Auswertungs-Chips: Klick filtert die Tabelle */}
      {stats && stats.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,.05)', background: 'rgba(255,255,255,.015)' }}>
          {stats.map((c, i) => {
            const active = c.filter ? chipFilterActive(c.filter) : false;
            const color = c.tone === 'teal' ? '#4fd1c5' : '#e8b04b';
            const rgb   = c.tone === 'teal' ? '79,209,197' : '232,176,75';
            return (
              <button
                key={i}
                onClick={c.filter ? () => toggleChipFilter(c.filter!) : undefined}
                title={c.filter ? (active ? 'Filter aufheben' : `Tabelle auf ${c.filter.column} = ${c.filter.value} filtern`) : undefined}
                style={{
                  ...mono, fontSize: 10, padding: '3px 10px', borderRadius: 12, letterSpacing: '.03em',
                  border: `1px solid rgba(${rgb},${active ? '.7' : '.3'})`,
                  background: active ? `rgba(${rgb},.22)` : `rgba(${rgb},.06)`,
                  color,
                  cursor: c.filter ? 'pointer' : 'default',
                }}
              >{c.text}{active ? ' ×' : ''}</button>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <input
          type="text"
          value={globalSearch}
          onChange={e => setGlobalSearch(e.target.value)}
          placeholder="Alle Spalten durchsuchen…"
          style={{ ...mono, fontSize: 11, flex: 1, maxWidth: 240, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 5, padding: '3px 8px', color: '#f4efe4', outline: 'none' }}
        />
        {activeFilters > 0 && (
          <button
            onClick={() => setColFilters({})}
            style={{ ...mono, fontSize: 10, color: '#e8736b', background: 'rgba(232,115,107,.08)', border: '1px solid rgba(232,115,107,.2)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
          >
            {activeFilters} Filter ×
          </button>
        )}
        {onBlockPages && excludedRows.size > 0 && (() => {
          const deselected = extended.filter(r => excludedRows.has(r._idx));
          const pageCount = new Set(deselected.map(r => String(r.page_name ?? '').trim()).filter(Boolean)).size;
          return (
            <button
              onClick={() => onBlockPages(deselected)}
              disabled={pageCount === 0}
              title="Die Seitennamen der abgewählten Zeilen dauerhaft zur Blockliste hinzufügen — künftige Scrapes schließen sie aus"
              style={{
                ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, cursor: 'pointer',
                border: '1px solid rgba(232,115,107,.35)', background: 'rgba(232,115,107,.08)', color: '#e8736b',
                opacity: pageCount === 0 ? 0.4 : 1,
              }}
            ><Glyph>🚫</Glyph>{pageCount} {pageCount === 1 ? 'Seite' : 'Seiten'} blocken</button>
          );
        })()}
        <span style={{ ...mono, fontSize: 10, color: '#5f6e87', marginLeft: 'auto' }}>
          {sorted.length}/{data.length} sichtbar
          {excludedRows.size > 0 && ` · ${includedCount} ausgewählt`}
        </span>

        {/* Column visibility menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setColMenuOpen(o => !o)}
            title="Spalten ein-/ausblenden"
            style={{
              ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
              border: hiddenCols.size > 0 ? '1px solid rgba(232,176,75,.4)' : '1px solid rgba(255,255,255,.12)',
              background: hiddenCols.size > 0 ? 'rgba(232,176,75,.08)' : 'transparent',
              color: hiddenCols.size > 0 ? '#e8b04b' : '#9aa7bd',
            }}
          ><Glyph>⊞</Glyph>Spalten{hiddenCols.size > 0 ? ` (${visibleRawColumns.length}/${rawColumns.length})` : ''}</button>
          {colMenuOpen && (
            <>
              <div onClick={() => setColMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 9999, width: 200,
                maxHeight: 320, overflowY: 'auto', background: '#10111a',
                border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,.5)',
              }}>
                <div style={{ padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#5f6e87' }}>Spalten</span>
                  {hiddenCols.size > 0 && (
                    <button onClick={() => setHiddenCols(new Set())} style={{ ...mono, fontSize: 10, color: '#4fd1c5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Alle zeigen</button>
                  )}
                </div>
                {rawColumns.map(col => {
                  const visible = !hiddenCols.has(col);
                  return (
                    <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <input type="checkbox" checked={visible}
                        onChange={() => setHiddenCols(prev => {
                          const next = new Set(prev);
                          if (next.has(col)) next.delete(col); else next.add(col);
                          return next;
                        })}
                        style={{ width: 12, height: 12, cursor: 'pointer', accentColor: '#4fd1c5', flexShrink: 0 }} />
                      <span style={{ ...mono, fontSize: 11, color: visible ? '#c4cdd8' : '#5f6e87', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {toolbarExtra}
        {onAddAiColumn && (
          <button
            onClick={onAddAiColumn}
            title="Neue KI-Spalte anlegen"
            style={{ ...mono, fontSize: 10, padding: '2px 10px', borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(232,176,75,.35)', background: 'rgba(232,176,75,.08)', color: '#e8b04b', whiteSpace: 'nowrap' }}
          ><Glyph>+</Glyph>KI-Spalte</button>
        )}
        <button
          onClick={exportCsv}
          disabled={sorted.length === 0}
          title="Als CSV exportieren"
          style={{ ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(79,209,197,.3)', background: 'rgba(79,209,197,.06)', color: '#4fd1c5', opacity: sorted.length === 0 ? 0.4 : 1 }}
        ><Glyph>↓</Glyph>CSV</button>
        <button
          onClick={exportXlsx}
          disabled={sorted.length === 0}
          title="Als Excel exportieren"
          style={{ ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(79,209,197,.3)', background: 'rgba(79,209,197,.06)', color: '#4fd1c5', opacity: sorted.length === 0 ? 0.4 : 1 }}
        ><Glyph>↓</Glyph>XLSX</button>
        {exportPresets.map(p => (
          <button
            key={p.label}
            onClick={() => exportPreset(p)}
            disabled={sorted.length === 0}
            title={p.title}
            style={{ ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(232,176,75,.35)', background: 'rgba(232,176,75,.08)', color: '#e8b04b', whiteSpace: 'nowrap', opacity: sorted.length === 0 ? 0.4 : 1 }}
          >{p.icon && <Glyph>{p.icon}</Glyph>}{p.label}</button>
        ))}
      </div>

      {/* Table */}
      <div ref={scrollRef} style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,.03)' }}>
              {onExcludeChange && (
                <th style={{ ...thStyle, width: 28, cursor: 'default' }}>
                  <input type="checkbox" checked={allVisibleIncluded} onChange={toggleAll} style={{ width: 11, height: 11, cursor: 'pointer' }} />
                </th>
              )}
              <th style={{ ...thStyle, width: 28, cursor: 'default', color: '#5f6e87' }}>#</th>
              {visibleRawColumns.map(col => {
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
              {/* AI columns at the end, in creation order */}
              {aiColumns.map(col => {
                const hasFilter = colFilters[col.name] && (colFilters[col.name].text || colFilters[col.name].values !== null);
                return (
                  <th key={col.name} style={{ ...thStyle, color: '#e8b04b', background: 'rgba(232,176,75,.04)', minWidth: 170, borderLeft: '1px dashed rgba(232,176,75,.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ cursor: 'pointer' }} onClick={() => { sort(col.name); }}>
                        ✦ {col.name}{sortCol === col.name ? (sortAsc ? ' ↑' : ' ↓') : ''}
                        {col.label && (
                          <span style={{ display: 'block', fontSize: 8, letterSpacing: '.05em', color: '#9aa7bd', textTransform: 'none', fontWeight: 400, marginTop: 1 }}>
                            {col.label}
                          </span>
                        )}
                      </span>
                      {onConfigureAiColumn && (
                        <button
                          onClick={e => { e.stopPropagation(); onConfigureAiColumn(col.name); }}
                          title="Spalte konfigurieren (Name, Modell, Prompt)"
                          style={{ fontSize: 16, padding: '3px 8px', borderRadius: 5, background: 'rgba(232,176,75,.12)', border: '1px solid rgba(232,176,75,.35)', cursor: 'pointer', color: '#e8b04b', lineHeight: 1 }}
                        >⚙</button>
                      )}
                      {onRunAiColumn && (
                        <button
                          onClick={e => { e.stopPropagation(); onRunAiColumn(col.name); }}
                          title="Analyse für diese Spalte starten"
                          style={{ fontSize: 14, padding: '4px 9px', borderRadius: 5, background: 'rgba(79,209,197,.12)', border: '1px solid rgba(79,209,197,.35)', cursor: 'pointer', color: '#4fd1c5', lineHeight: 1 }}
                        >▶</button>
                      )}
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
                <tr key={row._idx} style={{
                  background: excluded ? 'rgba(232,115,107,.04)' : 'transparent',
                  opacity: excluded ? 0.45 : 1,
                  transition: 'opacity .15s, background .15s',
                }}>
                  {onExcludeChange && (
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <input type="checkbox" checked={!excluded} onChange={() => toggleExclude(row._idx)} style={{ width: 11, height: 11, cursor: 'pointer' }} />
                    </td>
                  )}
                  <td style={{ ...tdStyle, color: '#5f6e87', fontSize: 10 }}>{(page - 1) * PAGE + i + 1}</td>
                  {visibleRawColumns.map(col => (
                    <td key={col} title={String(row[col] ?? '')} style={tdStyle}>
                      {renderCell(String(row[col] ?? ''))}
                    </td>
                  ))}
                  {aiColumns.map(col => {
                    const val = String(row[col.name] ?? '—');
                    const isPlaceholder = isPendingAiValue(val);
                    const isError = isAiError(val);
                    return (
                      <td key={col.name} title={val} style={{ ...tdStyle, background: 'rgba(232,176,75,.02)', minWidth: 170, maxWidth: 300, borderLeft: '1px dashed rgba(232,176,75,.12)' }}>
                        {isPlaceholder ? (
                          <span style={{ ...mono, fontSize: 11, color: '#5f6e87' }}>—</span>
                        ) : (
                          <span style={{
                            ...mono, fontSize: 11, borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap',
                            color: isError ? '#e8736b' : '#e8b04b',
                            background: isError ? 'rgba(232,115,107,.1)' : 'rgba(232,176,75,.1)',
                          }}>
                            {val}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={visibleRawColumns.length + aiColumns.length + (onExcludeChange ? 2 : 1)} style={{ ...mono, padding: '28px', textAlign: 'center', fontSize: 11, color: '#5f6e87' }}>
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
          allVals={uniqueValues[openFilter.col] ?? []}
          filter={colFilters[openFilter.col] ?? { text: '', values: null }}
          anchorRect={openFilter.rect}
          onChange={f => setColFilters(prev => ({ ...prev, [openFilter.col]: f }))}
          onClose={() => setOpenFilter(null)}
        />
      )}
    </div>
  );
}
