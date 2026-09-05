import { loadCsvText, saveCsvText, deleteCsvText } from './csvStorage';
import { lsSet, wipeSharedStore, isSharedKey } from './store';

/**
 * Backup & Wiederherstellung aller lokalen Daten: Datensätze (Meta in
 * localStorage + CSV-Text in IndexedDB), KI-Spalten-Konfigurationen und
 * -Caches, Vorlagen, gespeicherte Suchen, Blockliste. API-Keys sind NIE
 * Teil eines Backups — sie verlassen den Browser nicht.
 * Alles liegt nur im Browser dieses Geräts — ohne Backup ist es bei einem
 * Browser-Reset oder Gerätewechsel weg.
 */

export interface BackupFile {
  app: 'lead-pipeline';
  version: 1;
  createdAt: string;
  /** localStorage-Einträge (Metadaten, Configs, Vorlagen, …) */
  localStorage: Record<string, string>;
  /** CSV-Text je Datensatz-ID (IndexedDB) */
  csv: Record<string, string>;
}

const DATASET_PREFIX = 'csv_run_';
const LS_PREFIXES = [DATASET_PREFIX, 'analysis_configs_', 'analysis_hashes_'];
const LS_KEYS = ['user_presets', 'preset_flags', 'preset_overrides', 'presets', 'blocklist'];
const SETTINGS_KEY = 'appSettings';

function ownKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (LS_KEYS.includes(k) || LS_PREFIXES.some(p => k.startsWith(p))) keys.push(k);
  }
  return keys;
}

const datasetIds = (): string[] =>
  ownKeys().filter(k => k.startsWith(DATASET_PREFIX)).map(k => k.slice(DATASET_PREFIX.length));

export interface Summary {
  datasets: number;
  rows: number;
  templates: number;
  searches: number;
  blocklist: number;
}

function summarize(ls: Record<string, string>): Summary {
  let datasets = 0, rows = 0;
  for (const [k, v] of Object.entries(ls)) {
    if (!k.startsWith(DATASET_PREFIX)) continue;
    datasets++;
    try { rows += Number(JSON.parse(v).rowCount) || 0; } catch {}
  }
  const count = (k: string) => { try { const v = JSON.parse(ls[k] ?? 'null'); return Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0; } catch { return 0; } };
  return { datasets, rows, templates: count('user_presets'), searches: count('presets'), blocklist: count('blocklist') };
}

/** Aktueller Bestand im Browser */
export async function storageStats(): Promise<Summary & { usedBytes?: number; quotaBytes?: number }> {
  const ls: Record<string, string> = {};
  for (const k of [...ownKeys(), SETTINGS_KEY]) { const v = localStorage.getItem(k); if (v !== null) ls[k] = v; }
  const out: Summary & { usedBytes?: number; quotaBytes?: number } = summarize(ls);
  try {
    const est = await navigator.storage?.estimate?.();
    if (est) { out.usedBytes = est.usage; out.quotaBytes = est.quota; }
  } catch {}
  return out;
}

export async function buildBackup(): Promise<BackupFile> {
  const ls: Record<string, string> = {};
  for (const k of ownKeys()) { const v = localStorage.getItem(k); if (v !== null) ls[k] = v; }
  // Einstellungen ohne API-Keys (Backup-Datei ist Klartext)
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    ls[SETTINGS_KEY] = JSON.stringify({ ...settings, apiKeys: {} });
  } catch {}
  const csv: Record<string, string> = {};
  for (const id of datasetIds()) {
    const text = await loadCsvText(id);
    if (text !== null) csv[id] = text;
  }
  return { app: 'lead-pipeline', version: 1, createdAt: new Date().toISOString(), localStorage: ls, csv };
}

export function backupFilename(): string {
  return `lead-pipeline-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export function parseBackup(text: string): BackupFile {
  let b: unknown;
  try { b = JSON.parse(text); } catch { throw new Error('Keine gültige JSON-Datei.'); }
  const f = b as Partial<BackupFile>;
  if (!f || f.app !== 'lead-pipeline' || f.version !== 1 || typeof f.localStorage !== 'object' || typeof f.csv !== 'object') {
    throw new Error('Das ist kein Lead-Pipeline-Backup.');
  }
  return f as BackupFile;
}

export const summarizeBackup = (b: BackupFile): Summary => summarize(b.localStorage);

export interface RestoreResult { datasets: number; skipped: number; entries: number }

/**
 * Backup einspielen. overwrite=false: vorhandene Datensätze/Einträge bleiben
 * (nur Neues kommt dazu), overwrite=true: Backup gewinnt. Die API-Keys des
 * Browsers bleiben immer unangetastet — auch wenn eine (alte) Datei welche enthält.
 */
export async function restoreBackup(b: BackupFile, opts: { overwrite: boolean }): Promise<RestoreResult> {
  let datasets = 0, skipped = 0, entries = 0;
  for (const [k, v] of Object.entries(b.localStorage)) {
    const isDataset = k.startsWith(DATASET_PREFIX);
    if (k === SETTINGS_KEY) {
      try {
        const incoming = JSON.parse(v);
        const current = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...incoming, apiKeys: current.apiKeys ?? {} }));
        entries++;
      } catch {}
      continue;
    }
    if (!opts.overwrite && localStorage.getItem(k) !== null) { if (isDataset) skipped++; continue; }
    if (isSharedKey(k)) lsSet(k, v); else localStorage.setItem(k, v);
    entries++;
    if (isDataset) {
      const id = k.slice(DATASET_PREFIX.length);
      const text = b.csv[id];
      if (text !== undefined) await saveCsvText(id, text);
      datasets++;
    }
  }
  return { datasets, skipped, entries };
}

/**
 * Alles löschen — Datensätze, Configs, KI-Spalten, Suchen, Blockliste, Einstellungen
 * (inkl. Keys) in diesem Browser UND im gemeinsamen Speicher (für alle Kollegen).
 */
export async function wipeLocalData(): Promise<void> {
  await wipeSharedStore();
  for (const id of datasetIds()) { try { await deleteCsvText(id); } catch {} }
  for (const k of [...ownKeys(), SETTINGS_KEY, 'lp_sync_pending', 'lp_csv_remote', 'lp_csv_local']) localStorage.removeItem(k);
}
