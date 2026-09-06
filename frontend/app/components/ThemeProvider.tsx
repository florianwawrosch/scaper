'use client';
import { useEffect } from 'react';
import { loadSettings } from '@/lib/settings';

export function ThemeProvider() {
  useEffect(() => {
    try {
      // loadSettings räumt dabei Keys weg, die ältere Versionen im Browser abgelegt haben
      const theme = loadSettings().theme;
      if (theme === 'classic') {
        document.documentElement.dataset.theme = 'classic';
      } else {
        delete document.documentElement.dataset.theme;
      }
    } catch {}
  }, []);
  return null;
}
