// Serverseitig: Meta-Token über debug_token prüfen (Gültigkeit, Ablauf,
// Berechtigungen) — mit Cache, damit Warnleiste und Einstellungen nicht bei
// jedem Seitenaufruf Meta anfragen.
import { envKey } from './serverKeys';
import type { MetaTokenStatus } from './metaToken';

const GRAPH = 'https://graph.facebook.com/v21.0';
/** So lange gilt eine Prüfung (Warnleiste fragt bei jedem Seitenaufruf) */
const CACHE_MS = 10 * 60_000;

let cached: { at: number; key: string; status: MetaTokenStatus } | null = null;

async function check(key: string): Promise<MetaTokenStatus> {
  const enc = encodeURIComponent(key);
  const checkedAt = new Date().toISOString();
  const base = { configured: true, checkedAt, neverExpires: false, scopesOk: true, expiryUnknown: false };
  try {
    // Der User-Token eines App-Entwicklers darf sich selbst inspizieren
    const r = await fetch(`${GRAPH}/debug_token?input_token=${enc}&access_token=${enc}`, { signal: AbortSignal.timeout(15_000) });
    const j = await r.json().catch(() => ({})) as { data?: { is_valid?: boolean; expires_at?: number; scopes?: string[]; error?: { message?: string } } };
    const d = j.data;
    if (r.ok && d && typeof d.is_valid === 'boolean') {
      if (!d.is_valid) return { ...base, valid: false, expiresAt: null, message: d.error?.message ?? 'laut Meta ungültig' };
      const exp = Number(d.expires_at) || 0; // 0 = läuft nie ab (System-User-Token)
      const scopesOk = Array.isArray(d.scopes) ? d.scopes.includes('ads_read') : true;
      return { ...base, valid: true, expiresAt: exp ? new Date(exp * 1000).toISOString() : null, neverExpires: exp === 0, scopesOk, message: '' };
    }
  } catch {}
  try {
    const me = await fetch(`${GRAPH}/me?fields=id,name&access_token=${enc}`, { signal: AbortSignal.timeout(15_000) });
    const mj = await me.json().catch(() => ({})) as { id?: string; name?: string; error?: { message?: string } };
    if (me.ok && mj.id) return { ...base, valid: true, expiresAt: null, expiryUnknown: true, message: mj.name ? `Token von ${mj.name}` : '' };
    return { ...base, valid: false, expiresAt: null, message: mj.error?.message ?? `HTTP ${me.status}` };
  } catch (e) {
    return { ...base, valid: false, expiresAt: null, message: e instanceof Error && e.name === 'TimeoutError' ? 'Zeitüberschreitung' : 'Meta nicht erreichbar' };
  }
}

/** Status des Meta-Tokens; `fresh` erzwingt eine neue Prüfung (Testen-Button) */
export async function getMetaTokenStatus(fresh = false): Promise<MetaTokenStatus> {
  const key = envKey('meta_ads');
  if (!key) return { configured: false, valid: false, expiresAt: null, neverExpires: false, scopesOk: true, expiryUnknown: false, message: '', checkedAt: new Date().toISOString() };
  if (!fresh && cached && cached.key === key && Date.now() - cached.at < CACHE_MS) return cached.status;
  const status = await check(key);
  cached = { at: Date.now(), key, status };
  return status;
}
