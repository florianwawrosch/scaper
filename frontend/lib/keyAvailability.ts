import { apiFetch } from './api';

export interface ServerStatus {
  /** Which providers have an API key anywhere on the server side — booleans only. */
  keys: Record<string, boolean>;
  /**
   * Whether APP_PASSWORD gates the deployment. Without it the app is public
   * and every server-side key above is usable by anyone who finds the URL —
   * the UI surfaces a warning for exactly that case. `null` while unknown
   * (request failed), so callers don't flash a warning on a network blip.
   */
  passwordProtected: boolean | null;
}

/**
 * Server-side status: provider keys from the Railway backend env vars + the
 * Vercel server env vars, plus whether the app is password-protected.
 * Local (browser) keys are checked separately via loadSettings().
 */
export async function fetchServerStatus(timeoutMs = 4000): Promise<ServerStatus> {
  const [backend, vercel] = await Promise.allSettled([
    apiFetch('/api/config/providers', { signal: AbortSignal.timeout(timeoutMs) }).then(r => r.ok ? r.json() : {}),
    fetch('/api/keys/available', { signal: AbortSignal.timeout(timeoutMs) }).then(r => r.ok ? r.json() : null),
  ]);
  const keys: Record<string, boolean> = {};
  let passwordProtected: boolean | null = null;
  for (const r of [backend, vercel]) {
    if (r.status !== 'fulfilled' || !r.value || typeof r.value !== 'object') continue;
    for (const [k, v] of Object.entries(r.value)) {
      if (k === 'passwordProtected') { passwordProtected = !!v; continue; }
      if (v) keys[k] = true;
    }
  }
  return { keys, passwordProtected };
}

/** Provider availability only — the shape most callers need. */
export async function fetchKeyAvailability(timeoutMs = 4000): Promise<Record<string, boolean>> {
  return (await fetchServerStatus(timeoutMs)).keys;
}
