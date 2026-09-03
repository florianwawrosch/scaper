/**
 * Spalten-Vorschläge für das Enrichment: welche Spalte des Datensatzes
 * Name, Firma/Domain und LinkedIn-URL enthält. Reihenfolge = Priorität,
 * exakter Treffer vor Teil-Treffer (z.B. «voller_name» vor «page_name»).
 */
export const NAME_CANDIDATES     = ['voller_name', 'name', 'full_name', 'vollername', 'vorname_nachname', 'kontakt', 'ansprechpartner', 'person', 'page_name', 'first_name', 'vorname'];
export const COMPANY_CANDIDATES  = ['firma', 'company', 'unternehmen', 'company_domain', 'domain', 'website', 'webseite', 'url', 'page_name', 'organisation', 'organization'];
export const LINKEDIN_CANDIDATES = ['linkedin_url', 'linkedin', 'profil_url', 'profile_url', 'linkedin_profile', 'url'];

export function pickColumn(columns: string[], candidates: string[]): string {
  const lower = columns.map(c => c.toLowerCase());
  for (const cand of candidates) { const i = lower.indexOf(cand); if (i >= 0) return columns[i]; }
  for (const cand of candidates) { const i = lower.findIndex(c => c.includes(cand)); if (i >= 0) return columns[i]; }
  return '';
}

/** Erster nicht-leerer Wert einer Spalte — als Beispiel neben dem Dropdown */
export function sampleValue(rows: Record<string, string>[], col: string): string {
  if (!col) return '';
  const hit = rows.find(r => String(r[col] ?? '').trim());
  return hit ? String(hit[col]).trim() : '';
}
