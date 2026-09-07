import { NextRequest, NextResponse } from 'next/server';
import { envKey } from '@/lib/serverKeys';
import { callAi } from '@/lib/aiProviders';

/**
 * AI analysis — direct TypeScript port of _call_ai_single from main.py.
 * Runs on Vercel; the client sends prompts in chunks so no request exceeds
 * the serverless time limit.
 *
 * HINWEIS ZUR KEY-SPEICHERUNG: Die KI-Keys stehen NICHT im Code, sondern in
 * den Vercel-Umgebungsvariablen (OPENAI_API_KEY, GEMINI_API_KEY,
 * ANTHROPIC_API_KEY — siehe lib/serverKeys.ts). Dauerhaft gespeichert.
 */

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: Partial<Record<'provider' | 'model' | 'prompts', unknown>> = {};
  try { body = await req.json(); } catch {}

  const provider = String(body.provider ?? '').toLowerCase();
  const model    = String(body.model ?? '');
  const prompts: string[] = Array.isArray(body.prompts) ? body.prompts : [];

  if (!provider || !model) return NextResponse.json({ detail: 'provider und model erforderlich' }, { status: 400 });
  if (prompts.length === 0) return NextResponse.json({ values: [] });
  if (prompts.length > 25)  return NextResponse.json({ detail: 'Max. 25 Prompts pro Aufruf' }, { status: 400 });

  const key = envKey(provider);
  if (!key) {
    return NextResponse.json(
      { detail: `Kein API-Key für ${provider} — als Umgebungsvariable in Vercel setzen (z.B. OPENAI_API_KEY).` },
      { status: 400 },
    );
  }

  // Limited concurrency so provider rate limits aren't hammered
  const CONCURRENCY = 4;
  const values: string[] = new Array(prompts.length);
  const usage = { input: 0, output: 0 };
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, prompts.length) }, async () => {
      while (next < prompts.length) {
        const i = next++;
        const a = await callAi(provider, model, prompts[i], key);
        values[i] = a.text; usage.input += a.input; usage.output += a.output;
      }
    }),
  );

  // usage: Token laut Anbieter (Verbrauchsprotokoll in den Einstellungen)
  return NextResponse.json({ values, usage });
}
