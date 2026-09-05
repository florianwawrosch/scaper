import { NextRequest, NextResponse } from 'next/server';
import { getStoreDriver, isValidKey } from '@/lib/serverStore';

export const runtime = 'nodejs';

/**
 * Gemeinsamer Speicher — GET ?manifest=1 (alles Kleine + Liste der CSV-Texte),
 * GET ?key= (ein Eintrag), PUT {key, value}, DELETE ?key= (Tombstone) oder
 * ?all=1 (alles). Zugriff nur mit Session-Cookie (proxy.ts). Ohne Datenbank
 * antwortet manifest mit configured=false und die App bleibt lokal.
 */
const driverFor = (req: NextRequest) => getStoreDriver(req.cookies.get('lp_ns')?.value);

export async function GET(req: NextRequest) {
  const driver = driverFor(req);
  const key = req.nextUrl.searchParams.get('key');
  if (!driver) return NextResponse.json(key ? { detail: 'Kein gemeinsamer Speicher konfiguriert' } : { configured: false, driver: null, items: [], datasets: [], tombstones: [] }, { status: key ? 503 : 200 });
  try {
    if (key) {
      if (!isValidKey(key)) return NextResponse.json({ detail: 'Ungültiger Key' }, { status: 400 });
      const item = await driver.get(key);
      return item ? NextResponse.json(item) : NextResponse.json({ detail: 'Nicht gefunden' }, { status: 404 });
    }
    const m = await driver.manifest();
    return NextResponse.json({ configured: true, driver: driver.name, ...m });
  } catch (e) {
    return NextResponse.json({ detail: `Speicher nicht erreichbar: ${e instanceof Error ? e.message : ''}` }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  const driver = driverFor(req);
  if (!driver) return NextResponse.json({ detail: 'Kein gemeinsamer Speicher konfiguriert' }, { status: 503 });
  let body: { key?: unknown; value?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ detail: 'Ungültiger Body' }, { status: 400 }); }
  const { key, value } = body;
  if (typeof key !== 'string' || !isValidKey(key) || typeof value !== 'string') return NextResponse.json({ detail: 'key/value fehlen' }, { status: 400 });
  try {
    return NextResponse.json({ key, updatedAt: await driver.set(key, value) });
  } catch (e) {
    return NextResponse.json({ detail: `Speichern fehlgeschlagen: ${e instanceof Error ? e.message : ''}` }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const driver = driverFor(req);
  if (!driver) return NextResponse.json({ detail: 'Kein gemeinsamer Speicher konfiguriert' }, { status: 503 });
  const key = req.nextUrl.searchParams.get('key');
  try {
    if (req.nextUrl.searchParams.get('all') === '1') { await driver.wipe(); return NextResponse.json({ wiped: true }); }
    if (!key || !isValidKey(key)) return NextResponse.json({ detail: 'Ungültiger Key' }, { status: 400 });
    return NextResponse.json({ key, deletedAt: await driver.del(key) });
  } catch (e) {
    return NextResponse.json({ detail: `Löschen fehlgeschlagen: ${e instanceof Error ? e.message : ''}` }, { status: 502 });
  }
}
