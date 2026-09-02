import { NextRequest, NextResponse } from 'next/server';
import { safeEqual } from '@/lib/auth';

export function middleware(req: NextRequest) {
  const pwd = process.env.APP_PASSWORD;
  // No password configured → open access
  if (!pwd) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Always allow the login page and auth API
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get('app_auth')?.value;
  if (cookie && safeEqual(cookie, `auth::${pwd}`)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
