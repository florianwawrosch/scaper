// lib/aiCache: Lauf-Planung — nur geänderte, fehlerhafte oder neue Zeilen werden klassifiziert
const { ok, lib } = require('./setup');
const { planRun, configHash, readHashStore } = lib('aiCache');
const { PENDING } = lib('ai');

const cfg = { provider: 'anthropic', model: 'claude-sonnet-5', prompt: 'Coach?', inputColumns: ['name'] };
const rows = [{ name: 'Anna' }, { name: 'Bob' }, { name: 'Cleo' }, { name: 'Dan' }];

// Erster Lauf: alles
let p = planRun(rows, cfg, [PENDING, PENDING, PENDING, PENDING]);
ok(p.todo.join() === '0,1,2,3' && p.skipped === 0 && p.rowHashes.length === 4, 'ohne Cache: alle Zeilen');
ok(p.promptHash === configHash(cfg), 'promptHash = configHash');

// Zweiter Lauf, nichts geändert, alle brauchbar → nichts zu tun
const prev = { promptHash: p.promptHash, rowHashes: p.rowHashes };
p = planRun(rows, cfg, ['ja', 'nein', 'ja', 'nein'], prev);
ok(p.todo.length === 0 && p.skipped === 4, 'unverändert + Ergebnisse → alles übersprungen');

// Fehler-Zeile und Platzhalter laufen erneut, geänderte Eingabe auch, neue Zeile auch
const rows2 = [{ name: 'Anna' }, { name: 'Bobby' }, { name: 'Cleo' }, { name: 'Dan' }, { name: 'Eve' }];
p = planRun(rows2, cfg, ['ja', 'nein', 'Fehler: kaputt', PENDING, undefined], prev);
ok(p.todo.join() === '1,2,3,4' && p.skipped === 1, `geänderte Eingabe (1), Fehler (2), Platzhalter (3), neu (4) → ${p.todo.join()}`);

// Prompt/Modell geändert → alles neu
p = planRun(rows, { ...cfg, model: 'claude-opus-5' }, ['ja', 'nein', 'ja', 'nein'], prev);
ok(p.todo.length === 4, 'anderes Modell → alles neu');
p = planRun(rows, { ...cfg, prompt: 'Trainer?' }, ['ja', 'nein', 'ja', 'nein'], prev);
ok(p.todo.length === 4, 'anderer Prompt → alles neu');
// Andere Eingabespalten → anderer Fingerprint, obwohl die Werte gleich sind
p = planRun(rows, { ...cfg, inputColumns: undefined }, ['ja', 'nein', 'ja', 'nein'], prev);
ok(p.todo.length === 4, 'andere Eingabespalten → alles neu');

ok(JSON.stringify(readHashStore('{oops')) === '{}' && readHashStore(null).constructor === Object && readHashStore('{"c":{"promptHash":"x","rowHashes":[]}}').c.promptHash === 'x', 'readHashStore: kaputt/leer/ok');
