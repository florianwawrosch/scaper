// Gemeinsamer Speicher (Browser-Seite): localStorage + IndexedDB bleiben der
// schnelle lokale Cache für alle synchronen Lesezugriffe; jede Änderung an
// geteilten Keys wird als «pending» gemerkt und an /api/store geschickt, beim
// Laden der App (und beim Zurückkehren in den Tab) wird der Serverstand
// eingespielt. Server gewinnt bei Konflikten; nur-lokale Einträge werden
// hochgeladen, serverseitig gelöschte (Tombstones) lokal entfernt.
// API-Keys und Anzeige-Einstellungen bleiben bewusst nur im Browser.

import type { StoreManifest } from './serverStore';

const SHARED_EXACT = ['user_presets', 'preset_flags', 'preset_overrides', 'presets', 'blocklist'];
const SHARED_PREFIXES = ['csv_run_', 'analysis_configs_', 'analysis_hashes_', 'csv_text_'];
export const isSharedKey = (key: string) => SHARED_EXACT.includes(key) || SHARED_PREFIXES.some(p => key.startsWith(p));

export type StoreStatus = 'init' | 'local' | 'syncing' | 'synced' | 'error';

const PENDING_KEY   = 'lp_sync_pending';   // { key: 'set' | 'del' }
const CSV_REMOTE_KEY = 'lp_csv_remote';    // { csv_text_<id>: updatedAt } — Stand auf dem Server
const CSV_LOCAL_KEY  = 'lp_csv_local';     // { csv_text_<id>: updatedAt } — Stand, den dieses Gerät hat
export const STORE_EVENT = 'lp-store-updated';

/** Nur im echten Browser synchronisieren (Unit-Tests haben ein window-Shim, aber kein document) */
const inBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

let status: StoreStatus = 'init';
let lastError = '';
const listeners = new Set<(s: StoreStatus) => void>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;
let retryDelay = 3000;

const setStatus = (s: StoreStatus) => { status = s; listeners.forEach(l => l(s)); };
export const getStoreStatus = () => status;
export const getStoreError = () => lastError;
export function subscribeStore(fn: (s: StoreStatus) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

const readJson = <T,>(key: string, fallback: T): T => {
  try { const v = JSON.parse(localStorage.getItem(key) ?? 'null'); return (v ?? fallback) as T; } catch { return fallback; }
};
const writeJson = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };

/** Vorgemerkte Änderung; v steigt je Änderung — ein Upload gilt nur als erledigt, wenn v unverändert ist */
interface PendingEntry { op: 'set' | 'del'; v: number }
type Pending = Record<string, PendingEntry>;
let seq = 0;
function pending(): Pending {
  const raw = readJson<Record<string, PendingEntry | 'set' | 'del'>>(PENDING_KEY, {});
  const out: Pending = {};
  for (const [k, e] of Object.entries(raw)) out[k] = typeof e === 'string' ? { op: e, v: 0 } : e; // ältere Form
  return out;
}
function markPending(key: string, op: 'set' | 'del') {
  if (status === 'local') return; // ohne Datenbank nichts sammeln — hydrate lädt ohnehin alles Lokale hoch
  const p = pending(); p[key] = { op, v: Date.now() * 100 + (seq = (seq + 1) % 100) }; writeJson(PENDING_KEY, p);
  if (status === 'synced' && inBrowser()) setStatus('syncing'); // Pille zeigt sofort «sync…»
  // CSV-Texte sind groß und ändern sich während eines KI-Laufs oft — etwas länger sammeln
  scheduleFlush(key.startsWith('csv_text_') ? 2500 : 400);
}

/** localStorage.setItem + Synchronisation, wenn der Key geteilt ist */
export function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch {}
  if (isSharedKey(key)) markPending(key, 'set');
}

/** localStorage.removeItem + Tombstone auf dem Server */
export function lsRemove(key: string): void {
  try { localStorage.removeItem(key); } catch {}
  if (isSharedKey(key)) markPending(key, 'del');
}

/** CSV-Text (IndexedDB) als geändert/gelöscht vormerken — ruft csvStorage auf */
export const markCsvText = (id: string, op: 'set' | 'del') => markPending(`csv_text_${id}`, op);

export const csvRemoteStamp = (id: string): string | undefined => readJson<Record<string, string>>(CSV_REMOTE_KEY, {})[`csv_text_${id}`];
export const csvLocalStamp  = (id: string): string | undefined => readJson<Record<string, string>>(CSV_LOCAL_KEY, {})[`csv_text_${id}`];
export function setCsvStamps(id: string, updatedAt: string | null) {
  for (const k of [CSV_REMOTE_KEY, CSV_LOCAL_KEY]) {
    const m = readJson<Record<string, string>>(k, {});
    if (updatedAt) m[`csv_text_${id}`] = updatedAt; else delete m[`csv_text_${id}`];
    writeJson(k, m);
  }
}

// ── Packen großer Texte: gzip + base64 (CSV-Texte werden 4–8× kleiner) ──
const GZ = 'gz:';
async function packText(text: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return text;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return GZ + btoa(bin);
}
export async function unpackText(packed: string): Promise<string> {
  if (!packed.startsWith(GZ)) return packed;
  const bin = atob(packed.slice(GZ.length));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

// ── Hochladen (Queue) ──
function scheduleFlush(delay = 400) {
  if (!inBrowser() || status === 'local') return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { flushTimer = null; void flush(); }, delay);
}

async function valueFor(key: string): Promise<string | null> {
  if (key.startsWith('csv_text_')) {
    const { loadCsvTextLocal } = await import('./csvStorage');
    const text = await loadCsvTextLocal(key.slice('csv_text_'.length));
    return text === null ? null : packText(text);
  }
  return localStorage.getItem(key);
}

/** Alle vorgemerkten Änderungen zum Server schicken (seriell; bei Fehler später erneut) */
function flush(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    if (!inBrowser() || status === 'local') return;
    let p = pending();
    const keys = Object.keys(p);
    if (keys.length === 0) return;
    setStatus('syncing');
    let failed = false;
    for (const key of keys) {
      const { op, v } = p[key];
      try {
        let res: Response;
        if (op === 'del') {
          res = await fetch(`/api/store?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
          if (res.ok && key.startsWith('csv_text_')) setCsvStamps(key.slice('csv_text_'.length), null);
        } else {
          const value = await valueFor(key);
          if (value === null) { res = new Response(null, { status: 204 }); }
          else {
            res = await fetch('/api/store', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, value }) });
            if (res.ok && key.startsWith('csv_text_')) {
              const { updatedAt } = await res.json() as { updatedAt: string };
              setCsvStamps(key.slice('csv_text_'.length), updatedAt);
            }
          }
        }
        if (res.status === 503) { setStatus('local'); return; }
        if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
        p = pending();
        if (p[key]?.v === v) { delete p[key]; writeJson(PENDING_KEY, p); } // sonst kam inzwischen eine neuere Änderung
      } catch (e) {
        failed = true;
        lastError = e instanceof Error ? e.message : 'Fehler';
      }
    }
    if (failed) {
      setStatus('error');
      scheduleFlush(retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60000);
    } else {
      retryDelay = 3000;
      if (Object.keys(pending()).length) { setStatus('syncing'); scheduleFlush(50); } // während des Uploads kam Neues
      else setStatus('synced');
    }
  })().finally(() => { flushing = null; });
  return flushing;
}

// ── Einspielen des Serverstands ──
export interface HydratePlan {
  setLocal: { key: string; value: string }[];
  removeLocal: string[];
  upload: string[];
  /** Datensatz-IDs, deren CSV-Text nur lokal liegt und hochgeladen werden muss */
  csvUpload: string[];
  /** csv_text_<id> → updatedAt auf dem Server */
  csvRemote: Record<string, string>;
}

/** Reine Merge-Logik (testbar): lokaler Stand + Manifest → was tun */
export function planHydrate(local: Record<string, string>, m: StoreManifest, localCsvIds: string[]): HydratePlan {
  const tomb = new Set(m.tombstones.map(t => t.key));
  const server = new Map(m.items.map(i => [i.key, i.value] as const));
  const plan: HydratePlan = { setLocal: [], removeLocal: [], upload: [], csvUpload: [], csvRemote: {} };
  for (const [key, value] of server) if (local[key] !== value) plan.setLocal.push({ key, value });
  for (const key of Object.keys(local)) {
    if (server.has(key)) continue;
    if (tomb.has(key)) plan.removeLocal.push(key); else plan.upload.push(key);
  }
  for (const d of m.datasets) plan.csvRemote[d.key] = d.updatedAt;
  const removed = new Set(plan.removeLocal);
  for (const id of localCsvIds) {
    const key = `csv_text_${id}`;
    if (plan.csvRemote[key] || tomb.has(key) || removed.has(`csv_run_${id}`)) continue;
    if (local[`csv_run_${id}`] !== undefined || server.has(`csv_run_${id}`)) plan.csvUpload.push(id);
  }
  return plan;
}

function localShared(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isSharedKey(k) && !k.startsWith('csv_text_')) out[k] = localStorage.getItem(k) ?? '';
  }
  return out;
}

let hydratedOnce = false;
export const isHydrated = () => hydratedOnce;

/**
 * Serverstand holen und lokal einspielen. Erst werden eigene, noch nicht
 * hochgeladene Änderungen gesendet, dann gilt: Server gewinnt.
 */
export async function hydrate(): Promise<StoreStatus> {
  if (!inBrowser()) return status;
  try {
    if (status === 'local') setStatus('init');
    await flush();
    const res = await fetch('/api/store?manifest=1', { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const m = await res.json() as StoreManifest & { configured: boolean };
    if (!m.configured) { setStatus('local'); hydratedOnce = true; return status; }
    const { localCsvIds } = await import('./csvStorage');
    const plan = planHydrate(localShared(), m, await localCsvIds());
    for (const { key, value } of plan.setLocal) { try { localStorage.setItem(key, value); } catch {} }
    for (const key of plan.removeLocal) {
      try { localStorage.removeItem(key); } catch {}
      if (key.startsWith('csv_run_')) {
        const id = key.slice('csv_run_'.length);
        const { deleteCsvTextLocal } = await import('./csvStorage');
        await deleteCsvTextLocal(id).catch(() => {});
        for (const k of [`analysis_configs_${id}`, `analysis_hashes_${id}`]) { try { localStorage.removeItem(k); } catch {} }
      }
    }
    writeJson(CSV_REMOTE_KEY, plan.csvRemote);
    const p = pending();
    for (const key of plan.upload) p[key] = { op: 'set', v: 0 };
    for (const id of plan.csvUpload) p[`csv_text_${id}`] = { op: 'set', v: 0 };
    writeJson(PENDING_KEY, p);
    hydratedOnce = true;
    setStatus(Object.keys(p).length ? 'syncing' : 'synced');
    if (Object.keys(p).length) scheduleFlush(50);
    window.dispatchEvent(new Event(STORE_EVENT));
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'Fehler';
    hydratedOnce = true;
    setStatus('error');
    scheduleFlush(retryDelay);
  }
  return status;
}

/** Alles auf dem Server löschen (Einstellungen → Daten → Alles löschen) */
export async function wipeSharedStore(): Promise<boolean> {
  if (!inBrowser() || status === 'local') return false;
  try {
    const res = await fetch('/api/store?all=1', { method: 'DELETE' });
    writeJson(PENDING_KEY, {}); writeJson(CSV_REMOTE_KEY, {}); writeJson(CSV_LOCAL_KEY, {});
    return res.ok;
  } catch { return false; }
}
