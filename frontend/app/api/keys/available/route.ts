import { NextResponse } from 'next/server';
import { keySetup } from '@/lib/serverKeys';

export const dynamic = 'force-dynamic';

/** Welche Anbieter einen Key haben + wo man ihn setzt — nie die Keys selbst. */
export async function GET() {
  return NextResponse.json(keySetup());
}
