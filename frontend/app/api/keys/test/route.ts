import { NextRequest, NextResponse } from 'next/server';
import { envKey } from '@/lib/serverKeys';
import { callAi } from '@/lib/aiProviders';
import { defaultModel } from '@/lib/ai';

export const maxDuration = 30;

export interface KeyTestResult {
  provider: string;
  ok: boolean;
  /** Bei ok: kurze Bestätigung, sonst die (übersetzte) Fehlermeldung des Anbieters */
  message: string;
  /** ok, aber Handlungsbedarf (Meta-Token läuft bald ab, Berechtigung fehlt) */
  warn?: boolean;
  model?: string;
  /** Meta: Ablauf des Tokens (ISO), null = läuft nie ab */
  expiresAt?: string | null;
  ms: number;
}

const GRAPH = 'https://graph.facebook.com/v21.0';
const fmtDate = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Meta-Token prüfen: debug_token liefert Gültigkeit, Ablaufdatum und Berechtigungen
 * (der User-Token eines App-Entwicklers darf sich selbst inspizieren). Fällt das
 * aus, reicht /me als Gültigkeitstest — dann ohne Ablaufdatum.
 */
async function testMeta(key: string): Promise<Omit<KeyTestResult, 'provider' | 'ms'>> {
  const enc = encodeURIComponent(key);
  try {
    const r = await fetch(`${GRAPH}/debug_token?input_token=${enc}&access_token=${enc}`, { signal: AbortSignal.timeout(15_000) });
    const j = await r.json().catch(() => ({})) as { data?: { is_valid?: boolean; expires_at?: number; scopes?: string[]; error?: { message?: string } } };
    const d = j.data;
    if (r.ok && d && typeof d.is_valid === 'boolean') {
      if (!d.is_valid) return { ok: false, message: `Token ungültig oder abgelaufen${d.error?.message ? ` (${d.error.message})` : ''} — neuen User-Token erzeugen` };
      const exp = Number(d.expires_at) || 0; // 0 = läuft nie ab (System-User-Token)
      const days = exp ? Math.floor((exp * 1000 - Date.now()) / 86_400_000) : null;
      const hasAds = Array.isArray(d.scopes) ? d.scopes.includes('ads_read') : true;
      let message = exp ? `OK · gültig bis ${fmtDate(new Date(exp * 1000))} (${days} Tage)` : 'OK · läuft nie ab';
      if (days !== null && days <= 7) message += ' — bald neuen Token setzen';
      if (!hasAds) message += ' · Berechtigung ads_read fehlt';
      return { ok: true, warn: (days !== null && days <= 7) || !hasAds, message, expiresAt: exp ? new Date(exp * 1000).toISOString() : null };
    }
  } catch {}
  try {
    const me = await fetch(`${GRAPH}/me?fields=id,name&access_token=${enc}`, { signal: AbortSignal.timeout(15_000) });
    const mj = await me.json().catch(() => ({})) as { id?: string; name?: string; error?: { message?: string } };
    if (me.ok && mj.id) return { ok: true, message: `OK · Token gültig${mj.name ? ` (${mj.name})` : ''} · Ablaufdatum nicht abfragbar` };
    return { ok: false, message: mj.error?.message ?? `HTTP ${me.status}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error && e.name === 'TimeoutError' ? 'Zeitüberschreitung' : 'Meta nicht erreichbar' };
  }
}

/**
 * Verbindungstest für einen Dienst mit dem Server-Key: KI-Anbieter bekommen
 * einen winzigen Prompt (zeigt, ob der Key gültig und Guthaben da ist), Meta
 * eine Token-Prüfung mit Ablaufdatum. Enrichment-Dienste testet /api/enrich/account.
 */
export async function POST(req: NextRequest) {
  let body: { provider?: unknown } = {};
  try { body = await req.json(); } catch {}
  const provider = String(body.provider ?? '').toLowerCase();
  if (!['gemini', 'anthropic', 'openai', 'meta_ads'].includes(provider)) return NextResponse.json({ detail: `Unbekannter Anbieter: ${provider}` }, { status: 400 });

  const t0 = Date.now();
  const key = envKey(provider);
  if (!key) return NextResponse.json<KeyTestResult>({ provider, ok: false, message: 'Kein Key gesetzt', ms: 0 });

  if (provider === 'meta_ads') {
    const r = await testMeta(key);
    return NextResponse.json<KeyTestResult>({ provider, ...r, ms: Date.now() - t0 });
  }

  const model = defaultModel(provider);
  const a = await callAi(provider, model, 'Antworte nur mit dem Wort OK.', key, 20_000);
  const ms = Date.now() - t0;
  if (a.text.startsWith('Fehler:')) return NextResponse.json<KeyTestResult>({ provider, ok: false, message: a.text.slice('Fehler:'.length).trim(), model, ms });
  return NextResponse.json<KeyTestResult>({ provider, ok: true, message: `Antwort erhalten (${a.input + a.output} Token)`, model, ms });
}
