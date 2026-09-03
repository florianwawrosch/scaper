import { NextRequest, NextResponse } from 'next/server';
import { envKey } from '@/lib/serverKeys';

/**
 * Guthaben + Abrechnungsregel eines Enrichment-Anbieters — für die
 * Bestätigung vor dem Lauf («du hast X, das kostet bis zu Y»).
 * Die Regeltexte spiegeln die Anbieter-Doku (Stand: Sept. 2026); die Zahlen
 * kommen live vom Anbieter. Schlägt die Abfrage fehl, liefert die Route
 * trotzdem 200 mit available=null, damit die UI nicht blockiert.
 */

export interface EnrichAccount {
  provider: string;
  label: string;
  /** Verbleibende Einheiten (null = nicht abfragbar) */
  available: number | null;
  used?: number | null;
  unit: string;
  planName?: string;
  resetDate?: string;
  /** Wann der Anbieter eine Einheit abzieht */
  rule: string;
  /** true = nur Treffer kosten, Fehlanzeigen sind gratis */
  chargedOnlyOnHit: boolean;
  /** Separates Telefon-Guthaben (FindyMail), falls der Anbieter es ausweist */
  phoneAvailable?: number | null;
  phoneRule?: string;
  error?: string;
}

const RULES = {
  hunter_io: {
    label: 'Hunter.io',
    unit: 'Credits',
    rule: 'Hunter.io zieht 1 Credit pro Email-Finder-Anfrage MIT Treffer ab; Anfragen ohne Ergebnis sind kostenlos.',
    chargedOnlyOnHit: true,
  },
  findymail: {
    label: 'FindyMail',
    unit: 'Credits',
    rule: 'FindyMail berechnet 1 Credit pro gefundener (verifizierter) E-Mail; nicht gefundene Kontakte kosten nichts.',
    chargedOnlyOnHit: true,
    phoneRule: 'Telefonnummern werden mit separaten Telefon-Credits abgerechnet — nur bei gefundener Nummer.',
  },
} as const;

type Provider = keyof typeof RULES;

async function hunterAccount(key: string) {
  const res = await fetch(`https://api.hunter.io/v2/account?api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(8000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.errors?.[0]?.details ?? `HTTP ${res.status}`);
  const d = json?.data ?? {};
  // Neuere Konten: requests.credits, ältere: requests.searches
  const r = d.requests ?? {};
  const bucket = r.credits ?? r.searches ?? {};
  return {
    available: typeof bucket.available === 'number' ? bucket.available : null,
    used: typeof bucket.used === 'number' ? bucket.used : null,
    planName: d.plan_name,
    resetDate: d.reset_date,
  };
}

async function findymailAccount(key: string) {
  const res = await fetch('https://app.findymail.com/api/credits', {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  const credits = json?.credits ?? json?.data?.credits;
  const phone = json?.phone_credits ?? json?.mobile_credits ?? json?.data?.phone_credits;
  return {
    available: typeof credits === 'number' ? credits : null,
    used: null,
    phoneAvailable: typeof phone === 'number' ? phone : null,
  };
}

export async function POST(req: NextRequest) {
  let body: Partial<Record<'provider' | 'apiKey', unknown>> = {};
  try { body = await req.json(); } catch {}
  const provider = String(body.provider ?? '') as Provider;
  if (!(provider in RULES)) return NextResponse.json({ detail: `Unbekannter Provider: ${provider}` }, { status: 400 });
  const key = (typeof body.apiKey === 'string' && body.apiKey) || envKey(provider);
  const base: EnrichAccount = { provider, ...RULES[provider], available: null };
  if (!key) return NextResponse.json({ ...base, error: 'Kein API-Key hinterlegt' });
  try {
    const acc = provider === 'hunter_io' ? await hunterAccount(key) : await findymailAccount(key);
    return NextResponse.json({ ...base, ...acc });
  } catch (e) {
    return NextResponse.json({ ...base, error: e instanceof Error ? e.message : 'Abfrage fehlgeschlagen' });
  }
}
