import Papa from 'papaparse';
import { loadCsvText, saveCsvText } from './csvStorage';

export interface CsvRunMeta {
  fields: string[];
  filename: string;
  createdAt: string;
  rowCount?: number;
  backendRunId?: string;
  scrapeConfig?: Record<string, unknown>;
  // legacy formats stored data/csv inline in localStorage
  data?: Record<string, string>[];
  csv?: string;
}

export interface LoadedCsvRun {
  meta: CsvRunMeta;
  rows: Record<string, string>[];
}

/**
 * Neuen Datensatz anlegen (Scrape-Ergebnis oder Import): CSV-Text nach
 * IndexedDB, Meta nach localStorage. Liefert die Run-ID für /csv/<id>.
 */
export async function createCsvRun(input: {
  filename: string;
  fields: string[];
  csvText: string;
  rowCount: number;
  scrapeConfig?: Record<string, unknown>;
}): Promise<string> {
  const id = `csv_${Date.now()}`;
  await saveCsvText(id, input.csvText);
  const meta: CsvRunMeta = {
    fields: input.fields,
    filename: input.filename,
    createdAt: new Date().toISOString(),
    rowCount: input.rowCount,
    ...(input.scrapeConfig && { scrapeConfig: input.scrapeConfig }),
  };
  localStorage.setItem(`csv_run_${id}`, JSON.stringify(meta));
  return id;
}

/**
 * Load a stored CSV run (scrape result or import) by id.
 * Handles all three storage formats: parsed rows inline (legacy A),
 * raw CSV text inline (legacy B), raw CSV text in IndexedDB (current).
 * Throws with a German message when the run cannot be loaded.
 */
export async function loadCsvRun(id: string): Promise<LoadedCsvRun> {
  const raw = localStorage.getItem(`csv_run_${id}`);
  if (!raw) throw new Error('Datei nicht gefunden. Bitte erneut hochladen.');
  const meta: CsvRunMeta = JSON.parse(raw);

  if (meta.data) return { meta, rows: meta.data };

  const text = meta.csv ?? await loadCsvText(id);
  if (!text) throw new Error('Datei nicht gefunden. Bitte erneut hochladen.');

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: results => resolve({ meta, rows: results.data }),
      error: () => reject(new Error('CSV konnte nicht gelesen werden.')),
    });
  });
}

/**
 * Write half of the store: merge one or more columns into the rows, persist
 * the CSV to IndexedDB and refresh the localStorage meta. Drops the legacy
 * inline data/csv fields so the freshly written IndexedDB CSV wins on reload
 * — that invariant lives HERE, next to the loader that knows the formats.
 * Returns the merged rows so callers can update their state from them.
 */
export async function saveCsvRunColumns(
  id: string,
  rows: Record<string, string>[],
  cols: Record<string, string[]>,
): Promise<Record<string, string>[]> {
  const entries = Object.entries(cols);
  const merged = rows.map((r, i) => {
    const extra: Record<string, string> = {};
    for (const [n, v] of entries) extra[n] = v[i] ?? String(r[n] ?? '');
    return { ...r, ...extra };
  });
  await saveCsvText(id, Papa.unparse(merged));
  const raw = localStorage.getItem(`csv_run_${id}`);
  if (raw) {
    const m: CsvRunMeta = JSON.parse(raw);
    delete m.data; delete m.csv;
    const fields = [...m.fields];
    for (const n of Object.keys(cols)) if (!fields.includes(n)) fields.push(n);
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ ...m, fields, rowCount: merged.length }));
  }
  return merged;
}
