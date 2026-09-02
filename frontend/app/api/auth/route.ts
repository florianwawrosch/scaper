import { NextRequest, NextResponse } from 'next/server';
import { safeEqual } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.APP_PASSWORD;

  if (!expected) {
    return NextResponse.json({ ok: true });
  }

  if (typeof password !== 'string' || !safeEqual(password, expected)) {
    return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('app_auth', `auth::${expected}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('app_auth');
  return res;
}
