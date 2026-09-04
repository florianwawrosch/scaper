'use client';

import { useState, useMemo } from 'react';
import { filterRows, sortRows, uniqueValuesByColumn, countActiveFilters, type ColFilter } from '@/lib/tableQuery';

/** Datenzeile plus Original-Index — hält Abwahl/Export über Filter & Sortierung hinweg stabil */
export type Row = Record<string, unknown> & { _idx: number };

export interface AiColumnValues { name: string; values: string[] }

/** Wählbare Seitengrößen; 0 = alle Zeilen auf einer Seite */
export const PAGE_SIZES = [25, 50, 100, 250, 0] as const;
export type ViewMode = 'compact' | 'expanded';

const LS_PAGE_SIZE = 'table_page_size';
const LS_VIEW      = 'table_view';
const readLs = <T,>(key: string, parse: (v: string) => T | null, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(key); return v === null ? fallback : (parse(v) ?? fallback); } catch { return fallback; }
};

/**
 * Suche, Spaltenfilter, Sortierung, Seitenwahl und ausgeblendete Spalten der
 * DataTable — inklusive der memoisierten Kette extended → filtered → sorted.
 * Neue Array-Identitäten pro Render würden diese Kette bei jedem Tastendruck
 * im Editor invalidieren; die Aufrufer übergeben deshalb memoisierte Props.
 */
export function useTableState(data: Record<string, unknown>[], rawColumns: string[], aiColumns: AiColumnValues[]) {
  const [globalSearch, setGlobalSearchRaw] = useState('');
  const [colFilters,   setColFiltersRaw]   = useState<Record<string, ColFilter>>({});
  const [sortCol,      setSortCol]         = useState<string | null>(null);
  const [sortAsc,      setSortAsc]         = useState(true);
  const [page,         setPage]            = useState(1);
  const [hiddenCols,   setHiddenCols]      = useState<Set<string>>(new Set());
  // Seitengröße und Ansicht merkt sich der Browser (gelten für alle Datensätze)
  const [pageSize,     setPageSizeRaw]     = useState<number>(() => readLs(LS_PAGE_SIZE, v => (PAGE_SIZES as readonly number[]).includes(Number(v)) ? Number(v) : null, 25));
  const [viewMode,     setViewModeRaw]     = useState<ViewMode>(() => readLs(LS_VIEW, v => (v === 'expanded' || v === 'compact' ? v : null), 'compact'));

  const allColumns = useMemo(() => [...rawColumns, ...aiColumns.map(c => c.name)], [rawColumns, aiColumns]);
  // Visible raw columns (AI columns are always shown)
  const visibleRawColumns = useMemo(() => rawColumns.filter(c => !hiddenCols.has(c)), [rawColumns, hiddenCols]);

  const extended = useMemo(() =>
    data.map((row, i) => {
      const r: Row = { ...row, _idx: i };
      for (const col of aiColumns) r[col.name] = col.values[i] ?? '—';
      return r;
    }),
  [data, aiColumns]);

  const uniqueValues = useMemo(() => uniqueValuesByColumn(extended, allColumns), [extended, allColumns]);
  const filtered = useMemo(() => filterRows(extended, allColumns, globalSearch, colFilters), [extended, allColumns, globalSearch, colFilters]);
  const sorted   = useMemo(() => sortRows(filtered, sortCol, sortAsc), [filtered, sortCol, sortAsc]);

  const effectiveSize = pageSize === 0 ? Math.max(1, sorted.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(sorted.length / effectiveSize));
  const pageStart  = (page - 1) * effectiveSize;
  const paginated  = sorted.slice(pageStart, pageStart + effectiveSize);

  const setPageSize = (n: number) => {
    setPageSizeRaw(n); setPage(1);
    try { localStorage.setItem(LS_PAGE_SIZE, String(n)); } catch {}
  };
  const setViewMode = (m: ViewMode) => {
    setViewModeRaw(m);
    try { localStorage.setItem(LS_VIEW, m); } catch {}
  };

  // Jede Änderung an Suche/Filter/Sortierung springt auf Seite 1
  const setGlobalSearch = (v: string) => { setGlobalSearchRaw(v); setPage(1); };
  const setColFilters = (next: Record<string, ColFilter> | ((prev: Record<string, ColFilter>) => Record<string, ColFilter>)) => {
    setColFiltersRaw(next); setPage(1);
  };
  const sort = (col: string) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
    setPage(1);
  };

  // Chip-Klick: Spalte auf genau diesen Wert filtern; erneuter Klick hebt auf
  const chipFilterActive = (f: { column: string; value: string }) => {
    const cf = colFilters[f.column];
    return !!cf?.values && cf.values.size === 1 && cf.values.has(f.value);
  };
  const toggleChipFilter = (f: { column: string; value: string }) => {
    setColFilters(prev => {
      const next = { ...prev };
      if (chipFilterActive(f)) delete next[f.column];
      else next[f.column] = { text: '', values: new Set([f.value]) };
      return next;
    });
  };

  return {
    globalSearch, setGlobalSearch, colFilters, setColFilters, activeFilters: countActiveFilters(colFilters),
    sortCol, sortAsc, sort, page, setPage, totalPages, pageStart, hiddenCols, setHiddenCols,
    pageSize, setPageSize, viewMode, setViewMode,
    allColumns, visibleRawColumns, extended, uniqueValues, sorted, paginated,
    chipFilterActive, toggleChipFilter,
  };
}
