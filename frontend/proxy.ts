import { NextRequest, NextResponse } from 'next/server';
import { safeEqual, authToken, authEnv, AUTH_COOKIE } from '@/lib/auth';

/**
 * Fail-closed access gate (Next 16 "proxy" convention, formerly middleware).
 *
 * Without APP_USER + APP_PASSWORD the app is not "open" — it is locked: pages
 * land on /login (which names the missing variable), API routes get a JSON
 * 503. With them, every page and every API route needs a valid session
 * cookie; API callers get a JSON 401 instead of an HTML redirect, so a
 * client-side fetch sees a real error rather than trying to parse the login
 * page.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The login page and the auth API must stay reachable to get in at all
  if (pathname === '/login' || pathname.startsWith('/api/auth')) return NextResponse.next();

  const isApi = pathname.startsWith('/api/');
  const toLogin = () => {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  };

  const { user, password, missing } = authEnv();
  if (missing.length > 0) {
    return isApi
      ? NextResponse.json({ detail: `App gesperrt: ${missing.join(' und ')} auf dem Server nicht gesetzt.` }, { status: 503 })
      : toLogin();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && safeEqual(cookie, await authToken(user, password))) return NextResponse.next();

  return isApi
    ? NextResponse.json({ detail: 'Nicht eingeloggt' }, { status: 401 })
    : toLogin();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
