// Outreach-Export: aus dem vollen Datensatz die Zeilen, die tatsächlich in
// eine Cold-Email-Kampagne gehen (Zielgruppe + gefundene E-Mail), auf die
// Spaltennamen gebracht, die Smartlead/Instantly/Lemlist beim CSV-Import
// direkt zuordnen — plus ein paar Kontextspalten als Personalisierungs-
// Variablen ({{themenfeld}}, {{headline}} …). Reine Funktion, kein DOM.

type Row = Record<string, unknown>;

export interface OutreachOptions {
  /** Regel-Spalte + Trefferwert, z.B. { column: 'ki_zielgruppe', value: 'ja' } */
  audience?: { column: string; value: string } | null;
  /** Nur Zeilen mit E-Mail exportieren (Standard: ja — ohne E-Mail keine Kampagne) */
  requireEmail?: boolean;
}

export interface OutreachResult {
  columns: string[];
  rows: Record<string, string>[];
  /** Warum Zeilen rausgefallen sind — für den Toast */
  dropped: { noEmail: number; notAudience: number };
  emailColumn: string | null;
}

const EMAIL_COLUMNS   = ['email_enriched', 'email', 'e_mail', 'email_address', 'mail'];
const NAME_COLUMNS    = ['voller_name', 'name', 'full_name', 'vollername', 'page_name'];
const FIRST_COLUMNS   = ['vorname', 'first_name', 'firstname'];
const LAST_COLUMNS    = ['nachname', 'last_name', 'lastname'];
const COMPANY_COLUMNS = ['firma', 'company', 'company_name', 'unternehmen', 'page_name'];
const WEBSITE_COLUMNS = ['website', 'domain', 'company_domain', 'url'];
const LINKEDIN_COLS   = ['linkedin_url', 'linkedin', 'linkedin_profile', 'profil_url'];
const PHONE_COLUMNS   = ['phone_enriched', 'phone', 'telefon', 'mobile', 'handy', 'phone_number'];

/** Zusätzliche Spalten, 1:1 übernommen wenn vorhanden — Personalisierung im Template */
const CONTEXT_COLUMNS: [source: string, target: string][] = [
  ['headline',        'headline'],
  ['jobtitel',        'job_title'],
  ['ki_themenfeld',   'themenfeld'],
  ['ki_haupttyp',     'haupttyp'],
  ['ki_sicherheit',   'ki_sicherheit'],
  ['quelle_person',   'quelle'],
  ['erster_autor',    'quelle'],
];

const str = (v: unknown) => (v == null ? '' : String(v)).trim();

/** Erste vorhandene Spalte aus einer Kandidatenliste (case-insensitiv). */
export function findColumn(fields: string[], candidates: string[]): string | null {
  const lower = new Map(fields.map(f => [f.toLowerCase(), f]));
  for (const c of candidates) { const hit = lower.get(c); if (hit) return hit; }
  return null;
}

/** "Max Mustermann" → { first: "Max", last: "Mustermann" }; ein Wort → nur first. */
export function splitName(full: string): { first: string; last: string } {
  const parts = str(full).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

export function buildOutreachExport(rows: Row[], fields: string[], opts: OutreachOptions = {}): OutreachResult {
  const requireEmail = opts.requireEmail ?? true;
  const emailCol   = findColumn(fields, EMAIL_COLUMNS);
  const nameCol    = findColumn(fields, NAME_COLUMNS);
  const firstCol   = findColumn(fields, FIRST_COLUMNS);
  const lastCol    = findColumn(fields, LAST_COLUMNS);
  const companyCol = findColumn(fields, COMPANY_COLUMNS);
  const websiteCol = findColumn(fields, WEBSITE_COLUMNS);
  const liCol      = findColumn(fields, LINKEDIN_COLS);
  const phoneCol   = findColumn(fields, PHONE_COLUMNS);
  const context = CONTEXT_COLUMNS
    .map(([src, dst]) => [findColumn(fields, [src]), dst] as const)
    .filter((e): e is readonly [string, string] => !!e[0]);
  // Gleiche Zielspalte nur einmal (quelle_person vs. erster_autor)
  const seenTargets = new Set<string>();
  const contextCols = context.filter(([, dst]) => !seenTargets.has(dst) && seenTargets.add(dst));

  const dropped = { noEmail: 0, notAudience: 0 };
  const out: Record<string, string>[] = [];

  for (const r of rows) {
    if (opts.audience && str(r[opts.audience.column]) !== opts.audience.value) { dropped.notAudience++; continue; }
    const email = emailCol ? str(r[emailCol]) : '';
    if (requireEmail && !email) { dropped.noEmail++; continue; }

    let first = firstCol ? str(r[firstCol]) : '';
    let last  = lastCol  ? str(r[lastCol])  : '';
    if (!first && !last && nameCol) ({ first, last } = splitName(str(r[nameCol])));

    const row: Record<string, string> = {
      email,
      first_name: first,
      last_name:  last,
      company:    companyCol ? str(r[companyCol]) : '',
      website:    websiteCol ? str(r[websiteCol]) : '',
      linkedin_profile: liCol ? str(r[liCol]) : '',
    };
    // Telefon nur als Spalte, wenn der Datensatz eine hat (Smartlead: Custom-Variable «phone»)
    if (phoneCol) row.phone = str(r[phoneCol]);
    for (const [src, dst] of contextCols) row[dst] = str(r[src]);
    out.push(row);
  }

  const columns = ['email', 'first_name', 'last_name', 'company', 'website', 'linkedin_profile', ...(phoneCol ? ['phone'] : []), ...contextCols.map(([, dst]) => dst)];
  return { columns, rows: out, dropped, emailColumn: emailCol };
}
