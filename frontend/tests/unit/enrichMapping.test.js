// pickColumn: exakter Treffer vor Teil-Treffer, Prioritätsreihenfolge; sampleValue: erster gefüllter Wert
const { ok, lib } = require('./setup');
const { pickColumn, sampleValue, NAME_CANDIDATES, COMPANY_CANDIDATES, LINKEDIN_CANDIDATES } = lib('enrichMapping');

ok(pickColumn(['page_name', 'voller_name', 'ad_text'], NAME_CANDIDATES) === 'voller_name', 'Name: voller_name schlägt page_name (Priorität)');
ok(pickColumn(['Page_Name', 'ad_text'], NAME_CANDIDATES) === 'Page_Name', 'Name: page_name als Fallback, Originalschreibweise erhalten');
ok(pickColumn(['kontakt_name_voll', 'x'], NAME_CANDIDATES) === 'kontakt_name_voll', 'Name: Teil-Treffer (enthält «name»)');
ok(pickColumn(['website', 'firma'], COMPANY_CANDIDATES) === 'firma', 'Firma: firma vor website');
ok(pickColumn(['company_domain'], COMPANY_CANDIDATES) === 'company_domain', 'Firma: company_domain exakt');
ok(pickColumn(['linkedin_url', 'url'], LINKEDIN_CANDIDATES) === 'linkedin_url', 'LinkedIn: linkedin_url vor url');
ok(pickColumn(['foo', 'bar'], NAME_CANDIDATES) === '', 'kein Treffer → leer');
ok(pickColumn([], NAME_CANDIDATES) === '', 'keine Spalten → leer');
const rows = [{ a: '' }, { a: '  ' }, { a: 'Max' }, { a: 'Moritz' }];
ok(sampleValue(rows, 'a') === 'Max', 'sampleValue: erster nicht-leerer Wert');
ok(sampleValue(rows, 'b') === '' && sampleValue(rows, '') === '', 'sampleValue: fehlende/leere Spalte → leer');
