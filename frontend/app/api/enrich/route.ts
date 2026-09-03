import { NextRequest, NextResponse } from 'next/server';
import { envKey } from '@/lib/serverKeys';
import { fetchRetry } from '@/lib/serverRetry';

/**
 * E-Mail enrichment (Hunter.io + FindyMail) — port of the enrich endpoint
 * from main.py. Runs on Vercel, keys come from the env vars
 * (FINDYMAIL_API_KEY etc. — see lib/serverKeys.ts).
 */

export const maxDuration = 60;

async function enrichHunter(name: string, company: string, key: string): Promise<string | null> {
  const parts = name.trim().split(/\s+/);
  const params = new URLSearchParams({
    first_name: parts[0] ?? '',
    last_name:  parts.length > 1 ? parts[parts.length - 1] : '',
    company,
    api_key: key,
  });
  const res = await fetchRetry(`https://api.hunter.io/v2/email-finder?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null; // no email found — not an error
  const text = await res.text();
  let data: { errors?: { details?: string }[]; message?: string; data?: { email?: string } } = {};
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = data.errors?.[0]?.details ?? data.message ?? text.slice(0, 150);
    throw new Error(`Hunter.io HTTP ${res.status}: ${msg}`);
  }
  return data.data?.email ?? null;
}

async function enrichFindymail(name: string, company: string, key: string): Promise<string | null> {
  const res = await fetchRetry('https://app.findymail.com/api/search/name', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), domain: company }),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  const text = await res.text();
  let data: { message?: string; error?: string; contact?: { email?: string }; email?: string } = {};
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = data.message ?? data.error ?? text.slice(0, 150);
    throw new Error(`FindyMail HTTP ${res.status}: ${msg}`);
  }
  return data.contact?.email ?? data.email ?? null;
}

export async function POST(req: NextRequest) {
  let body: Partial<Record<'provider' | 'rows' | 'nameColumn' | 'companyColumn' | 'apiKey', unknown>> = {};
  try { body = await req.json(); } catch {}

  const provider = String(body.provider ?? '');
  const rows: Record<string, string>[] = Array.isArray(body.rows) ? body.rows : [];
  const nameCol    = String(body.nameColumn ?? 'name');
  const companyCol = String(body.companyColumn ?? 'company');

  if (provider !== 'hunter_io' && provider !== 'findymail') {
    return NextResponse.json({ detail: `Unbekannter Provider: ${provider}` }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ detail: 'Keine Zeilen übergeben' }, { status: 400 });

  const key = (typeof body.apiKey === 'string' && body.apiKey) || envKey(provider);
  if (!key) {
    return NextResponse.json(
      { detail: `Kein API-Key für ${provider} — als Umgebungsvariable in Vercel setzen (z.B. FINDYMAIL_API_KEY).` },
      { status: 400 },
    );
  }

  const batch = rows.slice(0, 50); // API cost safety limit
  const results: { email: string; enriched: boolean }[] = new Array(batch.length);
  let firstError: string | null = null;
  let skippedEmpty = 0;

  // Sequential processing of up to 50 rows (each with a 10s provider timeout)
  // can exceed this route's 60s maxDuration well before finishing — and since
  // results were only returned after the loop, a timeout discarded every
  // lookup, including ones the provider had already billed. Bounded
  // concurrency (same pattern as /api/ai/analyze) keeps wall-clock time well
  // under the limit.
  const CONCURRENCY = 8;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batch.length) }, async () => {
      while (next < batch.length) {
        const i = next++;
        const row = batch[i];
        const name    = String(row[nameCol] ?? '').trim();
        const company = String(row[companyCol] ?? '').trim();
        let email: string | null = null;

        if (name && company) {
          try {
            email = provider === 'hunter_io'
              ? await enrichHunter(name, company, key)
              : await enrichFindymail(name, company, key);
          } catch (e) {
            if (!firstError) firstError = e instanceof Error ? e.message : String(e);
          }
        } else {
          skippedEmpty++;
        }
        results[i] = { email: email ?? '', enriched: !!email };
      }
    }),
  );

  const nOk = results.filter(r => r.enriched).length;
  if (nOk === 0 && firstError) {
    return NextResponse.json({ detail: `${provider} API-Fehler: ${firstError}` }, { status: 502 });
  }

  return NextResponse.json({
    enriched: nOk,
    total: results.length,
    skipped_empty: skippedEmpty,
    error: firstError,
    results,
  });
}
