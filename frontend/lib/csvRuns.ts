import Papa from 'papaparse';
import { loadCsvText } from './csvStorage';

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
