'use client';

import { useState } from 'react';
import { Glyph } from '../Glyph';
import { mono } from '@/app/theme';

interface Props {
  columns: string[];
  hidden: Set<string>;
  onChange: (next: Set<string>) => void;
}

/** «⊞ Spalten»: Rohspalten ein-/ausblenden (KI-Spalten bleiben immer sichtbar) */
export function ColumnMenu({ columns, hidden, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const visibleCount = columns.length - hidden.size;
  const any = hidden.size > 0;
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Spalten ein-/ausblenden"
        style={{
          ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
          border: any ? '1px solid rgba(232,176,75,.4)' : '1px solid rgba(255,255,255,.12)',
          background: any ? 'rgba(232,176,75,.08)' : 'transparent',
          color: any ? '#e8b04b' : '#9aa7bd',
        }}
      ><Glyph>⊞</Glyph>Spalten{any ? ` (${visibleCount}/${columns.length})` : ''}</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 9999, width: 200,
            maxHeight: 320, overflowY: 'auto', background: '#10111a',
            border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,.5)',
          }}>
            <div style={{ padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#5f6e87' }}>Spalten</span>
              {any && (
                <button onClick={() => onChange(new Set())} style={{ ...mono, fontSize: 10, color: '#4fd1c5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Alle zeigen</button>
              )}
            </div>
            {columns.map(col => {
              const visible = !hidden.has(col);
              return (
                <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <input type="checkbox" checked={visible}
                    onChange={() => { const next = new Set(hidden); if (next.has(col)) next.delete(col); else next.add(col); onChange(next); }}
                    style={{ width: 12, height: 12, cursor: 'pointer', accentColor: '#4fd1c5', flexShrink: 0 }} />
                  <span style={{ ...mono, fontSize: 11, color: visible ? '#c4cdd8' : '#5f6e87', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
