/**
 * Which providers have an API key on the server side (Vercel env vars).
 * Booleans only — local (browser) keys are checked separately via loadSettings().
 * Mehrere Komponenten fragen das beim Mount ab; die Antwort wird 30 s geteilt,
 * damit eine Seite nicht vier identische Requests schickt.
 */
const TTL_MS = 30_000;
let cached: { at: number; promise: Promise<Record<string, boolean>> } | null = null;

async function request(timeoutMs: number): Promise<Record<string, boolean>> {
  try {
    const res = await fetch('/api/keys/available', { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return {};
    const json = await res.json();
    const out: Record<string, boolean> = {};
    if (json && typeof json === 'object') for (const [k, v] of Object.entries(json)) if (v) out[k] = true;
    return out;
  } catch { return {}; }
}

export function fetchKeyAvailability(timeoutMs = 4000): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.promise;
  const promise = request(timeoutMs);
  cached = { at: now, promise };
  return promise;
}

/** Nach dem Speichern von Keys in den Einstellungen: nächste Abfrage frisch */
export function invalidateKeyAvailability(): void { cached = null; }
