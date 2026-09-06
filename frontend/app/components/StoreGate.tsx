'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { hydrate, isHydrated, subscribeStore, getStoreStatus, getStoreError, CONFLICT_EVENT, type StoreStatus, type ConflictDetail } from '@/lib/store';
import { useToast } from './Toast';
import { mono } from '@/app/theme';

/** Lesbarer Name eines geteilten Keys für den Konflikt-Hinweis */
function keyLabel(key: string): string {
  if (key.startsWith('csv_text_') || key.startsWith('csv_run_')) return 'Datensatz';
  if (key.startsWith('analysis_configs_')) return 'KI-Spalten des Datensatzes';
  if (key.startsWith('analysis_hashes_')) return 'KI-Cache';
  return { user_presets: 'gespeicherte KI-Spalten', blocklist: 'Blockliste', presets: 'gespeicherte Suchen', preset_flags: 'KI-Spalten-Schalter', usage_log: 'Verbrauchsprotokoll', trash_items: 'Papierkorb' }[key] ?? key;
}

/**
 * Lädt beim ersten Aufruf die Daten vom Server in den Browser-Cache, bevor
 * Seiten rendern — sonst sähe man kurz einen alten Stand. Danach: erneut beim
 * Zurückkehren in den Tab und alle 5 Minuten.
 */
export function StoreGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { showToast } = useToast();
  const [ready, setReady] = useState(() => isHydrated());

  // Gleichzeitige Änderung eines Kollegen: sagen, was passiert ist — nichts geht still verloren
  useEffect(() => {
    const onConflict = (e: Event) => {
      const { key, merged } = (e as CustomEvent<ConflictDetail>).detail;
      showToast(merged
        ? `Ein Kollege hat gleichzeitig geändert: ${keyLabel(key)} — beide Änderungen zusammengeführt`
        : `Ein Kollege hat inzwischen geändert: ${keyLabel(key)} — Serverstand übernommen, eigene Änderung bitte prüfen`, merged ? 'info' : 'warning', 8000);
    };
    window.addEventListener(CONFLICT_EVENT, onConflict);
    return () => window.removeEventListener(CONFLICT_EVENT, onConflict);
  }, [showToast]);

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
