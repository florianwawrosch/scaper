'use client';
import { useEffect } from 'react';

export function ThemeProvider() {
  useEffect(() => {
    try {
      const s = localStorage.getItem('appSettings');
      const theme = s ? JSON.parse(s).theme : undefined;
      if (theme === 'classic') {
        document.documentElement.dataset.theme = 'classic';
      } else {
        delete document.documentElement.dataset.theme;
      }
    } catch {}
  }, []);
  return null;
}
