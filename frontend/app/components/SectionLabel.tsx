import { T } from '@/app/theme';

/** Kleine Überschrift über einem Feld oder Block: Monospace, Versalien, gesperrt */
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5, ...style }}>
      {children}
    </p>
  );
}
