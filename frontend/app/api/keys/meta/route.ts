import { NextRequest, NextResponse } from 'next/server';
import { getMetaTokenStatus } from '@/lib/metaTokenServer';

export const dynamic = 'force-dynamic';

/** Status des Meta-Tokens (Gültigkeit, Ablauf) — für Warnleiste und Einstellungen; ?fresh=1 erzwingt eine neue Prüfung */
export async function GET(req: NextRequest) {
  return NextResponse.json(await getMetaTokenStatus(req.nextUrl.searchParams.get('fresh') === '1'));
}
