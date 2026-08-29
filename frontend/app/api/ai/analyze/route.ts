import { NextRequest, NextResponse } from 'next/server';
import { envKey } from '@/lib/serverKeys';

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

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error(text.slice(0, 200) || `HTTP ${res.status}`); }
}

async function callAi(provider: string, model: string, prompt: string, key: string): Promise<string> {
  try {
    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '—').trim();
    }
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model, max_tokens: 256, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      return (data.content?.[0]?.text ?? '—').trim();
    }
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, max_tokens: 256, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      return (data.choices?.[0]?.message?.content ?? '—').trim();
    }
    return `Fehler: Unbekannter Provider ${provider}`;
  } catch (e) {
    return `Fehler: ${e instanceof Error ? e.message : e}`;
  }
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}

  const provider = String(body.provider ?? '').toLowerCase();
  const model    = String(body.model ?? '');
  const prompts: string[] = Array.isArray(body.prompts) ? body.prompts : [];

  if (!provider || !model) return NextResponse.json({ detail: 'provider und model erforderlich' }, { status: 400 });
  if (prompts.length === 0) return NextResponse.json({ values: [] });
  if (prompts.length > 25)  return NextResponse.json({ detail: 'Max. 25 Prompts pro Aufruf' }, { status: 400 });

  const key = body.apiKey || envKey(provider);
  if (!key) {
    return NextResponse.json(
      { detail: `Kein API-Key für ${provider} — als Umgebungsvariable in Vercel setzen (z.B. OPENAI_API_KEY).` },
      { status: 400 },
    );
  }

  // Limited concurrency so provider rate limits aren't hammered
  const CONCURRENCY = 4;
  const values: string[] = new Array(prompts.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, prompts.length) }, async () => {
      while (next < prompts.length) {
        const i = next++;
        values[i] = await callAi(provider, model, prompts[i], key);
      }
    }),
  );

  return NextResponse.json({ values });
}
