/**
 * Design-Tokens für Inline-Styles: CSS-Variablen aus globals.css (Noir/Classic
 * wechseln per data-theme). Kurz- und Langnamen für die Schriften, damit alle
 * Seiten dieselbe Quelle nutzen.
 */
export const T = {
  bg:     'var(--th-bg)',
  panel:  'var(--th-panel)',
  panel2: 'var(--th-panel2)',
  line:   'var(--th-line)',
  lineS:  'var(--th-line-soft)',
  gold:   'var(--th-gold)',
  goldD:  'var(--th-gold-d)',
  goldB:  'var(--th-gold-b)',
  teal:   'var(--th-teal)',
  tealD:  'rgba(79,209,197,.08)',
  tealB:  'rgba(79,209,197,.2)',
  rose:   'var(--th-rose)',
  ink:    'var(--th-ink)',
  inkD:   'var(--th-ink-d)',
  inkF:   'var(--th-ink-f)',
  ffMono: 'var(--ff-mono)',
  ffBody: 'var(--ff-body)',
  ffDisp: 'var(--ff-disp)',
  mono:   'var(--ff-mono)',
  body:   'var(--ff-body)',
  disp:   'var(--ff-disp)',
} as const;

/** Monospace-Style für kleine UI-Labels/Buttons in Komponenten */
export const mono: React.CSSProperties = { fontFamily: "'Spline Sans Mono', monospace" };
