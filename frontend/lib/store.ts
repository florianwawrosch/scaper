// Gemeinsamer Speicher (Browser-Seite): localStorage + IndexedDB bleiben der
// schnelle lokale Cache für alle synchronen Lesezugriffe; jede Änderung an
// geteilten Keys wird als «pending» gemerkt und an /api/store geschickt, beim
// Laden der App (und beim Zurückkehren in den Tab) wird der Serverstand
// eingespielt. Server gewinnt bei Konflikten; nur-lokale Einträge werden
// hochgeladen, serverseitig gelöschte (Tombstones) lokal entfernt.
// API-Keys und Anzeige-Einstellungen bleiben bewusst nur im Browser.

import type { StoreManifest } from './serverStore';
import { isLargeKey } from './storeKeys';

const SHARED_EXACT = ['user_presets', 'preset_flags', 'preset_overrides', 'presets', 'blocklist', 'usage_log'];
const SHARED_PREFIXES = ['csv_run_', 'analysis_configs_', 'analysis_hashes_', 'csv_text_'];
export const isSharedKey = (key: string) => SHARED_EXACT.includes(key) || SHARED_PREFIXES.some(p => key.startsWith(p));

export type StoreStatus = 'init' | 'local' | 'syncing' | 'synced' | 'error';

const PENDING_KEY   = 'lp_sync_pending';   // { key: { op, v } }
const REMOTE_KEY    = 'lp_csv_remote';     // { <großer Key>: updatedAt } — Stand auf dem Server
const LOCAL_KEY     = 'lp_csv_local';      // { <großer Key>: updatedAt } — Stand, den dieses Gerät hat
/** Größere Werte werden in Teilen hochgeladen (Vercel nimmt ~4,5 MB pro Request) */
export const PART_SIZE = 2_500_000;
const PARTS_HEADER = 'parts:';
export const STORE_EVENT = 'lp-store-updated';

/** Nur im echten Browser synchronisieren (Unit-Tests haben ein window-Shim, aber kein document) */
const inBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

let status: StoreStatus = 'init';
let lastError = '';
const listeners = new Set<(s: StoreStatus) => void>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushAt = 0;
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
/** Hat dieses Gerät für den Key eine noch nicht hochgeladene Änderung? */
export const hasPending = (key: string): boolean => !!pending()[key];

export const remoteStamp = (key: string): string | undefined => readJson<Record<string, string>>(REMOTE_KEY, {})[key];
export const localStamp  = (key: string): string | undefined => readJson<Record<string, string>>(LOCAL_KEY, {})[key];
/** Nach Upload/Download: dieses Gerät hat jetzt den Serverstand `updatedAt` (null = gelöscht) */
export function setStamps(key: string, updatedAt: string | null) {
  for (const k of [REMOTE_KEY, LOCAL_KEY]) {
    const m = readJson<Record<string, string>>(k, {});
    if (updatedAt) m[key] = updatedAt; else delete m[key];
    writeJson(k, m);
  }
}

/** Wert in Teile schneiden, wenn er zu groß für einen Request ist (reine Funktion, getestet) */
export function splitParts(value: string, size = PART_SIZE): { header: string; parts: string[] } | null {
  if (value.length <= size) return null;
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += size) parts.push(value.slice(i, i + size));
  return { header: `${PARTS_HEADER}${parts.length}`, parts };
}
export const partsCount = (value: string): number => (value.startsWith(PARTS_HEADER) ? Number(value.slice(PARTS_HEADER.length)) || 0 : 0);

async function getJson<T>(url: string, timeoutMs = 30000): Promise<T | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

/** Einen (evtl. geteilten) Wert vom Server lesen */
export async function fetchValue(key: string): Promise<{ value: string; updatedAt: string } | null> {
  const head = await getJson<{ value: string; updatedAt: string }>(`/api/store?key=${encodeURIComponent(key)}`);
  if (!head) return null;
  const n = partsCount(head.value);
  if (!n) return head;
  const parts = await Promise.all(Array.from({ length: n }, (_, i) => getJson<{ value: string }>(`/api/store?key=${encodeURIComponent(`${key}.p${i}`)}`)));
  if (parts.some(p => !p)) return null;
  return { value: parts.map(p => p!.value).join(''), updatedAt: head.updatedAt };
}

async function putValue(key: string, value: string): Promise<Response> {
  return fetch('/api/store', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, value }) });
}

/** Teile-Keys, die der Server (laut letztem Stand) für diesen Key hat */
const knownParts = (key: string): string[] => Object.keys(readJson<Record<string, string>>(REMOTE_KEY, {})).filter(k => k.startsWith(`${key}.p`));

const deleteKey = (key: string) => fetch(`/api/store?key=${encodeURIComponent(key)}`, { method: 'DELETE', signal: AbortSignal.timeout(30000) });
/** Teil löschen — Fehler sind hier nicht kritisch (verwaister Teil), Stempel trotzdem weg */
const deletePart = async (key: string) => { await deleteKey(key).catch(() => {}); setStamps(key, null); };

/**
 * Hochladen — nur große Keys (CSV-Text) werden in Teile geschnitten, denn nur
 * die liest fetchValue() wieder zusammen; alles andere geht in einem Stück.
 * Teile merken wir uns, damit Löschen und ein späterer kleinerer Upload keine
 * verwaisten Teile zurücklassen.
 */
async function uploadValue(key: string, value: string): Promise<Response> {
  const split = isLargeKey(key) ? splitParts(value) : null;
  const before = knownParts(key);
  if (!split) {
    const r = await putValue(key, value);
    if (r.ok) for (const k of before) await deletePart(k);
    return r;
  }
  const now = new Date().toISOString();
  const results = await Promise.all(split.parts.map((part, i) => putValue(`${key}.p${i}`, part)));
  const bad = results.find(r => !r.ok);
  if (bad) return bad;
  split.parts.forEach((_, i) => setStamps(`${key}.p${i}`, now));
  for (const k of before) if (Number(k.slice(`${key}.p`.length)) >= split.parts.length) await deletePart(k);
  return putValue(key, split.header);
}

/** Löschen — inkl. aller Teile, die der Server für diesen Key kennt */
async function deleteValue(key: string): Promise<Response> {
  for (const k of knownParts(key)) await deletePart(k);
  return deleteKey(key);
}

/**
 * Großen localStorage-Key (KI-Cache-Hashes) vor dem Lesen auf Serverstand
 * bringen — sonst würde ▶ nach einem Gerätewechsel alles neu klassifizieren.
 */
export async function ensureLocalKey(key: string): Promise<void> {
  if (!inBrowser() || status === 'local') return;
  const remote = remoteStamp(key);
  if (!remote || localStamp(key) === remote) return;
  if (pending()[key]) return; // eigene, noch nicht hochgeladene Änderung hat Vorrang
  try {
    const got = await fetchValue(key);
    if (!got) return;
    localStorage.setItem(key, got.value);
    setStamps(key, got.updatedAt);
  } catch {}
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
/** Upload planen — ein späterer Wunsch verschiebt einen schon geplanten früheren nie nach hinten */
function scheduleFlush(delay = 400) {
  if (!inBrowser() || status === 'local') return;
  if (status === 'error') delay = Math.max(delay, retryDelay); // Server-Probleme: Backoff einhalten
  const at = Date.now() + delay;
  if (flushTimer && at >= flushAt) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushAt = at;
  flushTimer = setTimeout(() => { flushTimer = null; flushAt = 0; void flush(); }, delay);
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
          res = await deleteValue(key);
          if (res.ok && isLargeKey(key)) setStamps(key, null);
        } else {
          const value = await valueFor(key);
          if (value === null) { res = new Response(null, { status: 204 }); }
          else {
            res = await uploadValue(key, value);
            if (res.ok && isLargeKey(key)) {
              const { updatedAt } = await res.json() as { updatedAt: string };
              setStamps(key, updatedAt);
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
  /** großer Key → updatedAt auf dem Server (CSV-Texte, Hashes, Teile) */
  remote: Record<string, string>;
}

/**
 * Reine Merge-Logik (testbar): lokaler Stand + Manifest → was tun. Kleine Keys:
 * Server gewinnt, nur-lokale hochladen, Tombstones lokal entfernen. Große Keys
 * (Hashes, CSV-Texte) werden nur nach Stand verglichen und bei Bedarf einzeln geladen.
 */
export function planHydrate(local: Record<string, string>, m: StoreManifest, localCsvIds: string[], pendingKeys: Set<string> = new Set()): HydratePlan {
  const tomb = new Set(m.tombstones.map(t => t.key));
  const server = new Map(m.items.map(i => [i.key, i.value] as const));
  const plan: HydratePlan = { setLocal: [], removeLocal: [], upload: [], csvUpload: [], remote: {} };
  for (const d of m.large) plan.remote[d.key] = d.updatedAt;
  // Eigene, noch nicht hochgeladene Änderungen haben Vorrang vor dem Serverstand
  for (const [key, value] of server) if (local[key] !== value && !pendingKeys.has(key)) plan.setLocal.push({ key, value });
  for (const key of Object.keys(local)) {
    if (server.has(key) || (isLargeKey(key) && plan.remote[key]) || pendingKeys.has(key)) continue;
    if (tomb.has(key)) plan.removeLocal.push(key); else plan.upload.push(key);
  }
  const removed = new Set(plan.removeLocal);
  for (const id of localCsvIds) {
    const key = `csv_text_${id}`;
    if (plan.remote[key] || tomb.has(key) || removed.has(`csv_run_${id}`)) continue;
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
    const plan = planHydrate(localShared(), m, await localCsvIds(), new Set(Object.keys(pending())));
    for (const { key, value } of plan.setLocal) { try { localStorage.setItem(key, value); } catch {} }
    for (const key of plan.removeLocal) {
      try { localStorage.removeItem(key); } catch {}
      if (key.startsWith('csv_run_')) {
        const id = key.slice('csv_run_'.length);
        const { deleteCsvTextLocal } = await import('./csvStorage');
        await deleteCsvTextLocal(id).catch(() => {});
        for (const k of [`analysis_configs_${id}`, `analysis_hashes_${id}`]) { try { localStorage.removeItem(k); } catch {} }
        setStamps(`csv_text_${id}`, null); setStamps(`analysis_hashes_${id}`, null);
      }
    }
    writeJson(REMOTE_KEY, plan.remote);
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
    // Serverstand später erneut holen (Backoff), eigene Änderungen bleiben vorgemerkt
    setTimeout(() => { if (status === 'error') void hydrate(); }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
  }
  return status;
}

/** Alles auf dem Server löschen (Einstellungen → Daten → Alles löschen) */
export async function wipeSharedStore(): Promise<boolean> {
  if (!inBrowser() || status === 'local') return false;
  try {
    const res = await fetch('/api/store?all=1', { method: 'DELETE' });
    writeJson(PENDING_KEY, {}); writeJson(REMOTE_KEY, {}); writeJson(LOCAL_KEY, {});
    return res.ok;
  } catch { return false; }
}
