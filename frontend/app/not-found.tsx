import Link from 'next/link';
import { T } from '@/app/theme';

export default function NotFound() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: T.ffMono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 8 }}>404</p>
        <h1 style={{ fontFamily: T.ffDisp, fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Seite nicht gefunden</h1>
        <p style={{ fontFamily: T.ffBody, fontSize: 13, color: T.inkD, marginBottom: 16 }}>Datensätze findest du unter «Verlauf», neue Importe auf der Startseite.</p>
        <Link href="/" style={{ fontFamily: T.ffMono, fontSize: 12, padding: '7px 16px', borderRadius: 6, background: T.gold, color: '#07070a', fontWeight: 600, textDecoration: 'none' }}>Zur Startseite</Link>
      </div>
    </div>
  );
}
