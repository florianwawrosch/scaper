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
  model?: string;
  ms: number;
}

/**
 * Verbindungstest für einen KI-Anbieter: ein winziger Prompt mit dem
 * Server-Key. Zeigt, ob der Key gültig ist und Guthaben da ist — kostet nur
 * ein paar Token. Enrichment-Dienste testet /api/enrich/account.
 */
export async function POST(req: NextRequest) {
  let body: { provider?: unknown } = {};
  try { body = await req.json(); } catch {}
  const provider = String(body.provider ?? '').toLowerCase();
  if (!['gemini', 'anthropic', 'openai'].includes(provider)) return NextResponse.json({ detail: `Unbekannter Anbieter: ${provider}` }, { status: 400 });

  const t0 = Date.now();
  const key = envKey(provider);
  const model = defaultModel(provider);
  if (!key) return NextResponse.json<KeyTestResult>({ provider, ok: false, message: 'Kein Key gesetzt', ms: 0 });

  const a = await callAi(provider, model, 'Antworte nur mit dem Wort OK.', key, 20_000);
  const ms = Date.now() - t0;
  if (a.text.startsWith('Fehler:')) return NextResponse.json<KeyTestResult>({ provider, ok: false, message: a.text.slice('Fehler:'.length).trim(), model, ms });
  return NextResponse.json<KeyTestResult>({ provider, ok: true, message: `Antwort erhalten (${a.input + a.output} Token)`, model, ms });
}
