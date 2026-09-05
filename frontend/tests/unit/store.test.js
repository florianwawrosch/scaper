// Unit-Test lib/store: Merge-Logik beim Einspielen des Serverstands (planHydrate), Key-Klassen
const { ok, lib } = require('./setup');
const S = lib('store');

ok(S.isSharedKey('csv_run_x') && S.isSharedKey('analysis_configs_x') && S.isSharedKey('user_presets') && S.isSharedKey('blocklist') && S.isSharedKey('presets'), 'geteilte Keys erkannt');
ok(!S.isSharedKey('appSettings') && !S.isSharedKey('table_view') && !S.isSharedKey('autorun_analysis_x') && !S.isSharedKey('lp_sync_pending'), 'API-Keys/Anzeige/Autorun bleiben lokal');

const manifest = {
  items: [
    { key: 'user_presets', value: '[server]', updatedAt: '2026-01-02T00:00:00Z' },
    { key: 'csv_run_a', value: '{"filename":"a"}', updatedAt: '2026-01-02T00:00:00Z' },
    { key: 'blocklist', value: '[]', updatedAt: '2026-01-02T00:00:00Z' },
  ],
  large: [{ key: 'csv_text_a', updatedAt: '2026-01-02T00:00:00Z' }, { key: 'analysis_hashes_a', updatedAt: '2026-01-02T00:00:00Z' }],
  tombstones: [{ key: 'csv_run_deleted', deletedAt: '2026-01-03T00:00:00Z' }, { key: 'csv_text_deleted', deletedAt: '2026-01-03T00:00:00Z' }],
};
const local = {
  user_presets: '[local]',          // Server gewinnt
  blocklist: '[]',                  // gleich → nichts
  csv_run_deleted: '{}',            // auf dem Server gelöscht → lokal weg
  csv_run_new: '{"filename":"new"}',// nur lokal → hochladen (inkl. CSV-Text)
  analysis_configs_new: '[]',       // nur lokal → hochladen
  analysis_hashes_a: '{}',          // groß + auf dem Server → nur nach Stand vergleichen, nicht hochladen
  analysis_hashes_new: '{}',        // groß + nur lokal → hochladen
};
const plan = S.planHydrate(local, manifest, ['a', 'deleted', 'new', 'orphan']);
ok(plan.setLocal.map(x => x.key).sort().join() === 'csv_run_a,user_presets', `Server gewinnt / Neues vom Server: ${plan.setLocal.map(x => x.key).join(',')}`);
ok(plan.removeLocal.join() === 'csv_run_deleted', 'Tombstone → lokal entfernen');
ok(plan.upload.sort().join() === 'analysis_configs_new,analysis_hashes_new,csv_run_new', `nur-lokale Keys hochladen (große nur, wenn der Server sie nicht kennt): ${plan.upload.join(',')}`);
ok(plan.csvUpload.join() === 'new', `CSV-Text nur für nur-lokale Datensätze hochladen (nicht für gelöschte/verwaiste): ${plan.csvUpload.join(',')}`);
ok(plan.remote['csv_text_a'] === '2026-01-02T00:00:00Z' && plan.remote['analysis_hashes_a'], 'Serverstand großer Keys gemerkt');
// Teile-Upload
ok(S.splitParts('abc', 10) === null, 'kleiner Wert → keine Teile');
const sp = S.splitParts('x'.repeat(25), 10);
ok(sp.parts.length === 3 && sp.parts.join('') === 'x'.repeat(25) && sp.header === 'parts:3' && S.partsCount(sp.header) === 3 && S.partsCount('gz:abc') === 0, 'großer Wert → 3 Teile + Kopf');

// Erster Start eines leeren Servers: alles Lokale wird hochgeladen, nichts entfernt
const p2 = S.planHydrate({ csv_run_x: '{}', user_presets: '[]' }, { items: [], large: [], tombstones: [] }, ['x']);
ok(p2.upload.length === 2 && p2.csvUpload.join() === 'x' && p2.removeLocal.length === 0 && p2.setLocal.length === 0, 'leerer Server → Migration: alles hochladen');
// Leerer Browser, voller Server: alles übernehmen
const p3 = S.planHydrate({}, manifest, []);
ok(p3.setLocal.length === 3 && p3.upload.length === 0 && p3.csvUpload.length === 0, 'leerer Browser → alles vom Server');
// Eigene, noch nicht hochgeladene Änderung gewinnt gegen den Server
const p4 = S.planHydrate({ user_presets: '[mine]', csv_run_deleted: '{}' }, manifest, [], new Set(['user_presets', 'csv_run_deleted']));
ok(!p4.setLocal.some(x => x.key === 'user_presets') && p4.removeLocal.length === 0, 'pending Keys werden weder überschrieben noch entfernt');
