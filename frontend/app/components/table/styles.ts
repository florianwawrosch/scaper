import { mono } from '@/app/theme';

export type Tone = 'teal' | 'gold' | 'rose' | 'plain';
const RGB: Record<Exclude<Tone, 'plain'>, string> = { teal: '79,209,197', gold: '232,176,75', rose: '232,115,107' };
const COLOR: Record<Exclude<Tone, 'plain'>, string> = { teal: '#4fd1c5', gold: '#e8b04b', rose: '#e8736b' };

/** Kleiner Toolbar-Button der Tabelle — eine Farbfamilie, optional aktiv/deaktiviert */
export function toolbarBtn(tone: Tone, opts: { active?: boolean; disabled?: boolean } = {}): React.CSSProperties {
  const base: React.CSSProperties = { ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, cursor: opts.disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: opts.disabled ? 0.4 : 1 };
  if (tone === 'plain') {
    return { ...base, border: '1px solid rgba(255,255,255,.08)', background: opts.active ? 'rgba(255,255,255,.08)' : 'transparent', color: '#9aa7bd' };
  }
  const rgb = RGB[tone];
  return { ...base, border: `1px solid rgba(${rgb},${opts.active ? '.4' : '.3'})`, background: `rgba(${rgb},${opts.active ? '.12' : '.06'})`, color: COLOR[tone] };
}

/** ▼-Filterknopf im Spaltenkopf */
export const filterBtn = (active: boolean): React.CSSProperties => ({
  ...mono, fontSize: 9, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', lineHeight: 1,
  background: active ? 'rgba(79,209,197,.2)' : 'rgba(255,255,255,.06)',
  border: active ? '1px solid rgba(79,209,197,.4)' : '1px solid rgba(255,255,255,.1)',
  color: active ? '#4fd1c5' : '#5f6e87',
});
