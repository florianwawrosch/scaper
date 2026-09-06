import { lsSet, lsRemove, hydrate } from './store';

/**
 * Papierkorb: gelöschte Datensätze bleiben 30 Tage als Tombstone MIT Wert auf
 * dem Server (Wiederherstellen = Tombstone aufheben). Kleine Einträge, die
 * nur einen Teil eines Keys ausmachen (eine gespeicherte Suche, eine KI-Spalte,
 * ein Blocklisten-Eintrag), landen beim Löschen als Kopie in `trash_items`.
 */
export const TRASH_DAYS = 30;
const ITEMS_KEY = 'trash_items';
const MAX_ITEMS = 100;

export type TrashKind = 'search' | 'ki' | 'block';
export interface TrashItem { id: string; kind: TrashKind; label: string; payload: unknown; deletedAt: string }
export interface TrashDataset { id: string; filename: string; rowCount: number; deletedAt: string }

const fresh = (iso: string, now: number) => now - Date.parse(iso) < TRASH_DAYS * 86_400_000;

const readItems = (): TrashItem[] => {
  try {
    const arr = JSON.parse(localStorage.getItem(ITEMS_KEY) ?? '[]');
    return Array.isArray(arr) ? arr.filter(e => e && typeof e.id === 'string' && typeof e.deletedAt === 'string') : [];
  } catch { return []; }
};

/** Gelöschte Kleineinträge, neueste zuerst (ältere als 30 Tage fallen weg) */
export function loadTrashItems(now = Date.now()): TrashItem[] {
  return readItems().filter(e => fresh(e.deletedAt, now)).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export function trashPut(kind: TrashKind, label: string, payload: unknown, now = Date.now()): TrashItem {
  const item: TrashItem = { id: `t_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`, kind, label, payload, deletedAt: new Date(now).toISOString() };
  const next = [...readItems().filter(e => fresh(e.deletedAt, now)), item].slice(-MAX_ITEMS);
  lsSet(ITEMS_KEY, JSON.stringify(next));
  return item;
}

export function removeTrashItem(id: string): void {
  const rest = readItems().filter(e => e.id !== id);
  if (rest.length) lsSet(ITEMS_KEY, JSON.stringify(rest)); else lsRemove(ITEMS_KEY);
}

export const clearTrashItems = () => lsRemove(ITEMS_KEY);

/** Die vier Keys eines Datensatzes im gemeinsamen Speicher */
const datasetKeys = (id: string) => [`csv_run_${id}`, `csv_text_${id}`, `analysis_configs_${id}`, `analysis_hashes_${id}`];

/** Gelöschte Datensätze auf dem Server (nur mit Datenbank; sonst leer) */
export async function fetchTrashDatasets(): Promise<TrashDataset[]> {
  try {
    const res = await fetch('/api/store?trash=1', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const { entries } = await res.json() as { entries: { key: string; value: string; deletedAt: string }[] };
    const out: TrashDataset[] = [];
    for (const e of entries ?? []) {
      if (!e.key.startsWith('csv_run_')) continue;
      let filename = '', rowCount = 0;
      try { const m = JSON.parse(e.value); filename = String(m.filename ?? ''); rowCount = Number(m.rowCount) || 0; } catch {}
      out.push({ id: e.key.slice('csv_run_'.length), filename: filename || e.key, rowCount, deletedAt: e.deletedAt });
    }
    return out.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  } catch { return []; }
}

/** Datensatz zurückholen: Tombstones aufheben, dann den Serverstand einspielen */
export async function restoreDataset(id: string): Promise<boolean> {
  try {
    const res = await fetch('/api/store', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restore: datasetKeys(id) }) });
    if (!res.ok) return false;
    const { restored } = await res.json() as { restored: { key: string }[] };
    if (!restored?.some(r => r.key === `csv_run_${id}`)) return false;
    await hydrate();
    return true;
  } catch { return false; }
}

/** Papierkorb endgültig leeren — Server-Tombstones und Kleineinträge */
export async function purgeTrash(): Promise<boolean> {
  clearTrashItems();
  try {
    const res = await fetch('/api/store?purge=1', { method: 'DELETE' });
    return res.ok;
  } catch { return false; }
}
