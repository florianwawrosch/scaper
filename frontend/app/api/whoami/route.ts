import { NextRequest, NextResponse } from 'next/server';
import { originFromHeaders } from '@/lib/origin';

export const dynamic = 'force-dynamic';

/** Standort des aufrufenden Browsers aus den Vercel-Geo-Headern — wird an neue Datensätze gestempelt */
export async function GET(req: NextRequest) {
  return NextResponse.json(originFromHeaders(req.headers));
}
