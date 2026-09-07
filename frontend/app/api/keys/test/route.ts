import { NextRequest, NextResponse } from 'next/server';
import { envKey } from '@/lib/serverKeys';
import { callAi } from '@/lib/aiProviders';
import { defaultModel } from '@/lib/ai';
import { getMetaTokenStatus } from '@/lib/metaTokenServer';
import { metaTokenLevel, metaTokenText } from '@/lib/metaToken';

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

/** Meta: gemeinsame Prüfung (lib/metaTokenServer.ts), hier frisch statt aus dem Cache */
async function testMeta(): Promise<Omit<KeyTestResult, 'provider' | 'ms'>> {
  const s = await getMetaTokenStatus(true);
  const level = metaTokenLevel(s);
  const text = metaTokenText(s);
  if (level === 'expired') return { ok: false, message: `${text} — neuen User-Token erzeugen`, expiresAt: s.expiresAt };
  return { ok: true, warn: level === 'warn' || !s.scopesOk, message: `OK · ${text}${level === 'warn' ? ' — bald neuen Token setzen' : ''}`, expiresAt: s.expiresAt };
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
    const r = await testMeta();
    return NextResponse.json<KeyTestResult>({ provider, ...r, ms: Date.now() - t0 });
  }

  const model = defaultModel(provider);
  const a = await callAi(provider, model, 'Antworte nur mit dem Wort OK.', key, 20_000);
  const ms = Date.now() - t0;
  if (a.text.startsWith('Fehler:')) return NextResponse.json<KeyTestResult>({ provider, ok: false, message: a.text.slice('Fehler:'.length).trim(), model, ms });
  return NextResponse.json<KeyTestResult>({ provider, ok: true, message: `Antwort erhalten (${a.input + a.output} Token)`, model, ms });
}
