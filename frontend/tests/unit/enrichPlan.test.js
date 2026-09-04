// planRow: keine Doppelsuche für schon gefüllte Felder, Felder nur bei vorhandenen Eingaben
const { ok, lib } = require('./setup');
const { planRow } = lib('enrichPlan');
const M = { nameColumn: 'name', companyColumn: 'firma', linkedinColumn: 'li' };

let p = planRow({ name: 'Max', firma: 'ACME', li: 'https://linkedin.com/in/max' }, M, ['email', 'phone']);
ok(p.doEmail && p.doPhone && p.existingEmail === '' , 'leere Zeile: beide Lookups');
p = planRow({ name: 'Max', firma: 'ACME', li: 'x', email_enriched: 'max@acme.de' }, M, ['email', 'phone']);
ok(!p.doEmail && p.doPhone && p.existingEmail === 'max@acme.de', 'E-Mail vorhanden → nur Telefon suchen, E-Mail bleibt');
p = planRow({ name: 'Max', firma: 'ACME', li: 'x', email_enriched: 'a@b.de', phone_enriched: '+49' }, M, ['email', 'phone']);
ok(!p.doEmail && !p.doPhone, 'beides vorhanden → nichts suchen');
p = planRow({ name: 'Max', firma: '', li: 'x' }, M, ['email']);
ok(!p.doEmail && !p.doPhone, 'ohne Firma keine E-Mail-Suche; Telefon nicht gewünscht');
p = planRow({ name: '  Max ', firma: ' ACME ', li: '' }, M, ['phone']);
ok(!p.doPhone && p.name === 'Max' && p.company === 'ACME', 'ohne LinkedIn keine Telefonsuche; Werte getrimmt');
p = planRow({ name: 'Max', firma: 'ACME', email_enriched: '   ' }, M, ['email']);
ok(p.doEmail && p.existingEmail === '', 'nur Whitespace zählt als leer');
