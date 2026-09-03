import { NextRequest, NextResponse, after } from 'next/server';
import { safeEqual, authToken, authEnv, AUTH_COOKIE, AUTH_COOKIE_MAX_AGE } from '@/lib/auth';
import { loginContextFromRequest, notifyLogin } from '@/lib/loginNotify';

/** Lets the login page explain a locked deployment instead of a silent failure. */
export async function GET() {
  const { missing } = authEnv();
  return NextResponse.json({ configured: missing.length === 0, missing });
}

export async function POST(req: NextRequest) {
  const { user, password, missing } = authEnv();
  // Fail closed: incomplete credentials on the server mean nobody gets in — never "open".
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `App gesperrt: ${missing.join(' und ')} auf dem Server nicht gesetzt.`, missing },
      { status: 503 },
    );
  }

  let body: { username?: unknown; password?: unknown } = {};
  try { body = await req.json(); } catch {}
  const u = typeof body.username === 'string' ? body.username.trim() : '';
  const p = typeof body.password === 'string' ? body.password : '';
  // Evaluate both so a wrong user name costs the same time as a wrong password
  const userOk = safeEqual(u, user);
  const passOk = safeEqual(p, password);
  if (!userOk || !passOk) {
    return NextResponse.json({ error: 'Benutzername oder Passwort falsch' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(user, password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  });

  // Security mail / webhook — after the response, never delaying or failing the login
  const ctx = loginContextFromRequest(req, user);
  after(() => notifyLogin(ctx));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
