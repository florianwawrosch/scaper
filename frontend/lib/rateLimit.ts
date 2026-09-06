// Login-Bremse: nach zu vielen Fehlversuchen von einer Adresse ist der Login
// für eine Weile gesperrt. Reiner In-Memory-Zähler (je Server-Instanz) — auf
// Vercel nicht global, aber genug, um Brute-Force massiv zu verlangsamen.
// Reine Logik mit injizierbarer Uhr, unit-getestet.

export const LOGIN_MAX_FAILS = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

interface Bucket { fails: number; first: number; blockedUntil: number }
const buckets = new Map<string, Bucket>();

/** Sperrsekunden für `ip`, 0 = darf versuchen */
export function loginBlockedFor(ip: string, now = Date.now()): number {
  const b = buckets.get(ip);
  if (!b) return 0;
  if (b.blockedUntil > now) return Math.ceil((b.blockedUntil - now) / 1000);
  if (now - b.first > LOGIN_WINDOW_MS) buckets.delete(ip);
  return 0;
}

/** Fehlversuch zählen; ab LOGIN_MAX_FAILS im Fenster: Sperre für ein Fenster */
export function recordLoginFailure(ip: string, now = Date.now()): void {
  const b = buckets.get(ip);
  if (!b || now - b.first > LOGIN_WINDOW_MS) { buckets.set(ip, { fails: 1, first: now, blockedUntil: 0 }); return; }
  b.fails++;
  if (b.fails >= LOGIN_MAX_FAILS) b.blockedUntil = now + LOGIN_WINDOW_MS;
}

/** Erfolgreicher Login setzt den Zähler zurück */
export function clearLoginFailures(ip: string): void { buckets.delete(ip); }

/** Client-Adresse hinter Vercel/Proxy */
export function clientIp(headers: { get(name: string): string | null }): string {
  return (headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || headers.get('x-real-ip') || 'unknown';
}
