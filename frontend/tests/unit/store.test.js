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
  datasets: [{ key: 'csv_text_a', updatedAt: '2026-01-02T00:00:00Z' }],
  tombstones: [{ key: 'csv_run_deleted', deletedAt: '2026-01-03T00:00:00Z' }, { key: 'csv_text_deleted', deletedAt: '2026-01-03T00:00:00Z' }],
};
const local = {
  user_presets: '[local]',          // Server gewinnt
  blocklist: '[]',                  // gleich → nichts
  csv_run_deleted: '{}',            // auf dem Server gelöscht → lokal weg
  csv_run_new: '{"filename":"new"}',// nur lokal → hochladen (inkl. CSV-Text)
  analysis_configs_new: '[]',       // nur lokal → hochladen
};
const plan = S.planHydrate(local, manifest, ['a', 'deleted', 'new', 'orphan']);
ok(plan.setLocal.map(x => x.key).sort().join() === 'csv_run_a,user_presets', `Server gewinnt / Neues vom Server: ${plan.setLocal.map(x => x.key).join(',')}`);
ok(plan.removeLocal.join() === 'csv_run_deleted', 'Tombstone → lokal entfernen');
ok(plan.upload.sort().join() === 'analysis_configs_new,csv_run_new', `nur-lokale Keys hochladen: ${plan.upload.join(',')}`);
ok(plan.csvUpload.join() === 'new', `CSV-Text nur für nur-lokale Datensätze hochladen (nicht für gelöschte/verwaiste): ${plan.csvUpload.join(',')}`);
ok(plan.csvRemote['csv_text_a'] === '2026-01-02T00:00:00Z', 'Serverstand der CSV-Texte gemerkt');

// Erster Start eines leeren Servers: alles Lokale wird hochgeladen, nichts entfernt
const p2 = S.planHydrate({ csv_run_x: '{}', user_presets: '[]' }, { items: [], datasets: [], tombstones: [] }, ['x']);
ok(p2.upload.length === 2 && p2.csvUpload.join() === 'x' && p2.removeLocal.length === 0 && p2.setLocal.length === 0, 'leerer Server → Migration: alles hochladen');
// Leerer Browser, voller Server: alles übernehmen
const p3 = S.planHydrate({}, manifest, []);
ok(p3.setLocal.length === 3 && p3.upload.length === 0 && p3.csvUpload.length === 0, 'leerer Browser → alles vom Server');
