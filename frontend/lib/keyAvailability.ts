import type { KeySetup } from './serverKeys';

/**
 * Welche Anbieter auf dem Server einen API-Key haben (Vercel-Umgebungsvariablen)
 * und wo man Keys setzt. Keys selbst erreichen den Browser nie.
 * Mehrere Komponenten fragen das beim Mount ab; die Antwort wird 30 s geteilt,
 * damit eine Seite nicht vier identische Requests schickt.
 */
const TTL_MS = 30_000;
let cached: { at: number; promise: Promise<KeySetup | null> } | null = null;

async function request(timeoutMs: number): Promise<KeySetup | null> {
  try {
    const res = await fetch('/api/keys/available', { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || typeof json !== 'object' || typeof json.providers !== 'object') return null;
    return json as KeySetup;
  } catch { return null; }
}

/** Vollständige Auskunft (Anbieter, Variablennamen, Link) — null, wenn der Server nicht antwortet */
export function fetchKeySetup(timeoutMs = 4000): Promise<KeySetup | null> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.promise;
  const promise = request(timeoutMs);
  cached = { at: now, promise };
  return promise;
}

/** Nur die Anbieter mit Key: { anthropic: true, … } */
export async function fetchKeyAvailability(timeoutMs = 4000): Promise<Record<string, boolean>> {
  const setup = await fetchKeySetup(timeoutMs);
  const out: Record<string, boolean> = {};
  if (setup) for (const [k, v] of Object.entries(setup.providers)) if (v) out[k] = true;
  return out;
}
