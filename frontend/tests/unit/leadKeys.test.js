// leadKeys/matchKnown/addToIndex: Schlüssel-Normalisierung und Wiedererkennung über Datensätze
const { ok, lib } = require('./setup');
const { leadKeys, normalizeLinkedin, matchKnown, addToIndex, KNOWN_COL, EXPORTED_COL, EMAIL_COL, PHONE_COL } = lib('leadKeys');

ok(normalizeLinkedin('https://www.LinkedIn.com/in/Max-Muster/?trk=x') === 'linkedin.com/in/max-muster', 'LinkedIn-URL normalisiert (Schema, www, Query, Slash, Kleinschreibung)');
ok(leadKeys({ page_id: '42', page_name: 'Coach Anna', email_enriched: 'A@X.de' }).join() === 'page:42,email:a@x.de', 'page_id + E-Mail, kein Namens-Schlüssel bei vorhandener ID');
ok(leadKeys({ page_name: 'Coach Anna' }).join() === 'name:coach anna', 'ohne page_id: Name als Rückfall');
ok(leadKeys({ linkedin_url: 'linkedin.com/in/max/', email: 'kein-mail' }).join() === 'li:linkedin.com/in/max', 'LinkedIn-Key; ungültige E-Mail ignoriert');
ok(leadKeys({ ad_text: 'x' }).length === 0, 'nichts Identifizierendes → keine Schlüssel');

const index = new Map();
addToIndex(index, [
  { page_id: '1', page_name: 'A', [EXPORTED_COL]: '2026-08-01', [EMAIL_COL]: 'a@alt.de' },
  { page_id: '2', page_name: 'B', [PHONE_COL]: '+49 1' },
], { datasetId: 'old', filename: 'Meta: alt' });
addToIndex(index, [{ page_id: '2', page_name: 'B', [EXPORTED_COL]: '2026-09-01' }], { datasetId: 'mid', filename: 'Meta: mitte' });
ok(index.get('page:2').filename === 'Meta: alt' && index.get('page:2').exportedAt === '2026-09-01', 'ältester Datensatz benennt die Quelle, Export-Datum kommt vom späteren');

const r = matchKnown([
  { page_id: '1', page_name: 'A' },
  { page_id: '2', page_name: 'B' },
  { page_id: '3', page_name: 'C' },
  { page_id: '9', page_name: 'Z', [EXPORTED_COL]: '2026-07-07' },
], index);
ok(r.knownFrom.join('|') === 'Meta: alt|Meta: alt||', `bekannt_aus je Zeile (${r.knownFrom.join('|')})`);
ok(r.exportedAt.join('|') === '2026-08-01|2026-09-01||2026-07-07', 'Export-Datum übernommen, eigenes Datum bleibt');
ok(r.known === 2 && r.exported === 3, `Zähler known=${r.known} exported=${r.exported}`);
ok(KNOWN_COL === 'bekannt_aus' && EXPORTED_COL === 'exportiert_am', 'Spaltennamen stabil');

ok(r.email.join('|') === 'a@alt.de|||' && r.phone.join('|') === '|+49 1||', 'E-Mail/Telefon aus früherem Enrichment übernommen');
ok(r.emailsCopied === 1 && r.phonesCopied === 1, `Zähler emailsCopied=${r.emailsCopied} phonesCopied=${r.phonesCopied}`);
const r2 = matchKnown([{ page_id: '1', [EMAIL_COL]: 'eigene@x.de' }], index);
ok(r2.email[0] === 'eigene@x.de' && r2.emailsCopied === 0, 'eigener Wert hat Vorrang, zählt nicht als übernommen');
