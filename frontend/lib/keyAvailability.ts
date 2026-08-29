import { apiFetch } from './api';

/**
 * Which providers have an API key anywhere on the server side:
 * Railway backend env vars + Vercel server env vars. Booleans only.
 * Local (browser) keys are checked separately via loadSettings().
 */
export async function fetchKeyAvailability(timeoutMs = 4000): Promise<Record<string, boolean>> {
  const results = await Promise.allSettled([
    apiFetch('/api/config/providers', { signal: AbortSignal.timeout(timeoutMs) }).then(r => r.ok ? r.json() : {}),
    fetch('/api/keys/available', { signal: AbortSignal.timeout(timeoutMs) }).then(r => r.ok ? r.json() : {}),
  ]);
  const merged: Record<string, boolean> = {};
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && typeof r.value === 'object') {
      for (const [k, v] of Object.entries(r.value)) if (v) merged[k] = true;
    }
  }
  return merged;
}
