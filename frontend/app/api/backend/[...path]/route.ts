import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy to the FastAPI backend.
 *
 * Why: API keys live as env vars on Vercel (any naming, no NEXT_PUBLIC_
 * prefix). The browser can't read those — but this route can. It forwards
 * every request to the backend and injects the matching key server-side
 * whenever the browser didn't send one. Keys never have to enter the browser.
 */

import { envKey } from '@/lib/serverKeys';

function backendBase(req: NextRequest): string | null {
  const fromClient = req.headers.get('x-backend-url') ?? '';
  const base = fromClient || process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '';
  if (!/^https?:\/\//.test(base)) return null;
  return base.replace(/\/+$/, '');
}

/** Fill in API keys server-side where the browser sent none. */
function injectKeys(path: string, body: any): any {
  if (!body || typeof body !== 'object') return body;

  if (path === 'api/runs' && body.source === 'meta_ads_library') {
    body.scraper_config = body.scraper_config ?? {};
    if (!body.scraper_config.meta_ads_token) {
      const k = envKey('meta_ads');
      if (k) body.scraper_config.meta_ads_token = k;
    }
  }
  if ((path.endsWith('/analyze') || path.endsWith('/classify')) && !body.apiKey) {
    const k = envKey(String(body.aiProvider ?? ''));
    if (k) body.apiKey = k;
  }
  if (path.endsWith('/enrich') && !body.apiKey) {
    const k = envKey(String(body.provider ?? ''));
    if (k) body.apiKey = k;
  }
  return body;
}

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const base = backendBase(req);
  if (!base) {
    return NextResponse.json(
      { detail: 'Backend-URL nicht konfiguriert — in den Einstellungen eintragen.' },
      { status: 502 },
    );
  }

  const { path: segments } = await params;
  const path = segments.join('/');
  const url = `${base}/${path}${req.nextUrl.search}`;

  const init: RequestInit = { method: req.method, signal: AbortSignal.timeout(120_000) };

  const contentType = req.headers.get('content-type') ?? '';
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (contentType.includes('application/json')) {
      let body: any = null;
      try { body = await req.json(); } catch {}
      init.body = JSON.stringify(injectKeys(path, body));
      init.headers = { 'Content-Type': 'application/json' };
    } else {
      // FormData / binary: stream through untouched
      init.body = req.body;
      init.headers = contentType ? { 'Content-Type': contentType } : undefined;
      (init as any).duplex = 'half';
    }
  }

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unbekannt';
    return NextResponse.json(
      { detail: `Backend nicht erreichbar (${base}): ${msg}` },
      { status: 502 },
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
