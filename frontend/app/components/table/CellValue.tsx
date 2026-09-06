'use client';

import { linkTarget } from '@/lib/tableQuery';

/**
 * Zellinhalt: URLs und nackte Domains werden klickbar, reine ganze Zahlen ab
 * vier Stellen (reach, spend) bekommen Tausenderpunkte, leer wird «—».
 */
export function CellValue({ value }: { value: string }) {
  const href = linkTarget(value);
  if (!href && /^\d{4,}$/.test(value.trim())) return <>{Number(value).toLocaleString('de-DE')}</>;
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
