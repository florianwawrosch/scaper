'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { fetchMetaToken } from '@/lib/metaTokenClient';
import { metaTokenLevel, remainingMs, formatRemaining, fmtDate, type MetaTokenStatus } from '@/lib/metaToken';
import { mono } from '@/app/theme';

/**
 * Warnleiste auf jeder Seite: der Meta-Token läuft in weniger als 7 Tagen ab
 * (Countdown in Tagen, Stunden und Minuten) oder ist schon abgelaufen. Bleibt,
 * bis ein neuer Token gesetzt ist. Ohne Meta-Key oder bei langer Restlaufzeit unsichtbar.
 */
export function MetaTokenBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<MetaTokenStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (pathname === '/login') return;
    let alive = true;
    const load = () => fetchMetaToken().then(s => { if (alive) setStatus(s); });
    load();
    // Countdown jede Minute, Status alle 5 Minuten (Client-Cache) neu
    const tick = setInterval(() => { setNow(Date.now()); load(); }, 60_000);
    return () => { alive = false; clearInterval(tick); };
  }, [pathname]);

  if (pathname === '/login') return null;
  const level = metaTokenLevel(status, now);
  if (level !== 'warn' && level !== 'expired') return null;
  const rem = remainingMs(status?.expiresAt ?? null, now);
  const expired = level === 'expired';
  const text = expired
    ? 'Meta-Token ist abgelaufen oder ungültig — Scraping funktioniert nicht mehr.'
    : `Meta-Token läuft ab in ${formatRemaining(rem ?? 0)}${status?.expiresAt ? ` (am ${fmtDate(status.expiresAt)})` : ''}.`;
  return (
    <div data-testid="meta-token-banner" data-level={level} style={{
      ...mono, fontSize: 12, padding: '8px 32px', textAlign: 'center',
      color: expired ? '#ff9a92' : '#ffd27a',
      background: expired ? 'rgba(232,115,107,.14)' : 'rgba(232,176,75,.14)',
      borderBottom: `1px solid ${expired ? 'rgba(232,115,107,.45)' : 'rgba(232,176,75,.45)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <span>⚠ <strong>{text}</strong> Neuen User-Token in Vercel als META_API_KEY setzen und neu deployen.</span>
      <button type="button" onClick={() => router.push('/settings?tab=integrations')}
        style={{ ...mono, fontSize: 11, padding: '3px 10px', borderRadius: 4, border: '1px solid currentColor', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
        → Einstellungen · Integrationen
      </button>
    </div>
  );
}
