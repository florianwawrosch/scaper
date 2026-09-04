// Unit-Test lib/aiTemplates: KI-Spalten (flaches Modell) — Flags, Speichern,
// Migration alter Mehrspalten-Vorlagen, applyPresets (Herkunft-Sperre, Modell, autoRun)
const { ok, lib } = require('./setup');
const T = lib('aiTemplates');
const { loadAiConfigs, saveAiConfigs } = lib('analysisConfigs');

// --- built-ins present, no flags ---
let eff = T.getEffectivePresets();
ok(eff.length === 2 && eff.every(p => !p.userDefined && !p.autoAdd && p.columns.length === 1), 'getEffectivePresets: 2 eingebaute, je 1 Spalte, keine Flags');
ok(T.presetsForSource('csv').length === 0 && T.presetsForSource('meta').length === 0, 'presetsForSource leer ohne Flags');

// --- flags: autoRun ist unabhängig von autoAdd ---
T.setPresetFlags('keep_drop', { autoAdd: { csv: true, meta: false }, autoRun: true });
let kd = T.getEffectivePresets().find(p => p.id === 'keep_drop');
ok(kd.autoAdd.csv === true && kd.autoAdd.meta === undefined && kd.autoRun === true, 'setPresetFlags: csv=true, meta weggelassen, autoRun=true');
ok(T.presetsForSource('csv').map(p => p.id).join() === 'keep_drop' && T.presetsForSource('meta').length === 0, 'presetsForSource(csv) = keep_drop');
T.setPresetFlags('keep_drop', { autoAdd: {}, autoRun: true });
kd = T.getEffectivePresets().find(p => p.id === 'keep_drop');
ok(!kd.autoAdd && kd.autoRun === true, 'autoRun bleibt auch ohne autoAdd (gilt für «Laden» im Menü)');
T.setPresetFlags('keep_drop', { autoAdd: {}, autoRun: false });
ok(!JSON.parse(localStorage.getItem('preset_flags')).keep_drop, 'alles aus → Eintrag entfernt');

// --- presetFromConfigs behält das KI-Modell, nicht die Config-ID ---
const cfgA = { id: 'cfg_a', provider: 'openai', model: 'gpt-4o', name: 'ki_a', prompt: 'Frage A', promptVersion: 'v2*' };
const up = T.presetFromConfigs('ki_a', [cfgA], { autoAdd: { meta: true }, autoRun: true });
ok(up.userDefined && up.name === 'ki_a' && up.columns.length === 1 && up.columns[0].provider === 'openai' && up.columns[0].model === 'gpt-4o' && !('id' in up.columns[0]), 'presetFromConfigs: Modell übernommen, id entfernt');
ok(up.columns[0].promptVersion === 'v2', 'presetFromConfigs: v2* → v2');
T.saveUserPreset(up);
eff = T.getEffectivePresets();
const mine = eff.find(p => p.id === up.id);
ok(eff.length === 3 && mine && mine.userDefined && mine.autoAdd.meta === true && mine.autoRun === true, 'saveUserPreset: erscheint mit Flags (meta, autoRun)');
ok(!('autoAdd' in JSON.parse(localStorage.getItem('user_presets'))[0]), 'user_presets speichert Flags NICHT inline');
T.saveUserPreset({ ...mine, name: 'Umbenannt', autoAdd: undefined, autoRun: undefined });
ok(T.getEffectivePresets().find(p => p.id === up.id).name === 'Umbenannt' && T.getPresetFlags(up.id).autoAdd.meta === true, 'saveUserPreset ohne Flags: Flags bleiben erhalten');

// --- Migration: alte Vorlage mit 2 Spalten → 2 KI-Spalten mit denselben Flags ---
localStorage.setItem('user_presets', JSON.stringify([
  { id: 'old_multi', name: 'Drei', columns: [{ name: 'ki_x', prompt: 'X' }, { name: 'ki_y', prompt: 'Y', promptVersion: 'v9' }] },
]));
localStorage.setItem('preset_flags', JSON.stringify({ old_multi: { autoAdd: { csv: true }, autoRun: true } }));
let migrated = T.loadUserPresets();
ok(migrated.length === 2 && migrated[0].id === 'old_multi' && migrated[1].id === 'old_multi_2', `Migration: 2 KI-Spalten (${migrated.map(p => p.id).join(', ')})`);
ok(migrated[0].name === 'ki_x' && migrated[1].name === 'ki_y' && migrated[1].promptVersion === 'v9' && migrated.every(p => p.columns.length === 1), 'Migration: Titel = Spaltenname, Version übernommen');
ok(T.getPresetFlags('old_multi_2').autoAdd.csv === true && T.getPresetFlags('old_multi_2').autoRun === true, 'Migration: Flags auf die abgespaltene KI-Spalte kopiert');
ok(JSON.parse(localStorage.getItem('user_presets')).length === 2, 'Migration einmalig zurückgeschrieben');

// --- applyPresets: Herkunft (presetId), Sperre gegen doppeltes Laden, Modellwahl, autoRun ---
localStorage.removeItem('user_presets'); localStorage.removeItem('preset_flags');
T.saveUserPreset(T.presetFromConfigs('ki_a', [cfgA], { autoRun: true }));
const pa = T.getEffectivePresets().find(p => p.userDefined);
let r = T.applyPresets('run1', [pa], 'anthropic', { providers: ['anthropic', 'openai'] });
ok(r.added.length === 1 && r.added[0].presetId === pa.id && r.added[0].provider === 'openai' && r.added[0].model === 'gpt-4o', 'applyPresets: gespeichertes Modell (openai hat Key) + presetId');
ok(r.autoRun.length === 1 && JSON.stringify(T.readAutorunIds('run1')) === JSON.stringify([r.added[0].id]), 'applyPresets: autoRun-Schalter → vorgemerkt');
r = T.applyPresets('run1', [pa], 'anthropic', { providers: ['anthropic', 'openai'] });
ok(r.added.length === 0 && r.skipped.length === 1 && loadAiConfigs('run1').length === 1, 'applyPresets: dieselbe KI-Spalte kein zweites Mal (presetId)');
ok(T.isPresetLoaded(pa, loadAiConfigs('run1')) && !T.isPresetLoaded(T.getEffectivePresets()[0], loadAiConfigs('run1')), 'isPresetLoaded: geladen vs. nicht geladen');
r = T.applyPresets('run2', [pa], 'anthropic', { providers: ['anthropic'] });
ok(r.added[0].provider === 'anthropic' && r.added[0].model === 'claude-opus-5', 'applyPresets: Provider ohne Key → Fallback-Provider mit Standardmodell');
r = T.applyPresets('run3', [pa], 'gemini', { forceAutoRun: false });
ok(r.added.length === 1 && r.autoRun.length === 0 && T.readAutorunIds('run3') === null, 'applyPresets forceAutoRun=false überschreibt den Schalter');
// Namenskollision: umbenannte Config aus anderer Quelle belegt den Titel
saveAiConfigs('run4', [{ id: 'old', provider: 'gemini', model: 'g', name: 'ki_a', prompt: 'schon da' }]);
r = T.applyPresets('run4', [pa], 'anthropic');
ok(r.added.length === 0 && r.skipped.length === 1 && T.isPresetLoaded(pa, loadAiConfigs('run4')), 'applyPresets: Spaltenname belegt → übersprungen, zählt als geladen');
r = T.applyPresets('run4', [T.getEffectivePresets().find(p => p.id === 'keep_drop')], 'openai', { forceAutoRun: true });
ok(r.added.length === 1 && r.added[0].presetId === 'keep_drop' && r.autoRun.length === 1 && loadAiConfigs('run4')[0].id === 'old', 'applyPresets forceAutoRun → vorgemerkt, bestehende Configs bleiben vorne');
// derived-Regel zählt als belegter Name
const pb = T.saveUserPreset(T.presetFromConfigs('ki_b', [{ id: 'c', provider: 'openai', model: 'gpt-4o', name: 'ki_b', prompt: 'B', outputFields: ['ki_b1'], derived: [{ name: 'ki_rule', allOf: [], then: 'ja', else: 'nein' }] }]));
saveAiConfigs('run5', [{ id: 'x', provider: 'gemini', model: 'g', name: 'anders', prompt: 'p', derived: [{ name: 'ki_rule', allOf: [], then: 'ja', else: 'nein' }] }]);
r = T.applyPresets('run5', [T.getEffectivePresets().find(p => p.id === pb.id)], 'gemini');
ok(r.added.length === 0 && r.skipped.length === 1, 'applyPresets: Regel-Spaltenname belegt → übersprungen');
// legacy "1"
localStorage.setItem('autorun_analysis_legacy', '1');
ok(T.readAutorunIds('legacy') === 'first', "readAutorunIds: Legacy '1' → 'first'");
localStorage.setItem('autorun_analysis_bad', '{oops');
ok(T.readAutorunIds('bad') === null, 'readAutorunIds: kaputtes JSON → null');

// --- Override einer eingebauten KI-Spalte: Titel + Modell ---
T.savePromptOverride('keep_drop', 'ki_bewertung', { prompt: 'Neu?', promptVersion: 'v2', name: 'ki_lead', provider: 'gemini', model: 'gemini-2.0-flash' });
kd = T.getEffectivePresets().find(p => p.id === 'keep_drop');
ok(kd.columns[0].name === 'ki_lead' && kd.columns[0].provider === 'gemini' && kd.columns[0].model === 'gemini-2.0-flash' && kd.promptVersion === 'v2' && T.hasOverride('keep_drop'), 'Override: Titel, Modell, Version, Prompt');
ok(T.builtinColumnNames('keep_drop')[0] === 'ki_bewertung', 'builtinColumnNames liefert den Original-Titel');
T.resetPresetOverrides('keep_drop');
ok(T.getEffectivePresets().find(p => p.id === 'keep_drop').columns[0].name === 'ki_bewertung', '↺ Standard');

// --- delete ---
T.deleteUserPreset(pa.id); T.deleteUserPreset(pb.id);
ok(T.getEffectivePresets().length === 2 && !T.getPresetFlags(pa.id).autoRun, 'deleteUserPreset entfernt KI-Spalte + Flags');
ok(T.detectPreset(['voller_name', 'headline', 'x']).id === 'linkedin_klassifizierung_v5' && T.detectPreset(['a', 'b']) === null, 'detectPreset unverändert');
