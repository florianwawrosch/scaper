'use client';

import { useState, useRef, useEffect } from 'react';

const ALL_COUNTRIES = [
  { code: 'ALL', name: 'Alle Länder' },
  { code: 'DE', name: 'Deutschland' },
  { code: 'AT', name: 'Österreich' },
  { code: 'CH', name: 'Schweiz' },
  { code: 'FR', name: 'Frankreich' },
  { code: 'IT', name: 'Italien' },
  { code: 'ES', name: 'Spanien' },
  { code: 'NL', name: 'Niederlande' },
  { code: 'BE', name: 'Belgien' },
  { code: 'PL', name: 'Polen' },
  { code: 'SE', name: 'Schweden' },
  { code: 'NO', name: 'Norwegen' },
  { code: 'DK', name: 'Dänemark' },
  { code: 'FI', name: 'Finnland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'CZ', name: 'Tschechien' },
  { code: 'SK', name: 'Slowakei' },
  { code: 'HU', name: 'Ungarn' },
  { code: 'RO', name: 'Rumänien' },
  { code: 'HR', name: 'Kroatien' },
  { code: 'GR', name: 'Griechenland' },
  { code: 'TR', name: 'Türkei' },
  { code: 'GB', name: 'Großbritannien' },
  { code: 'IE', name: 'Irland' },
  { code: 'US', name: 'USA' },
  { code: 'CA', name: 'Kanada' },
  { code: 'AU', name: 'Australien' },
  { code: 'NZ', name: 'Neuseeland' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'Südkorea' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'Indien' },
  { code: 'BR', name: 'Brasilien' },
  { code: 'MX', name: 'Mexiko' },
  { code: 'AR', name: 'Argentinien' },
  { code: 'ZA', name: 'Südafrika' },
  { code: 'AE', name: 'Vereinigte Arab. Emirate' },
  { code: 'SA', name: 'Saudi-Arabien' },
  { code: 'SG', name: 'Singapur' },
  { code: 'LU', name: 'Luxemburg' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'IS', name: 'Island' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'RU', name: 'Russland' },
  { code: 'RS', name: 'Serbien' },
  { code: 'BG', name: 'Bulgarien' },
  { code: 'EE', name: 'Estland' },
  { code: 'LV', name: 'Lettland' },
  { code: 'LT', name: 'Litauen' },
  { code: 'SI', name: 'Slowenien' },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function CountrySelect({ value, onChange }: Props) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = ALL_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const selected = ALL_COUNTRIES.find(c => c.code === value);
  const label = selected ? (value === 'ALL' ? 'Alle Länder' : `${value} – ${selected.name}`) : value;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 5,
          background: 'var(--th-panel)', border: `1px solid ${open ? 'var(--th-gold)' : 'var(--th-line)'}`,
          fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--th-ink)',
          cursor: 'pointer', transition: 'border-color .12s', whiteSpace: 'nowrap',
          boxShadow: open ? '0 0 0 2px var(--th-gold-d)' : 'none',
        }}
      >
        <span>{label}</span>
        <span style={{ color: 'var(--th-ink-f)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
          background: 'var(--th-panel)', border: '1px solid var(--th-line)',
          borderRadius: 7, boxShadow: '0 8px 24px rgba(0,0,0,.35)',
          width: 240, overflow: 'hidden',
        }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--th-line-soft)' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Suchen…"
              style={{
                width: '100%', background: 'var(--th-panel2)', border: 'none', outline: 'none',
                fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--th-ink)',
                padding: '4px 7px', borderRadius: 4,
              }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', padding: '4px 0' }}>
            {filtered.map(c => {
              const active = value === c.code;
              const isAll  = c.code === 'ALL';
              return (
                <button
                  key={c.code}
                  onClick={() => { onChange(c.code); setOpen(false); setSearch(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    padding: isAll ? '7px 12px 7px 12px' : '5px 12px',
                    background: active ? 'var(--th-gold-d)' : 'transparent',
                    border: 'none', cursor: 'pointer', transition: 'background .1s',
                    borderBottom: isAll ? '1px solid var(--th-line-soft)' : 'none',
                  }}
                >
                  {active && <span style={{ color: 'var(--th-gold)', fontSize: 10, flexShrink: 0 }}>●</span>}
                  {!active && <span style={{ color: 'var(--th-ink-f)', fontSize: 10, flexShrink: 0 }}>○</span>}
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: active ? 'var(--th-gold)' : 'var(--th-ink-d)' }}>
                    {isAll ? (
                      <strong style={{ color: active ? 'var(--th-gold)' : 'var(--th-ink)' }}>Alle Länder</strong>
                    ) : (
                      <><strong style={{ color: active ? 'var(--th-gold)' : 'var(--th-ink)' }}>{c.code}</strong>{' '}{c.name}</>
                    )}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p style={{ padding: '8px 10px', fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--th-ink-f)' }}>
                Kein Treffer
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
