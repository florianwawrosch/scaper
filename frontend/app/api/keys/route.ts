import { NextRequest, NextResponse } from 'next/server';
import { KEY_ENV, envKey } from '@/lib/serverKeys';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Only serve raw keys on a password-protected deployment: without APP_PASSWORD
  // the app is public and this endpoint would leak secrets to anyone.
  // (Without a password the server-side proxy still injects keys — nothing breaks.)
  const pwd = process.env.APP_PASSWORD;
  if (!pwd) return NextResponse.json({});

  const cookie = req.cookies.get('app_auth')?.value;
  if (cookie !== `auth::${pwd}`) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  }

  const keys: Record<string, string> = {};
  for (const provider of Object.keys(KEY_ENV)) {
    const v = envKey(provider);
    if (v) keys[provider] = v;
  }
  return NextResponse.json(keys);
}
