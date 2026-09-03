/**
 * Which providers have an API key on the server side (Vercel env vars).
 * Booleans only — local (browser) keys are checked separately via loadSettings().
 */
export async function fetchKeyAvailability(timeoutMs = 4000): Promise<Record<string, boolean>> {
  try {
    const res = await fetch('/api/keys/available', { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return {};
    const json = await res.json();
    const out: Record<string, boolean> = {};
    if (json && typeof json === 'object') for (const [k, v] of Object.entries(json)) if (v) out[k] = true;
    return out;
  } catch { return {}; }
}
