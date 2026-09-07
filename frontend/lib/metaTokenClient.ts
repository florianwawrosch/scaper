import type { MetaTokenStatus } from './metaToken';

/** Meta-Token-Status vom Server, 5 Minuten geteilt zwischen Warnleiste und Einstellungen */
const TTL_MS = 5 * 60_000;
let cached: { at: number; promise: Promise<MetaTokenStatus | null> } | null = null;

async function request(fresh: boolean): Promise<MetaTokenStatus | null> {
  try {
    const res = await fetch(`/api/keys/meta${fresh ? '?fresh=1' : ''}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const j = await res.json();
    return j && typeof j.configured === 'boolean' ? j as MetaTokenStatus : null;
  } catch { return null; }
}

export function fetchMetaToken(fresh = false): Promise<MetaTokenStatus | null> {
  const now = Date.now();
  if (!fresh && cached && now - cached.at < TTL_MS) return cached.promise;
  const promise = request(fresh);
  cached = { at: now, promise };
  return promise;
}
