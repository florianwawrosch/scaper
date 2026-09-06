'use client';

import { linkTarget } from '@/lib/tableQuery';

/** Spalten, deren Zahlen Mengen sind (Tausenderpunkte) — nie IDs, Telefonnummern, PLZ */
const MEASURE_COLUMN = /reach|count|anzahl|spend|budget|impression|follower|likes|views|zeilen|rows|preis|price|umsatz|revenue|mitarbeiter|employees/i;

/**
 * Zellinhalt: URLs und nackte Domains werden klickbar, Mengen-Spalten (reach,
 * ads_count, …) bekommen Tausenderpunkte, leer wird «—».
 */
export function CellValue({ value, column }: { value: string; column: string }) {
  const href = linkTarget(value);
  if (!href && MEASURE_COLUMN.test(column) && /^\d{4,}$/.test(value.trim())) return <>{Number(value).toLocaleString('de-DE')}</>;
  if (!href) return <>{value || '—'}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      style={{ color: '#8ab4f8', textDecoration: 'none' }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
    >{value.trim()}</a>
  );
}
