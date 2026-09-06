/**
 * Herkunft eines Datensatzes: Standort aus der IP (Vercel setzt Geo-Header),
 * statt einer Nutzerverwaltung. Reine Funktion für den Server + Client-Abfrage.
 */

export interface Origin {
  /** «Wien, AT», nur «AT» oder die IP, wenn kein Standort bekannt ist; leer bei localhost */
  label: string;
  ip: string;
  city: string;
  country: string;
}

interface HeaderReader { get(name: string): string | null }

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

const decode = (v: string | null): string => {
  if (!v) return '';
  try { return decodeURIComponent(v).trim(); } catch { return v.trim(); }
};

/** Aus den Request-Headern (Vercel: x-vercel-ip-city/-country, Proxy: x-forwarded-for) */
export function originFromHeaders(h: HeaderReader): Origin {
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || (h.get('x-real-ip') ?? '').trim();
  const city = decode(h.get('x-vercel-ip-city'));
  const country = decode(h.get('x-vercel-ip-country')).toUpperCase();
  const label = city && country ? `${city}, ${country}` : city || country || (ip && !LOOPBACK.has(ip) ? ip : '');
  return { label, ip, city, country };
}

let cached: Promise<string> | null = null;

/** Standort-Label dieses Browsers (einmal pro Seitenaufruf abgefragt); leer, wenn unbekannt */
export function fetchOrigin(): Promise<string> {
  if (typeof window === 'undefined') return Promise.resolve('');
  if (!cached) {
    cached = fetch('/api/whoami', { signal: AbortSignal.timeout(2500) })
      .then(r => (r.ok ? r.json() : null))
      .then(j => (j && typeof j.label === 'string' ? j.label : ''))
      .catch(() => '');
  }
  return cached;
}
