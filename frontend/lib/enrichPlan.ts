/**
 * Entscheidet pro Zeile, welche Lookups das Enrichment wirklich braucht.
 * Bereits gefüllte Felder (email_enriched / phone_enriched) werden NICHT
 * erneut gesucht — bei FindyMail kostet jeder erneute Treffer wieder einen
 * Credit. Rein und ohne Netz, damit es sich ohne Server testen lässt.
 */
export type EnrichField = 'email' | 'phone';

export interface RowPlan {
  name: string;
  company: string;
  linkedin: string;
  /** vorhandene Werte, die unverändert zurückgegeben werden */
  existingEmail: string;
  existingPhone: string;
  doEmail: boolean;
  doPhone: boolean;
}

export function planRow(
  row: Record<string, unknown>,
  mapping: { nameColumn: string; companyColumn: string; linkedinColumn: string },
  fields: EnrichField[],
): RowPlan {
  const s = (v: unknown) => String(v ?? '').trim();
  const name = s(row[mapping.nameColumn]);
  const company = s(row[mapping.companyColumn]);
  const linkedin = s(row[mapping.linkedinColumn]);
  const existingEmail = s(row.email_enriched);
  const existingPhone = s(row.phone_enriched);
  return {
    name, company, linkedin, existingEmail, existingPhone,
    doEmail: fields.includes('email') && !existingEmail && !!name && !!company,
    doPhone: fields.includes('phone') && !existingPhone && !!linkedin,
  };
}
