// Gemeinsamer Speicher (Server): ein Key-Value-Store für alles, was alle
// Kollegen sehen sollen — Datensätze (Meta + CSV-Text), KI-Configs, gespeicherte
// KI-Spalten, Suchen, Blockliste. Treiber: Postgres (Neon, DATABASE_URL) in
// Produktion, Dateien unter .data/ in der Entwicklung. Löschungen bleiben als
// Tombstone stehen, damit ein Gerät mit altem Stand sie nicht wieder hochlädt.

import { promises as fs } from 'fs';
import path from 'path';

export interface StoreItem { key: string; value: string; updatedAt: string }
export interface StoreTombstone { key: string; deletedAt: string }
export interface StoreManifest {
  /** Kleine Einträge (alles außer CSV-Text) mit Wert */
  items: StoreItem[];
  /** CSV-Texte nur als Liste (Key + Stand) — werden einzeln geladen */
  datasets: { key: string; updatedAt: string }[];
  tombstones: StoreTombstone[];
}

/** CSV-Text-Keys sind groß und werden nicht im Manifest mitgeschickt */
const CSV_TEXT_PREFIX = 'csv_text_';
const isCsvTextKey = (key: string) => key.startsWith(CSV_TEXT_PREFIX);

export interface StoreDriver {
  name: string;
  manifest(): Promise<StoreManifest>;
  get(key: string): Promise<StoreItem | null>;
  set(key: string, value: string): Promise<string>;
  del(key: string): Promise<string>;
  /** Alles löschen — inkl. Tombstones (Neustart) */
  wipe(): Promise<void>;
}

const KEY_RE = /^[A-Za-z0-9_.:-]{1,200}$/;
export const isValidKey = (key: string) => KEY_RE.test(key);

// ── Datei-Treiber (Entwicklung / Tests): eine JSON-Datei je Key ──
interface FileRecord { value: string; updatedAt: string; deleted?: boolean }

export function fileDriver(dir: string): StoreDriver {
  const file = (key: string) => path.join(dir, `${encodeURIComponent(key)}.json`);
  const readAll = async (): Promise<Map<string, FileRecord>> => {
    const out = new Map<string, FileRecord>();
    let names: string[] = [];
    try { names = await fs.readdir(dir); } catch { return out; }
    for (const n of names) {
      if (!n.endsWith('.json')) continue;
      try { out.set(decodeURIComponent(n.slice(0, -5)), JSON.parse(await fs.readFile(path.join(dir, n), 'utf8'))); } catch {}
    }
    return out;
  };
  const write = async (key: string, rec: FileRecord) => {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file(key), JSON.stringify(rec));
  };
  return {
    name: 'file',
    async manifest() {
      const all = await readAll();
      const m: StoreManifest = { items: [], datasets: [], tombstones: [] };
      for (const [key, r] of all) {
        if (r.deleted) m.tombstones.push({ key, deletedAt: r.updatedAt });
        else if (isCsvTextKey(key)) m.datasets.push({ key, updatedAt: r.updatedAt });
        else m.items.push({ key, value: r.value, updatedAt: r.updatedAt });
      }
      return m;
    },
    async get(key) {
      try {
        const r: FileRecord = JSON.parse(await fs.readFile(file(key), 'utf8'));
        return r.deleted ? null : { key, value: r.value, updatedAt: r.updatedAt };
      } catch { return null; }
    },
    async set(key, value) {
      const updatedAt = new Date().toISOString();
      await write(key, { value, updatedAt });
      return updatedAt;
    },
    async del(key) {
      const updatedAt = new Date().toISOString();
      await write(key, { value: '', updatedAt, deleted: true });
      return updatedAt;
    },
    async wipe() { await fs.rm(dir, { recursive: true, force: true }); },
  };
}

// ── Postgres-Treiber (Neon über HTTP — passt zu Vercel Functions) ──
type Sql = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<Record<string, unknown>[]>;
let pgReady: Promise<Sql> | null = null;

async function pgSql(url: string): Promise<Sql> {
  if (!pgReady) {
    pgReady = (async () => {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(url) as unknown as Sql;
      await sql`CREATE TABLE IF NOT EXISTS lp_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted BOOLEAN NOT NULL DEFAULT false
      )`;
      return sql;
    })().catch(e => { pgReady = null; throw e; });
  }
  return pgReady;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

function postgresDriver(url: string): StoreDriver {
  return {
    name: 'postgres',
    async manifest() {
      const sql = await pgSql(url);
      const rows = await sql`SELECT key, CASE WHEN key LIKE ${CSV_TEXT_PREFIX + '%'} THEN '' ELSE value END AS value, updated_at, deleted FROM lp_store`;
      const m: StoreManifest = { items: [], datasets: [], tombstones: [] };
      for (const r of rows) {
        const key = String(r.key), updatedAt = iso(r.updated_at);
        if (r.deleted) m.tombstones.push({ key, deletedAt: updatedAt });
        else if (isCsvTextKey(key)) m.datasets.push({ key, updatedAt });
        else m.items.push({ key, value: String(r.value ?? ''), updatedAt });
      }
      return m;
    },
    async get(key) {
      const sql = await pgSql(url);
      const rows = await sql`SELECT value, updated_at FROM lp_store WHERE key = ${key} AND NOT deleted`;
      return rows[0] ? { key, value: String(rows[0].value ?? ''), updatedAt: iso(rows[0].updated_at) } : null;
    },
    async set(key, value) {
      const sql = await pgSql(url);
      const rows = await sql`INSERT INTO lp_store (key, value, updated_at, deleted) VALUES (${key}, ${value}, now(), false)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), deleted = false RETURNING updated_at`;
      return iso(rows[0]?.updated_at ?? new Date());
    },
    async del(key) {
      const sql = await pgSql(url);
      const rows = await sql`INSERT INTO lp_store (key, value, updated_at, deleted) VALUES (${key}, '', now(), true)
        ON CONFLICT (key) DO UPDATE SET value = '', updated_at = now(), deleted = true RETURNING updated_at`;
      return iso(rows[0]?.updated_at ?? new Date());
    },
    async wipe() {
      const sql = await pgSql(url);
      await sql`DELETE FROM lp_store`;
    },
  };
}

/**
 * Treiber nach Umgebung: Postgres, wenn DATABASE_URL/POSTGRES_URL gesetzt ist
 * (Vercel → Storage → Neon), sonst Dateien (Entwicklung; `ns` trennt
 * Testläufe), in Produktion ohne Datenbank: null = nur lokal.
 */
export function getStoreDriver(ns?: string): StoreDriver | null {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) return postgresDriver(url);
  const dir = process.env.LP_STORE_DIR || (process.env.NODE_ENV !== 'production' ? path.join(process.cwd(), '.data', 'store') : '');
  if (!dir) return null;
  const safeNs = ns && /^[A-Za-z0-9_-]{1,40}$/.test(ns) ? ns : '';
  return fileDriver(safeNs ? path.join(dir, safeNs) : dir);
}
