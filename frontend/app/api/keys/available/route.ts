import { NextResponse } from 'next/server';
import { availableKeys } from '@/lib/serverKeys';

export const dynamic = 'force-dynamic';

/**
 * Booleans only — no secrets — so the UI knows which providers work, plus
 * whether APP_PASSWORD gates the deployment (so the UI can warn when server
 * keys are exposed to the public without a login).
 */
export async function GET() {
  return NextResponse.json({
    ...availableKeys(),
    passwordProtected: !!process.env.APP_PASSWORD,
  });
}
