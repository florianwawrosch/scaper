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

const isLocalhost = (u: string) => /^https?:\/\/(localhost|127\.|0\.0\.0\.0)/i.test(u);
const norm = (u: string) => u.replace(/\/+$/, '');

function serverBackend(): string {
  return norm(process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '');
}

function backendBase(req: NextRequest): string | null {
  const fromClient = norm(req.headers.get('x-backend-url') ?? '');
  const serverEnv  = serverBackend();
  // A real user override wins — but the client's localhost build-time fallback
  // must never shadow a proper URL configured server-side.
  let base = fromClient;
  if (!base || (isLocalhost(base) && serverEnv && !isLocalhost(serverEnv))) base = serverEnv;
  if (!/^https?:\/\//.test(base)) return null;
  return norm(base);
}

/**
 * Fill in API keys server-side where the browser sent none.
 * SECURITY: only ever inject secrets when forwarding to the backend the
 * server itself configured — never to a client-supplied host, which could
 * otherwise exfiltrate the keys. When no server BACKEND_URL is set, keys are
 * never injected here (the dedicated /api/scrape, /api/ai, /api/enrich routes
 * handle key injection to fixed provider hosts instead).
 */
type JsonBody = Record<string, unknown>;

function injectKeys(path: string, body: unknown, destination: string): unknown {
  if (!body || typeof body !== 'object') return body;
  const b = body as JsonBody;
  const trusted = serverBackend();
  if (!trusted || norm(destination) !== trusted) return body;

  if (path === 'api/runs' && b.source === 'meta_ads_library') {
    const sc = (b.scraper_config && typeof b.scraper_config === 'object' ? b.scraper_config : {}) as JsonBody;
    b.scraper_config = sc;
    if (!sc.meta_ads_token) {
      const k = envKey('meta_ads');
      if (k) sc.meta_ads_token = k;
    }
  }
  if ((path.endsWith('/analyze') || path.endsWith('/classify')) && !b.apiKey) {
    const k = envKey(String(b.aiProvider ?? ''));
    if (k) b.apiKey = k;
  }
  if (path.endsWith('/enrich') && !b.apiKey) {
    const k = envKey(String(b.provider ?? ''));
    if (k) b.apiKey = k;
  }
  return b;
}

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const base = backendBase(req);
  if (!base || isLocalhost(base)) {
    return NextResponse.json(
      { detail: 'Backend-URL fehlt: Die Python-Backend-Adresse (z.B. Railway-URL) in Einstellungen → Backend eintragen, oder als BACKEND_URL Umgebungsvariable in Vercel setzen.' },
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
      let body: unknown = null;
      try { body = await req.json(); } catch {}
      init.body = JSON.stringify(injectKeys(path, body, base));
      init.headers = { 'Content-Type': 'application/json' };
    } else {
      // FormData / binary: stream through untouched
      init.body = req.body;
      init.headers = contentType ? { 'Content-Type': contentType } : undefined;
      (init as RequestInit & { duplex?: 'half' }).duplex = 'half';
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
