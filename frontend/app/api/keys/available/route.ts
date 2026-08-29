import { NextResponse } from 'next/server';
import { availableKeys } from '@/lib/serverKeys';

export const dynamic = 'force-dynamic';

/** Booleans only — no secrets — so the UI knows which providers work. */
export async function GET() {
  return NextResponse.json(availableKeys());
}
