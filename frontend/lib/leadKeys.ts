/**
 * Identität eines Leads über Datensätze hinweg. Aus einer Zeile werden
 * normalisierte Schlüssel gebildet (Meta-Seiten-ID, LinkedIn-URL, E-Mail,
 * notfalls Seitenname), damit dieselbe Seite/Person in einem späteren Scrape
 * wiedererkannt wird — ohne sie erneut zu enrichen oder anzuschreiben.
 */

/** Spalten, die der Abgleich in den Datensatz schreibt */
export const KNOWN_COL    = 'bekannt_aus';
export const EXPORTED_COL = 'exportiert_am';

const s = (v: unknown) => String(v ?? '').trim();

export function normalizeLinkedin(url: string): string {
  const u = url.trim().toLowerCase();
  if (!u) return '';
  return u
    .replace(/^https?:\/\//, '').replace(/^www\./, '')
    .replace(/[?#].*$/, '').replace(/\/+$/, '');
}

/** Schlüssel einer Zeile, stärkste zuerst. Leer, wenn nichts Identifizierendes da ist. */
export function leadKeys(row: Record<string, unknown>): string[] {
  const keys: string[] = [];
  const pageId = s(row.page_id);
  if (pageId) keys.push(`page:${pageId}`);
  const li = normalizeLinkedin(s(row.linkedin_url ?? row.linkedin ?? row.profil_url ?? row.linkedin_profile));
  if (li) keys.push(`li:${li}`);
  for (const col of ['email_enriched', 'email', 'e_mail', 'email_address', 'mail']) {
    const e = s(row[col]).toLowerCase();
    if (e && e.includes('@')) { keys.push(`email:${e}`); break; }
  }
  // Seitenname nur als Rückfall ohne Seiten-ID (gleicher Name ≠ sicher gleiche Seite)
  if (!pageId) {
    const name = s(row.page_name).toLowerCase();
    if (name) keys.push(`name:${name}`);
  }
  return keys;
}

export interface KnownEntry { datasetId: string; filename: string; exportedAt: string }

/**
 * Zeilen gegen einen Index bekannter Leads abgleichen. Liefert je Zeile die
 * Herkunft (Dateiname des ältesten Treffers, '' = neu) und ein übernommenes
 * Export-Datum, falls derselbe Lead anderswo schon exportiert wurde.
 */
export function matchKnown(
  rows: Record<string, unknown>[],
  index: Map<string, KnownEntry>,
): { knownFrom: string[]; exportedAt: string[]; known: number; exported: number } {
  const knownFrom: string[] = [];
  const exportedAt: string[] = [];
  let known = 0, exported = 0;
  for (const row of rows) {
    let from = '';
    let exp = s(row[EXPORTED_COL]);
    for (const k of leadKeys(row)) {
      const hit = index.get(k);
      if (!hit) continue;
      if (!from) from = hit.filename;
      if (!exp && hit.exportedAt) exp = hit.exportedAt;
    }
    if (from) known++;
    if (exp) exported++;
    knownFrom.push(from);
    exportedAt.push(exp);
  }
  return { knownFrom, exportedAt, known, exported };
}

/** Index aus fremden Datensätzen aufbauen (älteste zuerst → deren Name gewinnt) */
export function addToIndex(index: Map<string, KnownEntry>, rows: Record<string, unknown>[], entry: Omit<KnownEntry, 'exportedAt'>): void {
  for (const row of rows) {
    const exportedAt = s(row[EXPORTED_COL]);
    for (const k of leadKeys(row)) {
      const cur = index.get(k);
      if (!cur) index.set(k, { ...entry, exportedAt });
      else if (!cur.exportedAt && exportedAt) cur.exportedAt = exportedAt;
    }
  }
}
