// Konfliktschutz: Zusammenführen lokaler und Server-Werte (Listen, Maps, Datensatz-Meta, CSV-Text)
const { ok, lib } = require('./setup');
const { mergeValues, mergeCsvText } = lib('storeMerge');

// KI-Configs eines Datensatzes: beide Seiten haben je eine Spalte angelegt
let r = mergeValues('analysis_configs_x', JSON.stringify([{ id: 'a', name: 'ki_a', prompt: 'p' }, { id: 'c', name: 'ki_c', prompt: 'lokal' }]), JSON.stringify([{ id: 'a', name: 'ki_a', prompt: 'p' }, { id: 'b', name: 'ki_b', prompt: 'q' }]));
let v = JSON.parse(r.value);
ok(r.merged && v.map(c => c.id).join() === 'a,b,c', `Configs vereinigt (Server-Reihenfolge, Neues hinten): ${v.map(c => c.id).join()}`);

r = mergeValues('user_presets', JSON.stringify([{ id: 'u1', name: 'lokal geändert' }]), JSON.stringify([{ id: 'u1', name: 'server' }, { id: 'u2', name: 'neu vom Kollegen' }]));
v = JSON.parse(r.value);
ok(r.merged && v.length === 2 && v[0].name === 'lokal geändert' && v[1].id === 'u2', 'gleiche ID: lokal gewinnt, Kollegen-Eintrag bleibt');

r = mergeValues('blocklist', JSON.stringify([{ pageName: 'A' }, { pageName: 'C' }]), JSON.stringify([{ pageName: 'A' }, { pageName: 'B' }]));
ok(r.merged && JSON.parse(r.value).map(e => e.pageName).join() === 'A,B,C', 'Blockliste nach Seitenname vereinigt');

r = mergeValues('presets', JSON.stringify({ Yoga: { keywords: ['yoga'] } }), JSON.stringify({ Coaching: { keywords: ['coach'] } }));
ok(r.merged && Object.keys(JSON.parse(r.value)).sort().join() === 'Coaching,Yoga', 'gespeicherte Suchen: Maps vereinigt');

r = mergeValues('csv_run_x', JSON.stringify({ filename: 'lokal', fields: ['a', 'ki_l'], rowCount: 3 }), JSON.stringify({ filename: 'server', fields: ['a', 'ki_s'], rowCount: 3, origin: 'Wien, AT' }));
v = JSON.parse(r.value);
ok(r.merged && v.filename === 'lokal' && v.origin === 'Wien, AT' && v.fields.join() === 'a,ki_s,ki_l', `Meta: lokal gewinnt, Felder vereinigt (${v.fields.join()})`);

r = mergeValues('irgendwas', 'x', 'y');
ok(!r.merged && r.value === 'y', 'unbekannter Key: Server gewinnt');
r = mergeValues('blocklist', 'kein json', '[]');
ok(!r.merged && r.value === '[]', 'kaputtes JSON: Server gewinnt');

// CSV: beide Seiten haben je eine KI-Spalte ausgefüllt
const base = 'name,ad\nAnna,x\nBob,y\n';
const local = 'name,ad,ki_l\nAnna,x,ja\nBob,y,nein\n';
const server = 'name,ad,ki_s\nAnna,x,KEEP\nBob,y,DROP\n';
const merged = mergeCsvText(local, server);
ok(merged !== null, 'gleiche Zeilenzahl → zusammenführbar');
const lines = merged.trim().split(/\r?\n/);
ok(lines[0] === 'name,ad,ki_s,ki_l' && lines[1] === 'Anna,x,KEEP,ja' && lines[2] === 'Bob,y,DROP,nein', `CSV: Spalten beider Seiten (${lines.join(' | ')})`);
const both = mergeCsvText('name,k\nAnna,lokal\nBob,\n', 'name,k\nAnna,server\nBob,server\n').trim().split(/\r?\n/);
ok(both[1] === 'Anna,lokal' && both[2] === 'Bob,server', 'gleiche Spalte: lokal gewinnt, leere lokale Zelle nimmt den Serverwert');
ok(mergeCsvText(local, base + 'Cleo,z\n') === null, 'andere Zeilenzahl → nicht zusammenführbar (Server gewinnt)');
