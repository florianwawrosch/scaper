'use client';

import { useState, useRef, useEffect } from 'react';
import { mono } from '@/app/theme';

/** Filterzustand einer Spalte: Textsuche + Werte-Auswahl (null = alle) */
export interface ColFilter { text: string; values: Set<string> | null }

/** Excel-artiges Filter-Popover unter einem Spaltenkopf (Text + Werte-Checkboxen) */
export function FilterDropdown({
  allVals, filter, onClose, onChange,
  anchorRect,
}: {
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
