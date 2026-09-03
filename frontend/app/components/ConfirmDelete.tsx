'use client';

import { useState, useRef, useEffect } from 'react';
import { mono } from '@/app/theme';

interface Props {
  onConfirm: () => void;
  /** Accessible/hover label for the initial × button */
  title?: string;
  /** Text shown next to the Ja/Nein choice when armed */
  question?: string;
  /** Extra style for the outer wrapper */
  style?: React.CSSProperties;
  /** Sichtbarer Text statt des kleinen × (z.B. «Spalte löschen») */
  label?: string;
  /** Test-Hook für den auslösenden Button */
  testId?: string;
}

/**
 * Two-step delete with an explicit Ja/Nein choice.
 * Click × → shows "Löschen? [Ja] [Nein]"; Ja confirms, Nein (or 4s idle,
 * or an outside click) cancels. Self-contained state so it can be dropped
 * anywhere without lifting state up.
 */
export function ConfirmDelete({ onConfirm, title = 'Löschen', question = 'Löschen?', style, label, testId }: Props) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const disarm = () => { setArmed(false); if (timer.current) clearTimeout(timer.current); };
  const arm = () => {
    setArmed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), 4000);
  };

  useEffect(() => {
    if (!armed) return;
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) disarm(); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [armed]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!armed) {
    return (
      <div ref={wrap} style={style}>
        <button
          onClick={e => { e.stopPropagation(); arm(); }}
          title={title}
          data-testid={testId}
          style={label
            ? { ...mono, fontSize: 10, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(232,115,107,.3)', background: 'transparent', color: '#e8736b', whiteSpace: 'nowrap', opacity: .85 }
            : { ...mono, fontSize: 13, color: '#5f6e87', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px', opacity: .6 }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = label ? '.85' : '.6')}
        >{label ? `🗑 ${label}` : '×'}</button>
      </div>
    );
  }

  return (
    <div ref={wrap} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <span style={{ ...mono, fontSize: 10, color: '#e8736b', whiteSpace: 'nowrap' }}>{question}</span>
      <button
        onClick={e => { e.stopPropagation(); disarm(); onConfirm(); }}
        style={{ ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(232,115,107,.5)', background: 'rgba(232,115,107,.15)', color: '#e8736b', whiteSpace: 'nowrap' }}
      >Ja</button>
      <button
        onClick={e => { e.stopPropagation(); disarm(); }}
        style={{ ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#9aa7bd', whiteSpace: 'nowrap' }}
      >Nein</button>
    </div>
  );
}
