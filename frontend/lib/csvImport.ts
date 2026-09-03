import Papa from 'papaparse';

export interface ParsedImport {
  fields: string[];
  /** Normalisierter CSV-Text (Excel wird nach CSV konvertiert) */
  csvText: string;
  rowCount: number;
}

export const IMPORT_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

export function isImportFile(name: string): boolean {
  const n = name.toLowerCase();
  return IMPORT_EXTENSIONS.some(ext => n.endsWith(ext));
}

function readAs(file: File, mode: 'text' | 'buffer'): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.onload = e => resolve(e.target?.result as string | ArrayBuffer);
    if (mode === 'buffer') reader.readAsArrayBuffer(file); else reader.readAsText(file, 'UTF-8');
  });
}

/**
 * CSV- oder Excel-Datei in Spalten + CSV-Text umwandeln (Excel: erstes Blatt).
 * Wirft mit deutscher Meldung, wenn die Datei nicht lesbar ist.
 */
export async function parseImportFile(file: File): Promise<ParsedImport> {
  if (/\.xlsx?$/i.test(file.name)) {
    // Excel is binary — read as ArrayBuffer, convert to rows via the xlsx lib
    const buf = await readAs(file, 'buffer') as ArrayBuffer;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
      const fields = rows.length ? Object.keys(rows[0]) : [];
      return { fields, csvText: Papa.unparse(rows), rowCount: rows.length };
    } catch (err) {
      throw new Error(`Excel-Datei konnte nicht gelesen werden: ${err instanceof Error ? err.message : ''}`);
    }
  }
  const rawText = await readAs(file, 'text') as string;
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(rawText, {
      header: true,
      skipEmptyLines: true,
      complete: results => resolve({ fields: results.meta.fields ?? [], csvText: rawText, rowCount: results.data.length }),
      error: (err: Error) => reject(new Error(`CSV konnte nicht gelesen werden: ${err.message}`)),
    });
  });
}
