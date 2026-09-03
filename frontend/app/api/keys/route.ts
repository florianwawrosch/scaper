import { NextRequest, NextResponse } from 'next/server';
import { KEY_ENV, envKey } from '@/lib/serverKeys';
import { safeEqual, authToken, authEnv, AUTH_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Raw server keys for a logged-in browser. proxy.ts already gates this
 * route; the checks here are defense in depth so the secrets never leave the
 * server on any path that skipped it.
 */
export async function GET(req: NextRequest) {
  const { user, password, missing } = authEnv();
  if (missing.length > 0) return NextResponse.json({ error: `App gesperrt: ${missing.join(' und ')} nicht gesetzt` }, { status: 503 });

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (typeof cookie !== 'string' || !safeEqual(cookie, await authToken(user, password))) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  }

  const keys: Record<string, string> = {};
  for (const provider of Object.keys(KEY_ENV)) {
    const v = envKey(provider);
    if (v) keys[provider] = v;
  }
  return NextResponse.json(keys);
}
