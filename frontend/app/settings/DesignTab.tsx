'use client';

import { useState, useEffect } from 'react';
import { loadSettings, saveSettings, type AppSettings } from '@/lib/settings';
import { T } from '@/app/theme';

type Theme = NonNullable<AppSettings['theme']>;

/** Einstellungen → Design: Farbschema (noir/classic), lokal gespeichert */
export function DesignTab() {
  const [theme, setTheme] = useState<Theme>('noir');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(loadSettings().theme ?? 'noir');
  }, []);

  const applyTheme = (t: Theme) => {
    setTheme(t);
    if (t === 'classic') document.documentElement.setAttribute('data-theme', 'classic');
    else document.documentElement.removeAttribute('data-theme');
    saveSettings({ ...loadSettings(), theme: t });
  };

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
          App <em style={{ color: T.gold }}>Design</em>
        </h1>
        <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, marginTop: 4 }}>
          Farbschema der App. Wird lokal gespeichert.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {(['noir', 'classic'] as const).map(t => (
          <button key={t} type="button" onClick={() => applyTheme(t)} style={{
            fontFamily: T.mono, fontSize: 12, padding: '8px 20px', borderRadius: 6,
            border: `1px solid ${theme === t ? T.gold : T.lineS}`,
            background: theme === t ? T.goldD : 'transparent',
            color: theme === t ? T.gold : T.inkF,
            cursor: 'pointer', textTransform: 'capitalize', transition: 'all .12s',
            fontWeight: theme === t ? 600 : 400,
          }}>{t}</button>
        ))}
      </div>
    </>
  );
}
