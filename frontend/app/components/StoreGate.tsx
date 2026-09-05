'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { hydrate, isHydrated, subscribeStore, getStoreStatus, getStoreError, type StoreStatus } from '@/lib/store';
import { mono } from '@/app/theme';

/**
 * Lädt beim ersten Aufruf die Daten vom Server in den Browser-Cache, bevor
 * Seiten rendern — sonst sähe man kurz einen alten Stand. Danach: erneut beim
 * Zurückkehren in den Tab und alle 5 Minuten.
 */
export function StoreGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(() => isHydrated());

  useEffect(() => {
    if (pathname === '/login' || isHydrated()) return;
    let cancelled = false;
    const fallback = setTimeout(() => { if (!cancelled) setReady(true); }, 8000);
    hydrate().finally(() => { if (!cancelled) setReady(true); clearTimeout(fallback); });
    return () => { cancelled = true; clearTimeout(fallback); };
  }, [pathname]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && isHydrated()) void hydrate(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && isHydrated()) void hydrate(); }, 300000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(timer); };
  }, []);

  if (!ready && pathname !== '/login') {
    return (
      <>
        <StoreBanner />
      <div data-testid="store-loading" style={{ ...mono, fontSize: 11, color: '#5f6e87', padding: '48px 32px', textAlign: 'center' }}>
        Lade…
      </div>
      </>
    );
  }
  return <><StoreBanner />{children}</>;
}

/** Zustand der Server-Speicherung (nur für Hinweisleiste und Einstellungen → Daten) */
export function useStoreStatus(): { status: StoreStatus; error: string } {
  const [status, setStatus] = useState<StoreStatus>(() => getStoreStatus());
  useEffect(() => subscribeStore(setStatus), []);
  return { status, error: getStoreError() };
}

/**
 * Hinweisleiste — erscheint NUR, wenn etwas nicht stimmt: keine Datenbank
 * verbunden (Daten bleiben in diesem Browser) oder Server nicht erreichbar.
 * Im Normalbetrieb ist nichts zu sehen.
 */
export function StoreBanner() {
  const { status, error } = useStoreStatus();
  if (status !== 'local' && status !== 'error') return null;
  const local = status === 'local';
  return (
    <div data-testid="store-banner" data-status={status} style={{ ...mono, fontSize: 11, padding: '6px 32px', textAlign: 'center', color: local ? '#e8b04b' : '#e8736b', background: local ? 'rgba(232,176,75,.08)' : 'rgba(232,115,107,.08)', borderBottom: `1px solid ${local ? 'rgba(232,176,75,.25)' : 'rgba(232,115,107,.25)'}` }}>
      {local
        ? 'Keine Datenbank verbunden — Daten werden nur in diesem Browser gespeichert, Kollegen sehen sie nicht. Einrichtung: Einstellungen → Daten.'
        : `Speichern auf dem Server fehlgeschlagen${error ? ` (${error})` : ''} — wird automatisch erneut versucht.`}
    </div>
  );
}
