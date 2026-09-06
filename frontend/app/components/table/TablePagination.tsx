'use client';

import { pageNumbers } from '@/lib/tableQuery';
import { PAGE_SIZES } from '@/app/hooks/useTableState';
import { mono } from '@/app/theme';

interface Props {
  page: number;
  totalPages: number;
  /** Erste angezeigte Zeile (0-basiert) und Anzahl auf dieser Seite */
  pageStart: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}

const navBtn = (off: boolean): React.CSSProperties => ({
  ...mono, fontSize: 11, padding: '2px 7px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 4, background: 'none', color: '#9aa7bd',
  cursor: off ? 'default' : 'pointer', opacity: off ? .35 : 1,
});

/** Fußzeile: Info links, Seitenzahlen in der Mitte, «Zeilen pro Seite» ganz am Ende — immer sichtbar */
export function TablePagination({ page, totalPages, pageStart, pageCount, total, pageSize, onPage, onPageSize }: Props) {
  const first = page === 1, last = page >= totalPages;
  return (
    <div data-testid="pagination" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 10px', borderTop: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.02)' }}>
      <span style={{ ...mono, fontSize: 10, color: '#5f6e87', whiteSpace: 'nowrap' }}>
        {total === 0 ? 'Keine Zeilen' : `Seite ${page} / ${totalPages} · ${pageStart + 1}–${Math.min(pageStart + pageCount, total)} von ${total}`}
      </span>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
        <button onClick={() => onPage(1)} disabled={first} title="Erste Seite" style={navBtn(first)}>«</button>
        <button onClick={() => onPage(Math.max(1, page - 1))} disabled={first} title="Vorherige Seite" style={navBtn(first)}>‹</button>
        {pageNumbers(page, totalPages).map((n, i) => n === '…' ? (
          <span key={`gap${i}`} style={{ ...mono, fontSize: 10, color: '#5f6e87', padding: '0 2px' }}>…</span>
        ) : (
          <button
            key={n}
            onClick={() => onPage(n)}
            aria-current={n === page ? 'page' : undefined}
            data-testid={`page-btn-${n}`}
            style={{ ...mono, fontSize: 11, minWidth: 26, padding: '2px 6px', borderRadius: 4, cursor: n === page ? 'default' : 'pointer', border: n === page ? '1px solid rgba(232,176,75,.5)' : '1px solid rgba(255,255,255,.08)', background: n === page ? 'rgba(232,176,75,.14)' : 'none', color: n === page ? '#f5cc77' : '#9aa7bd', fontWeight: n === page ? 700 : 400 }}
          >{n}</button>
        ))}
        <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={last} title="Nächste Seite" style={navBtn(last)}>›</button>
        <button onClick={() => onPage(totalPages)} disabled={last} title="Letzte Seite" style={navBtn(last)}>»</button>
      </div>
      <label style={{ ...mono, fontSize: 10, color: '#5f6e87', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', paddingLeft: 8, borderLeft: '1px solid rgba(255,255,255,.08)' }}>
        Zeilen pro Seite
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          data-testid="page-size"
          style={{ ...mono, fontSize: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 4, color: '#9aa7bd', padding: '2px 6px', outline: 'none', cursor: 'pointer' }}
        >
          {PAGE_SIZES.map(n => <option key={n} value={n}>{n === 0 ? 'Alle' : n}</option>)}
        </select>
      </label>
    </div>
  );
}
