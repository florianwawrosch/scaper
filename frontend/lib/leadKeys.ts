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

export interface KnownEntry { datasetId: string; filename: string; exportedAt: string; email: string; phone: string }

export const EMAIL_COL = 'email_enriched';
export const PHONE_COL = 'phone_enriched';

export interface MatchResult {
  knownFrom: string[];
  exportedAt: string[];
  /** email_enriched / phone_enriched je Zeile — eigener Wert oder aus dem Index übernommen */
  email: string[];
  phone: string[];
  known: number;
  exported: number;
  /** Anzahl übernommener E-Mails/Telefonnummern (waren hier leer, anderswo bekannt) */
  emailsCopied: number;
  phonesCopied: number;
}

/**
 * Zeilen gegen einen Index bekannter Leads abgleichen. Liefert je Zeile die
 * Herkunft (Dateiname des ältesten Treffers, '' = neu), ein übernommenes
 * Export-Datum sowie E-Mail/Telefon, falls derselbe Lead anderswo schon
 * enricht wurde — spart erneute Anbieter-Credits.
 */
export function matchKnown(rows: Record<string, unknown>[], index: Map<string, KnownEntry>): MatchResult {
  const knownFrom: string[] = [], exportedAt: string[] = [], email: string[] = [], phone: string[] = [];
  let known = 0, exported = 0, emailsCopied = 0, phonesCopied = 0;
  for (const row of rows) {
    let from = '';
    let exp = s(row[EXPORTED_COL]);
    let em = s(row[EMAIL_COL]);
    let ph = s(row[PHONE_COL]);
    const hadEmail = !!em, hadPhone = !!ph;
    for (const k of leadKeys(row)) {
      const hit = index.get(k);
      if (!hit) continue;
      if (!from) from = hit.filename;
      if (!exp && hit.exportedAt) exp = hit.exportedAt;
      if (!em && hit.email) em = hit.email;
      if (!ph && hit.phone) ph = hit.phone;
    }
    if (from) known++;
    if (exp) exported++;
    if (!hadEmail && em) emailsCopied++;
    if (!hadPhone && ph) phonesCopied++;
    knownFrom.push(from); exportedAt.push(exp); email.push(em); phone.push(ph);
  }
  return { knownFrom, exportedAt, email, phone, known, exported, emailsCopied, phonesCopied };
}

/** Index aus fremden Datensätzen aufbauen (älteste zuerst → deren Name gewinnt) */
export function addToIndex(index: Map<string, KnownEntry>, rows: Record<string, unknown>[], entry: Pick<KnownEntry, 'datasetId' | 'filename'>): void {
  for (const row of rows) {
    const exportedAt = s(row[EXPORTED_COL]);
    const email = s(row[EMAIL_COL]);
    const phone = s(row[PHONE_COL]);
    for (const k of leadKeys(row)) {
      const cur = index.get(k);
      if (!cur) { index.set(k, { ...entry, exportedAt, email, phone }); continue; }
      if (!cur.exportedAt && exportedAt) cur.exportedAt = exportedAt;
      if (!cur.email && email) cur.email = email;
      if (!cur.phone && phone) cur.phone = phone;
    }
  }
}
