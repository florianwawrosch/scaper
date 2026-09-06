'use client';

import { useState, useRef, useEffect } from 'react';
import { isPendingAiValue, isAiError } from '@/lib/ai';
import { Glyph } from './Glyph';
import { FilterDropdown } from './FilterDropdown';
import { useTableState } from '@/app/hooks/useTableState';
import { downloadCsv, downloadXlsx } from '@/lib/tableExport';
import { mono } from '@/app/theme';
import { StatChips, type StatChip } from './table/StatChips';
import { ColumnMenu } from './table/ColumnMenu';
import { TablePagination } from './table/TablePagination';
import { CellValue } from './table/CellValue';
import { toolbarBtn, filterBtn } from './table/styles';

export type { StatChip };

interface AiColumn {
  name: string;
  values: string[];
  label?: string;
  /** In der Tabelle ausblenden — bleibt in Suche, Filter und Export enthalten */
  hidden?: boolean;
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
  transform: (rows: Record<string, unknown>[]) => { filename: string; columns: string[]; rows: Record<string, string>[]; exportedIdx?: number[] } | null;
  /** Nach dem Download: Original-Indizes der exportierten Zeilen (z.B. zum Markieren) */
  afterExport?: (exportedIdx: number[]) => void;
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
  /** ⚙ in an AI column header: open the configuration for that column */
  onConfigureAiColumn?: (name: string) => void;
  /** ▶ in an AI column header: run the analysis for that column */
  onRunAiColumn?: (name: string) => void;
  /** Toolbar action: add the pages of the DESELECTED rows to the Blockliste */
  onBlockPages?: (rows: Record<string, unknown>[]) => void;
  /** Weitere Export-Buttons neben ↓ CSV / ↓ XLSX (z.B. Outreach-CSV) */
  exportPresets?: ExportPreset[];
  /** Zusätzliche Toolbar-Elemente vor den Export-Buttons (Abgleich, «+ KI-Spalte»-Menü) */
  toolbarExtra?: React.ReactNode;
}


export function DataTable({
  data, rawColumns, aiColumns = [], excludedRows = new Set(), onExcludeChange,
  stats, scrollSignal = 0, onConfigureAiColumn, onRunAiColumn, onBlockPages,
  exportPresets = [], toolbarExtra,
}: DataTableProps) {
  const {
    globalSearch, setGlobalSearch, colFilters, setColFilters, activeFilters,
    sortCol, sortAsc, sort, page, setPage, totalPages, pageStart, hiddenCols, setHiddenCols,
    pageSize, setPageSize, viewMode, setViewMode,
    allColumns, visibleRawColumns, extended, uniqueValues, sorted, paginated,
    chipFilterActive, toggleChipFilter,
  } = useTableState(data, rawColumns, aiColumns);
  // Angezeigte KI-Spalten; ausgeblendete (z.B. Einzelspalten einer Multi-Output-Antwort)
  // stecken weiterhin in extended/allColumns und damit in Suche und Export
  const shownAi = aiColumns.filter(c => !c.hidden);
  const [openFilter, setOpenFilter] = useState<{ col: string; rect: DOMRect } | null>(null);

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
    if (!out) return;
    downloadCsv(out.filename, out.columns, out.rows);
    if (out.exportedIdx?.length) p.afterExport?.(out.exportedIdx);
  };

  const exportXlsx = () =>
    downloadXlsx(`export_${new Date().toISOString().slice(0, 10)}.xlsx`, allColumns, exportRows());

  const thStyle: React.CSSProperties = {
    ...mono, fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase',
    padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(255,255,255,.07)', color: '#9aa7bd',
    userSelect: 'none',
  };
  const expanded = viewMode === 'expanded';
  // Kompakt: eine Zeile pro Datensatz, lange Texte abgeschnitten (Tooltip zeigt alles).
  // Erweitert: Zellen brechen um, der ganze Werbetext ist lesbar.
  const tdStyle: React.CSSProperties = {
    ...mono, fontSize: 11, padding: expanded ? '7px 8px' : '5px 8px',
    borderBottom: '1px solid rgba(255,255,255,.04)', color: '#9aa7bd', verticalAlign: 'top',
    ...(expanded
      ? { maxWidth: 440, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }
      : { maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  };

  const includedCount = data.length - excludedRows.size;

  const openFilterFor = (col: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setOpenFilter(prev => prev?.col === col ? null : { col, rect });
  };

  return (
    <div style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden', fontSize: 11 }}>

      {stats && <StatChips chips={stats} isActive={chipFilterActive} onToggle={toggleChipFilter} />}

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
          <button onClick={() => setColFilters({})} style={toolbarBtn('rose')}>{activeFilters} Filter ×</button>
        )}
        {onBlockPages && excludedRows.size > 0 && (() => {
          const deselected = extended.filter(r => excludedRows.has(r._idx));
          const pageCount = new Set(deselected.map(r => String(r.page_name ?? '').trim()).filter(Boolean)).size;
          return (
            <button
              onClick={() => onBlockPages(deselected)}
              disabled={pageCount === 0}
              title="Die Seitennamen der abgewählten Zeilen dauerhaft zur Blockliste hinzufügen — künftige Scrapes schließen sie aus"
              style={toolbarBtn('rose', { disabled: pageCount === 0 })}
            ><Glyph>🚫</Glyph>{pageCount} {pageCount === 1 ? 'Seite' : 'Seiten'} blocken</button>
          );
        })()}
        <span style={{ ...mono, fontSize: 10, color: '#5f6e87', marginLeft: 'auto' }}>
          {sorted.length}/{data.length} sichtbar
          {excludedRows.size > 0 && ` · ${includedCount} ausgewählt`}
        </span>

        {/* Kompakt / Erweitert */}
        <button
          onClick={() => setViewMode(expanded ? 'compact' : 'expanded')}
          title={expanded ? 'Kompakt: eine Zeile pro Datensatz' : 'Erweitert: lange Texte (z.B. Werbetext) komplett anzeigen'}
          data-testid="view-toggle"
          style={toolbarBtn('plain', { active: expanded })}
        ><Glyph>{expanded ? '☰' : '≡'}</Glyph>{expanded ? 'Erweitert' : 'Kompakt'}</button>

        <ColumnMenu columns={rawColumns} hidden={hiddenCols} onChange={setHiddenCols} />

        {toolbarExtra}
        <button
          onClick={exportCsv}
          disabled={sorted.length === 0}
          title="Als CSV exportieren"
          style={toolbarBtn('teal', { disabled: sorted.length === 0 })}
        ><Glyph>↓</Glyph>CSV</button>
        <button
          onClick={exportXlsx}
          disabled={sorted.length === 0}
          title="Als Excel exportieren"
          style={toolbarBtn('teal', { disabled: sorted.length === 0 })}
        ><Glyph>↓</Glyph>XLSX</button>
        {exportPresets.map(p => (
          <button
            key={p.label}
            onClick={() => exportPreset(p)}
            disabled={sorted.length === 0}
            title={p.title}
            style={toolbarBtn('gold', { disabled: sorted.length === 0 })}
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
                      <button onClick={e => openFilterFor(col, e)} title="Filter" style={filterBtn(!!hasFilter)}>▼</button>
                    </div>
                  </th>
                );
              })}
              {/* AI columns at the end, in creation order */}
              {shownAi.map(col => {
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
                      <button onClick={e => openFilterFor(col.name, e)} title="Filter" style={filterBtn(!!hasFilter)}>▼</button>
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
                  <td style={{ ...tdStyle, color: '#5f6e87', fontSize: 10, whiteSpace: 'nowrap' }}>{pageStart + i + 1}</td>
                  {visibleRawColumns.map(col => (
                    <td key={col} title={String(row[col] ?? '')} style={tdStyle}>
                      <CellValue value={String(row[col] ?? '')} />
                    </td>
                  ))}
                  {shownAi.map(col => {
                    const val = String(row[col.name] ?? '—');
                    const isPlaceholder = isPendingAiValue(val);
                    const isError = isAiError(val);
                    return (
                      <td key={col.name} title={val} style={{ ...tdStyle, background: 'rgba(232,176,75,.02)', minWidth: 170, maxWidth: 300, borderLeft: '1px dashed rgba(232,176,75,.12)' }}>
                        {isPlaceholder ? (
                          <span style={{ ...mono, fontSize: 11, color: '#5f6e87' }}>—</span>
                        ) : (
                          <span style={{
                            ...mono, fontSize: 11, borderRadius: 4, padding: '1px 6px', whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
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
                <td colSpan={visibleRawColumns.length + shownAi.length + (onExcludeChange ? 2 : 1)} style={{ ...mono, padding: '28px', textAlign: 'center', fontSize: 11, color: '#5f6e87' }}>
                  Keine Daten
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page} totalPages={totalPages} pageStart={pageStart} pageCount={paginated.length} total={sorted.length}
        pageSize={pageSize} onPage={setPage} onPageSize={setPageSize}
      />

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
