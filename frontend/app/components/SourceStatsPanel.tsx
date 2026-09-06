'use client';

import { useState } from 'react';
import { T } from '@/app/theme';

export interface SourceStatsRow { src: string; total: number; done: number; yes: number; quote: number }
export interface SourceStats { srcCol: string; audience: { column: string; value: string }; rows: SourceStatsRow[] }

/** ⌗ Zielgruppen-Quote je Quelle (quelle_person / erster_autor) — wie das statistik-Blatt, aufklappbar */
export function SourceStatsPanel({ stats }: { stats: SourceStats }) {
  const [open, setOpen] = useState(false);
  const head: React.CSSProperties = { fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: T.inkF };
  const cell: React.CSSProperties = { fontFamily: T.ffMono, fontSize: 11, color: T.inkF, textAlign: 'right' };
  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ fontFamily: T.ffMono, fontSize: 10, padding: '4px 12px', borderRadius: 12, border: `1px solid ${T.lineS}`, background: open ? 'rgba(255,255,255,.06)' : 'transparent', color: T.inkD, cursor: 'pointer', letterSpacing: '.03em' }}
      >⌗ Statistik nach {stats.srcCol} ({stats.rows.length}) {open ? '▴' : '▾'}</button>
      {open && (
        <div style={{ marginTop: 8, border: `1px solid ${T.lineS}`, borderRadius: 8, overflow: 'hidden', maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 80px 90px', padding: '6px 12px', background: 'rgba(255,255,255,.03)', borderBottom: `1px solid ${T.lineS}` }}>
            {[stats.srcCol, 'Zeilen', 'Klassifiziert', stats.audience.value, 'Quote'].map((h, i) => (
              <span key={h} style={{ ...head, textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          {stats.rows.map(r => (
            <div key={r.src} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 80px 90px', padding: '5px 12px', borderBottom: `1px solid ${T.lineS}` }}>
              <span style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.src}</span>
              <span style={cell}>{r.total}</span>
              <span style={cell}>{r.done}</span>
              <span style={{ ...cell, color: '#4fd1c5' }}>{r.yes}</span>
              <span style={{ ...cell, color: r.quote >= 0.25 ? '#e8b04b' : T.inkF, fontWeight: r.quote >= 0.25 ? 600 : 400 }}>
                {r.done > 0 ? `${Math.round(r.quote * 100)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
