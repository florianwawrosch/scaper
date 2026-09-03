'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { T } from '@/app/theme';

/**
 * Fehlergrenze für alle Seiten: statt Next' leerem «Application error» ein
 * lesbarer Hinweis mit Neu-laden. Daten liegen im Browser-Speicher und sind
 * von einem Render-Fehler nicht betroffen.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%', background: T.panel, border: '1px solid rgba(232,115,107,.35)', borderRadius: 12, padding: '22px 24px' }}>
        <p style={{ fontFamily: T.ffMono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#e8736b', marginBottom: 8 }}>Fehler</p>
        <h1 style={{ fontFamily: T.ffDisp, fontSize: 20, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Die Seite konnte nicht angezeigt werden.</h1>
        <p style={{ fontFamily: T.ffBody, fontSize: 13, color: T.inkD, lineHeight: 1.6, marginBottom: 6 }}>
          Deine Datensätze und Einstellungen sind davon nicht betroffen — sie liegen im Browser-Speicher.
        </p>
        <pre style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF, background: 'rgba(0,0,0,.25)', borderRadius: 6, padding: '8px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 14, maxHeight: 120, overflow: 'auto' }}>
          {error.message || 'Unbekannter Fehler'}{error.digest ? `\n(${error.digest})` : ''}
        </pre>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={reset} style={{ fontFamily: T.ffMono, fontSize: 12, padding: '7px 16px', borderRadius: 6, background: T.gold, border: 'none', color: '#07070a', fontWeight: 600, cursor: 'pointer' }}>Erneut versuchen</button>
          <Link href="/" style={{ fontFamily: T.ffMono, fontSize: 12, padding: '7px 16px', borderRadius: 6, border: `1px solid ${T.lineS}`, color: T.inkD, textDecoration: 'none' }}>Zur Startseite</Link>
        </div>
      </div>
    </div>
  );
}
