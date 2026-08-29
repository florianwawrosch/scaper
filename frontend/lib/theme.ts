import type React from 'react';

// Shared design tokens — CSS variables defined in globals.css
export const T = {
  bg:     'var(--th-bg)',
  panel:  'var(--th-panel)',
  panel2: 'var(--th-panel2)',
  line:   'var(--th-line)',
  lineS:  'var(--th-line-soft)',
  gold:   'var(--th-gold)',
  goldD:  'var(--th-gold-d)',
  ink:    'var(--th-ink)',
  inkD:   'var(--th-ink-d)',
  inkF:   'var(--th-ink-f)',
  teal:   'var(--th-teal)',
  mono:   'var(--ff-mono)',
  body:   'var(--ff-body)',
  disp:   'var(--ff-disp)',
} as const;

// Status/accent colors used across tables, badges, banners
export const C = {
  good: '#4fd1c5',
  warn: '#e8b04b',
  bad:  '#e8736b',
} as const;

export const mono: React.CSSProperties = { fontFamily: "'Spline Sans Mono', monospace" };
