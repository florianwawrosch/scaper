/**
 * Meta-Token (Ads Library): Status und Restlaufzeit — gemeinsame Typen und
 * reine Funktionen für Server (Prüfung) und Browser (Anzeige, Warnleiste).
 */
export const META_WARN_DAYS = 7;

export interface MetaTokenStatus {
  /** false = kein META_API_KEY gesetzt */
  configured: boolean;
  /** Token laut Meta gültig */
  valid: boolean;
  /** ISO-Zeitpunkt des Ablaufs; null = läuft nie ab (System-User-Token) oder unbekannt */
  expiresAt: string | null;
  /** true, wenn Meta expires_at = 0 meldet */
  neverExpires: boolean;
  /** Berechtigung ads_read vorhanden (true, wenn nicht abfragbar) */
  scopesOk: boolean;
  /** Ablaufdatum konnte nicht abgefragt werden (nur /me-Prüfung) */
  expiryUnknown: boolean;
  /** Kurztext für die Anzeige */
  message: string;
  checkedAt: string;
}

export const remainingMs = (expiresAt: string | null, now = Date.now()): number | null =>
  expiresAt ? Date.parse(expiresAt) - now : null;

/** «5 Tagen, 3 Stunden und 12 Minuten» — für «läuft ab in …»; «abgelaufen» bei ≤ 0 */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'abgelaufen';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const days = `${d} ${d === 1 ? 'Tag' : 'Tagen'}`;
  const hours = `${h} ${h === 1 ? 'Stunde' : 'Stunden'}`;
  const mins = `${m} ${m === 1 ? 'Minute' : 'Minuten'}`;
  return `${days}, ${hours} und ${mins}`;
}

export type MetaTokenLevel = 'none' | 'ok' | 'warn' | 'expired';

/** Stufe für Anzeige und Warnleiste */
export function metaTokenLevel(s: MetaTokenStatus | null, now = Date.now()): MetaTokenLevel {
  if (!s || !s.configured) return 'none';
  if (!s.valid) return 'expired';
  const rem = remainingMs(s.expiresAt, now);
  if (rem === null) return 'ok';
  if (rem <= 0) return 'expired';
  return rem <= META_WARN_DAYS * 86_400_000 ? 'warn' : 'ok';
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Text für die Integrationen: «gültig bis 05.11.2026 (58 Tage)» / «läuft nie ab» / «abgelaufen» */
export function metaTokenText(s: MetaTokenStatus, now = Date.now()): string {
  if (!s.configured) return 'kein Token gesetzt';
  if (!s.valid) return `Token ungültig oder abgelaufen${s.message ? ` — ${s.message}` : ''}`;
  const scopes = s.scopesOk ? '' : ' · Berechtigung ads_read fehlt';
  if (s.neverExpires) return `läuft nie ab${scopes}`;
  if (!s.expiresAt) return `gültig · Ablaufdatum nicht abfragbar${scopes}`;
  const rem = remainingMs(s.expiresAt, now) ?? 0;
  if (rem <= 0) return 'abgelaufen — neuen Token setzen';
  const days = Math.floor(rem / 86_400_000);
  return `gültig bis ${fmtDate(s.expiresAt)} (${days === 0 ? 'weniger als 1 Tag' : `${days} ${days === 1 ? 'Tag' : 'Tage'}`})${scopes}`;
}
