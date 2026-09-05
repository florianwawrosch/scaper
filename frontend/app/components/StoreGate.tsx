'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { hydrate, isHydrated, subscribeStore, getStoreStatus, getStoreError, type StoreStatus } from '@/lib/store';
import { mono } from '@/app/theme';

/**
 * Lädt beim ersten Aufruf den gemeinsamen Speicher (Server) in den lokalen
 * Cache, bevor Seiten rendern — sonst sähe man kurz den alten Stand dieses
 * Geräts. Danach: erneut beim Zurückkehren in den Tab und alle 60 s.
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
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && isHydrated()) void hydrate(); }, 60000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(timer); };
  }, []);

  if (!ready && pathname !== '/login') {
    return (
      <div data-testid="store-loading" style={{ ...mono, fontSize: 11, color: '#5f6e87', padding: '48px 32px', textAlign: 'center' }}>
        Gemeinsame Daten werden geladen…
      </div>
    );
  }
  return <>{children}</>;
}

/** Aktueller Sync-Status (für die Kopfzeile / Einstellungen) */
export function useStoreStatus(): { status: StoreStatus; error: string } {
  const [status, setStatus] = useState<StoreStatus>(() => getStoreStatus());
  useEffect(() => subscribeStore(setStatus), []);
  return { status, error: getStoreError() };
}

const LABEL: Record<StoreStatus, { text: string; color: string; title: string }> = {
  init:    { text: '☁ …',       color: '#5f6e87', title: 'Gemeinsamer Speicher wird geladen' },
  local:   { text: '☁ nur lokal', color: '#e8b04b', title: 'Kein gemeinsamer Speicher konfiguriert — Daten liegen nur in diesem Browser. Einstellungen → Daten zeigt, wie man ihn verbindet.' },
  syncing: { text: '☁ sync…',   color: '#9aa7bd', title: 'Änderungen werden hochgeladen' },
  synced:  { text: '☁ geteilt', color: '#4fd1c5', title: 'Gemeinsamer Speicher verbunden — alle Kollegen sehen denselben Stand' },
  error:   { text: '☁ Fehler',  color: '#e8736b', title: 'Synchronisation fehlgeschlagen — wird automatisch erneut versucht' },
};

/** Kleine Status-Pille für die Kopfzeile */
export function StoreStatusPill() {
  const { status, error } = useStoreStatus();
  const l = LABEL[status];
  return (
    <span data-testid="store-status" data-status={status} title={status === 'error' && error ? `${l.title} (${error})` : l.title}
      style={{ ...mono, fontSize: 10, color: l.color, border: `1px solid ${l.color}33`, borderRadius: 10, padding: '2px 8px', whiteSpace: 'nowrap', marginRight: 8 }}>
      {l.text}
    </span>
  );
}
