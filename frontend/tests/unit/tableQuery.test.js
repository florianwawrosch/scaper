// lib/tableQuery: Filter (global + Spalte), Sortierung (leer ans Ende, numerisch), eindeutige Werte, Link-Erkennung
const { ok, lib } = require('./setup');
const { filterRows, sortRows, uniqueValuesByColumn, countActiveFilters, linkTarget } = lib('tableQuery');

const rows = [
  { name: 'Anna', score: '9',   city: 'Berlin' },
  { name: 'bob',  score: '104', city: 'berlin' },
  { name: 'Cleo', score: '',    city: 'Wien' },
  { name: 'Dan',  score: '27',  city: '' },
];
const cols = ['name', 'score', 'city'];

ok(filterRows(rows, cols, 'BERL', {}).length === 2, 'globale Suche: case-insensitive Substring über alle Spalten');
ok(filterRows(rows, cols, '', { city: { text: 'wien', values: null } }).map(r => r.name).join() === 'Cleo', 'Spaltenfilter Text');
ok(filterRows(rows, cols, '', { city: { text: '', values: new Set(['Berlin']) } }).map(r => r.name).join() === 'Anna', 'Spaltenfilter Werte: exakt (Groß/Klein zählt)');
ok(filterRows(rows, cols, 'n', { score: { text: '', values: new Set(['9', '27']) } }).map(r => r.name).join() === 'Anna,Dan', 'global + Spalte kombiniert');
ok(countActiveFilters({ a: { text: '', values: null }, b: { text: 'x', values: null }, c: { text: '', values: new Set() } }) === 2, 'countActiveFilters zählt nur echte Filter');

ok(sortRows(rows, 'score', true).map(r => r.name).join() === 'Anna,Dan,bob,Cleo', 'numerisch aufsteigend, leer zuletzt');
ok(sortRows(rows, 'score', false).map(r => r.name).join() === 'bob,Dan,Anna,Cleo', 'numerisch absteigend, leer trotzdem zuletzt');
ok(sortRows(rows, 'name', true).map(r => r.name).join() === 'Anna,bob,Cleo,Dan', 'alphabetisch ohne Rücksicht auf Groß/Klein');
ok(sortRows(rows, null, true) === rows, 'ohne Sortierspalte: Eingabe unverändert (gleiche Referenz)');

const uv = uniqueValuesByColumn(rows, ['city']);
ok(uv.city.join('|') === '|berlin|Berlin|Wien', `eindeutige Werte sortiert (de): ${uv.city.join('|')}`);

ok(linkTarget('https://x.de/a b') === null && linkTarget('https://x.de/a') === 'https://x.de/a', 'URL: mit Leerzeichen kein Link');
ok(linkTarget('app.quiz-akademie.de') === 'https://app.quiz-akademie.de', 'nackte Domain → https');
ok(linkTarget('www.example.com/path?x=1') === 'https://www.example.com/path?x=1', 'Domain mit Pfad');
ok(linkTarget('3.14') === null && linkTarget('16.3.3') === null && linkTarget('192.168.1.1') === null, 'Zahlen/Versionen/IPs sind keine Links');
ok(linkTarget('max@firma.de') === null, 'E-Mail ist kein Link');
ok(linkTarget('  example.com  ') === 'https://example.com', 'Whitespace wird getrimmt');

// --- pageNumbers: Seitenzahlen mit Lücken ---
const { pageNumbers } = lib('tableQuery');
ok(pageNumbers(1, 3).join() === '1,2,3' && pageNumbers(1, 0).length === 0, 'pageNumbers: wenige Seiten → alle');
ok(pageNumbers(1, 20).join() === '1,2,3,4,5,…,20', `pageNumbers: Anfang (${pageNumbers(1, 20).join()})`);
ok(pageNumbers(10, 20).join() === '1,…,9,10,11,…,20', `pageNumbers: Mitte (${pageNumbers(10, 20).join()})`);
ok(pageNumbers(20, 20).join() === '1,…,16,17,18,19,20', `pageNumbers: Ende (${pageNumbers(20, 20).join()})`);
ok(pageNumbers(5, 8).join() === '1,…,4,5,6,…,8', `pageNumbers: 8 Seiten (${pageNumbers(5, 8).join()})`);
