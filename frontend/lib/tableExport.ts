import { downloadBlob } from './download';

/**
 * Browser-Downloads für Tabellen-Exporte. Die xlsx-Bibliothek wird erst beim
 * Klick nachgeladen — sie ist groß und die meisten Seitenaufrufe exportieren nie.
 */

/** CSV mit BOM (Excel erkennt UTF-8), alle Werte gequotet */
export function downloadCsv(filename: string, cols: string[], rows: Record<string, unknown>[]): void {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = cols.map(esc).join(',');
  const lines = rows.map(row => cols.map(c => esc(String(row[c] ?? ''))).join(','));
  const csv = '\ufeff' + [header, ...lines].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

/** Excel-Arbeitsmappe mit einem Blatt «Daten», Spaltenbreite 22 */
export async function downloadXlsx(filename: string, cols: string[], rows: Record<string, unknown>[]): Promise<void> {
  const XLSX = await import('xlsx');
  const data = rows.map(row => {
    const o: Record<string, unknown> = {};
    for (const c of cols) o[c] = row[c] ?? '';
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = cols.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daten');
  XLSX.writeFile(wb, filename);
}

/** Dateiname-tauglich: «Meta: fitness coaching» → «fitness-coaching», «leads.csv» → «leads» */
export function exportSlug(name?: string): string {
  const s = (name ?? '').replace(/^meta:\s*/i, '').replace(/\.(csv|xlsx?)$/i, '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s || 'export';
}
