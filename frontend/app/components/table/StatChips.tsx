'use client';

import { mono } from '@/app/theme';

/** Auswertungs-Chip über der Tabelle; mit filter wird er zum Ein-Klick-Filter */
export interface StatChip {
  text: string;
  tone: 'gold' | 'teal';
  filter?: { column: string; value: string };
}

interface Props {
  chips: StatChip[];
  isActive: (f: NonNullable<StatChip['filter']>) => boolean;
  onToggle: (f: NonNullable<StatChip['filter']>) => void;
}

/** Chip-Leiste: Fortschritt, Verteilung der Antworten, Lead-Gedächtnis — Klick filtert */
export function StatChips({ chips, isActive, onToggle }: Props) {
  if (chips.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,.05)', background: 'rgba(255,255,255,.015)' }}>
      {chips.map((c, i) => {
        const active = c.filter ? isActive(c.filter) : false;
        const color = c.tone === 'teal' ? '#4fd1c5' : '#e8b04b';
        const rgb   = c.tone === 'teal' ? '79,209,197' : '232,176,75';
        return (
          <button
            key={i}
            onClick={c.filter ? () => onToggle(c.filter!) : undefined}
            title={c.filter ? (active ? 'Filter aufheben' : `Tabelle auf ${c.filter.column} = ${c.filter.value} filtern`) : undefined}
            style={{
              ...mono, fontSize: 10, padding: '3px 10px', borderRadius: 12, letterSpacing: '.03em',
              border: `1px solid rgba(${rgb},${active ? '.7' : '.3'})`,
              background: active ? `rgba(${rgb},.22)` : `rgba(${rgb},.06)`,
              color,
              cursor: c.filter ? 'pointer' : 'default',
            }}
          >{c.text}{active ? ' ×' : ''}</button>
        );
      })}
    </div>
  );
}
