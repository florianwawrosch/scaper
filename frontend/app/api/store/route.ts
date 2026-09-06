import { NextRequest, NextResponse } from 'next/server';
import { getStoreDriver, isValidKey } from '@/lib/serverStore';

export const runtime = 'nodejs';

/**
 * Gemeinsamer Speicher — GET ?manifest=1 (alles Kleine + Liste der CSV-Texte),
 * GET ?key= (ein Eintrag), GET ?trash=1 (Papierkorb), PUT {key, value, ifMatch?}
 * (ifMatch = zuletzt gesehener Stand; stimmt er nicht → 409 mit aktuellem Wert),
 * PATCH {restore: [keys]} (aus dem Papierkorb zurück), DELETE ?key= (Tombstone),
 * ?all=1 (alles in den Papierkorb) oder ?purge=1[&key=] (endgültig).
 * Zugriff nur mit Session-Cookie (proxy.ts). Ohne Datenbank antwortet manifest
 * mit configured=false und die App bleibt lokal.
 */
const driverFor = (req: NextRequest) => getStoreDriver(req.cookies.get('lp_ns')?.value);
/** Größer geht ohnehin nicht durch Vercel; schützt die Datenbank vor Unfug */
const MAX_VALUE = 4_000_000;
/** Datenbank-Fehler landen im Server-Log, der Client bekommt nur eine kurze Meldung */
const dbError = (what: string, e: unknown) => {
  console.error(`[store] ${what}:`, e instanceof Error ? e.message : e);
  return NextResponse.json({ detail: `${what} — Datenbank nicht erreichbar` }, { status: 502 });
};

export async function GET(req: NextRequest) {
  const driver = driverFor(req);
  const key = req.nextUrl.searchParams.get('key');
  const trash = req.nextUrl.searchParams.get('trash') === '1';
  if (!driver) return NextResponse.json(key || trash ? { detail: 'Kein gemeinsamer Speicher konfiguriert' } : { configured: false, driver: null, items: [], large: [], tombstones: [] }, { status: key || trash ? 503 : 200 });
  try {
    if (trash) return NextResponse.json({ entries: await driver.trash() });
    if (key) {
      if (!isValidKey(key)) return NextResponse.json({ detail: 'Ungültiger Key' }, { status: 400 });
      const item = await driver.get(key);
      return item ? NextResponse.json(item) : NextResponse.json({ detail: 'Nicht gefunden' }, { status: 404 });
    }
    const m = await driver.manifest();
    return NextResponse.json({ configured: true, driver: driver.name, ...m });
  } catch (e) {
    return dbError('Lesen fehlgeschlagen', e);
  }
}

export async function PUT(req: NextRequest) {
  const driver = driverFor(req);
  if (!driver) return NextResponse.json({ detail: 'Kein gemeinsamer Speicher konfiguriert' }, { status: 503 });
  let body: { key?: unknown; value?: unknown; ifMatch?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ detail: 'Ungültiger Body' }, { status: 400 }); }
  const { key, value, ifMatch } = body;
  if (typeof key !== 'string' || !isValidKey(key) || typeof value !== 'string') return NextResponse.json({ detail: 'key/value fehlen' }, { status: 400 });
  if (value.length > MAX_VALUE) return NextResponse.json({ detail: 'Wert zu groß' }, { status: 413 });
  const cond = ifMatch === undefined ? undefined : typeof ifMatch === 'string' ? ifMatch : null;
  try {
    const r = await driver.set(key, value, cond);
    if (!r.ok) {
      console.warn(`[store] 409 ${key} — ifMatch ${cond ?? 'null'} ≠ ${r.current?.updatedAt ?? 'gelöscht'}`); // Diagnose: wie oft Kollegen gleichzeitig schreiben
      return NextResponse.json({ detail: 'Inzwischen von jemand anderem geändert', current: r.current }, { status: 409 });
    }
    return NextResponse.json({ key, updatedAt: r.updatedAt });
  } catch (e) {
    return dbError('Speichern fehlgeschlagen', e);
  }
}

/** Aus dem Papierkorb zurück: {restore: [keys]} — Keys ohne Tombstone werden übersprungen */
export async function PATCH(req: NextRequest) {
  const driver = driverFor(req);
  if (!driver) return NextResponse.json({ detail: 'Kein gemeinsamer Speicher konfiguriert' }, { status: 503 });
  let body: { restore?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ detail: 'Ungültiger Body' }, { status: 400 }); }
  const keys = Array.isArray(body.restore) ? body.restore.filter((k): k is string => typeof k === 'string' && isValidKey(k)) : [];
  if (keys.length === 0 || keys.length > 50) return NextResponse.json({ detail: 'restore: 1–50 Keys' }, { status: 400 });
  try {
    const restored: { key: string; updatedAt: string }[] = [];
    for (const key of keys) { const updatedAt = await driver.restore(key); if (updatedAt) restored.push({ key, updatedAt }); }
    return NextResponse.json({ restored });
  } catch (e) {
    return dbError('Wiederherstellen fehlgeschlagen', e);
  }
}

export async function DELETE(req: NextRequest) {
  const driver = driverFor(req);
  if (!driver) return NextResponse.json({ detail: 'Kein gemeinsamer Speicher konfiguriert' }, { status: 503 });
  const key = req.nextUrl.searchParams.get('key');
  try {
    if (req.nextUrl.searchParams.get('purge') === '1') {
      if (key && !isValidKey(key)) return NextResponse.json({ detail: 'Ungültiger Key' }, { status: 400 });
      await driver.purge(key ?? undefined);
      return NextResponse.json({ purged: key ?? 'all' });
    }
    if (req.nextUrl.searchParams.get('all') === '1') { await driver.wipe(); return NextResponse.json({ wiped: true }); }
    if (!key || !isValidKey(key)) return NextResponse.json({ detail: 'Ungültiger Key' }, { status: 400 });
    return NextResponse.json({ key, deletedAt: await driver.del(key) });
  } catch (e) {
    return dbError('Löschen fehlgeschlagen', e);
  }
}
