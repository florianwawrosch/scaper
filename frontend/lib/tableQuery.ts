/**
 * Reine Tabellen-Logik der DataTable: filtern, sortieren, eindeutige Werte,
 * Link-Erkennung. Kein React — damit sie sich ohne Browser testen lässt.
 */

/** Filterzustand einer Spalte: Textsuche + Werte-Auswahl (null = alle) */
export interface ColFilter { text: string; values: Set<string> | null }

export function filterRows<R extends Record<string, unknown>>(
  rows: R[],
  columns: string[],
  globalSearch: string,
  colFilters: Record<string, ColFilter>,
): R[] {
  const gs = globalSearch.toLowerCase();
  const active = Object.entries(colFilters);
  return rows.filter(row => {
    if (gs && !columns.some(c => String(row[c] ?? '').toLowerCase().includes(gs))) return false;
    for (const [col, f] of active) {
      const cell = String(row[col] ?? '');
      if (f.text && !cell.toLowerCase().includes(f.text.toLowerCase())) return false;
      if (f.values !== null && !f.values.has(cell)) return false;
    }
    return true;
  });
}

/** Leere Zellen immer ans Ende; "9" < "104" dank numeric; Groß/Klein egal */
export function sortRows<R extends Record<string, unknown>>(rows: R[], sortCol: string | null, asc: boolean): R[] {
  if (!sortCol) return rows;
  return [...rows].sort((a, b) => {
    const av = String(a[sortCol] ?? '').trim();
    const bv = String(b[sortCol] ?? '').trim();
    if (!av && bv) return 1;
    if (av && !bv) return -1;
    if (!av && !bv) return 0;
    const cmp = av.localeCompare(bv, 'de', { numeric: true, sensitivity: 'base' });
    return asc ? cmp : -cmp;
  });
}

/** Sortierte Wertelisten je Spalte für das Filter-Popover */
export function uniqueValuesByColumn<R extends Record<string, unknown>>(rows: R[], columns: string[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const col of columns) {
    const set = new Set(rows.map(row => String(row[col] ?? '')));
    map[col] = [...set].sort((a, b) => a.localeCompare(b, 'de'));
  }
  return map;
}

export function countActiveFilters(colFilters: Record<string, ColFilter>): number {
  return Object.values(colFilters).filter(f => f.text || f.values !== null).length;
}

/**
 * URL oder nackte Domain («app.quiz-akademie.de») → klickbares Ziel, sonst null.
 * Die TLD muss alphabetisch sein, damit Dezimalzahlen, Versionen («16.3.3»)
 * und IPs nicht als Domain durchgehen; E-Mail-Adressen sind keine Links.
 */
export function linkTarget(raw: string): string | null {
  const v = raw.trim();
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  const isDomain = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?$/i.test(v) && !v.includes('@');
  return isDomain ? `https://${v}` : null;
}
