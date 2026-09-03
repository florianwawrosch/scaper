// Unit-Test für lib/aiTemplates: user presets, flags, applyPresets (merge/skip/autorun), presetFromConfigs
const { ok, lib } = require('./setup');
const T = lib('aiTemplates');
const { loadAiConfigs, saveAiConfigs } = lib('analysisConfigs');

// --- built-ins present, no flags ---
let eff = T.getEffectivePresets();
ok(eff.length === 2 && eff.every(p => !p.userDefined && !p.autoAdd), 'getEffectivePresets: 2 eingebaute, keine Flags');
ok(T.presetsForSource('csv').length === 0 && T.presetsForSource('meta').length === 0, 'presetsForSource leer ohne Flags');

// --- flags on built-in ---
T.setPresetFlags('keep_drop', { autoAdd: { csv: true, meta: false }, autoRun: true });
let kd = T.getEffectivePresets().find(p => p.id === 'keep_drop');
ok(kd.autoAdd.csv === true && kd.autoAdd.meta === undefined && kd.autoRun === true, 'setPresetFlags: csv=true, meta weggelassen, autoRun=true');
ok(T.presetsForSource('csv').map(p => p.id).join() === 'keep_drop' && T.presetsForSource('meta').length === 0, 'presetsForSource(csv) = keep_drop');
T.setPresetFlags('keep_drop', { autoAdd: {}, autoRun: true });
kd = T.getEffectivePresets().find(p => p.id === 'keep_drop');
ok(!kd.autoAdd && !kd.autoRun && !JSON.parse(localStorage.getItem('preset_flags')).keep_drop, 'autoRun ohne autoAdd wird verworfen, Eintrag entfernt');

// --- presetFromConfigs + saveUserPreset ---
const cfgs = [
  { id: 'cfg_a', provider: 'openai', model: 'gpt-x', name: 'ki_a', prompt: 'Frage A', promptVersion: 'v2*' },
  { id: 'cfg_b', provider: 'openai', model: 'gpt-x', name: 'ki_b', prompt: 'Frage B', outputFields: ['ki_b1', 'ki_b2'], derived: [{ name: 'ki_rule', allOf: [], then: 'ja', else: 'nein' }] },
];
const up = T.presetFromConfigs('  Meine Vorlage ', cfgs, { autoAdd: { meta: true } });
ok(up.userDefined && up.name === 'Meine Vorlage' && up.columns.length === 2 && !('provider' in up.columns[0]) && !('id' in up.columns[0]), 'presetFromConfigs: id/provider/model entfernt');
ok(up.columns[0].promptVersion === 'v2' && up.columns[1].outputFields.length === 2 && up.columns[1].derived.length === 1, 'presetFromConfigs: v2* → v2, Splits/Regeln übernommen');
T.saveUserPreset(up);
eff = T.getEffectivePresets();
const mine = eff.find(p => p.id === up.id);
ok(eff.length === 3 && mine && mine.userDefined && mine.autoAdd.meta === true && !mine.autoRun, 'saveUserPreset: erscheint mit Flags (meta)');
ok(!('autoAdd' in JSON.parse(localStorage.getItem('user_presets'))[0]), 'user_presets speichert Flags NICHT inline');
T.saveUserPreset({ ...mine, name: 'Umbenannt', autoAdd: undefined, autoRun: undefined });
ok(T.getEffectivePresets().find(p => p.id === up.id).name === 'Umbenannt' && T.getPresetFlags(up.id).autoAdd.meta === true, 'saveUserPreset ohne Flags: Flags bleiben erhalten');

// --- applyPresets: append, skip duplicates, autorun ids ---
saveAiConfigs('run1', [{ id: 'old', provider: 'gemini', model: 'g', name: 'ki_a', prompt: 'schon da' }]);
let r = T.applyPresets('run1', [T.getEffectivePresets().find(p => p.id === up.id)], 'anthropic');
ok(r.added.length === 1 && r.added[0].name === 'ki_b' && r.added[0].provider === 'anthropic' && r.skipped.length === 0, 'applyPresets: ki_a übersprungen (Kollision), ki_b angehängt');
ok(loadAiConfigs('run1').length === 2 && loadAiConfigs('run1')[0].id === 'old', 'applyPresets: bestehende Configs bleiben vorne');
ok(r.autoRun.length === 0 && T.readAutorunIds('run1') === null, 'applyPresets: kein autoRun ohne Flag');
r = T.applyPresets('run1', [T.getEffectivePresets().find(p => p.id === up.id)], 'anthropic');
ok(r.added.length === 0 && r.skipped.length === 1, 'applyPresets: zweites Mal → alles übersprungen');
r = T.applyPresets('run1', [T.getEffectivePresets().find(p => p.id === 'keep_drop')], 'openai', { forceAutoRun: true });
ok(r.added.length === 1 && r.autoRun.length === 1 && JSON.stringify(T.readAutorunIds('run1')) === JSON.stringify([r.added[0].id]), 'applyPresets forceAutoRun → autorun-IDs gesetzt');
T.setPresetFlags(up.id, { autoAdd: { csv: true }, autoRun: true });
r = T.applyPresets('run2', T.presetsForSource('csv'), 'gemini');
ok(r.added.length === 2 && r.autoRun.length === 2 && T.readAutorunIds('run2').length === 2, 'applyPresets mit autoRun-Flag → beide Configs vorgemerkt');
// derived-Regel zählt als belegter Name → Kollision verhindert doppelte Regel-Spalte
saveAiConfigs('run3', [{ id: 'x', provider: 'gemini', model: 'g', name: 'anders', prompt: 'p', derived: [{ name: 'ki_rule', allOf: [], then: 'ja', else: 'nein' }] }]);
r = T.applyPresets('run3', [T.getEffectivePresets().find(p => p.id === up.id)], 'gemini');
ok(r.added.length === 1 && r.added[0].name === 'ki_a', 'applyPresets: Regel-Spaltenname belegt → ki_b übersprungen, ki_a angehängt');
// legacy "1"
localStorage.setItem('autorun_analysis_legacy', '1');
ok(T.readAutorunIds('legacy') === 'first', "readAutorunIds: Legacy '1' → 'first'");
localStorage.setItem('autorun_analysis_bad', '{oops');
ok(T.readAutorunIds('bad') === null, 'readAutorunIds: kaputtes JSON → null');

// --- delete ---
T.deleteUserPreset(up.id);
ok(T.getEffectivePresets().length === 2 && !T.getPresetFlags(up.id).autoAdd, 'deleteUserPreset entfernt Vorlage + Flags');
ok(T.detectPreset(['voller_name', 'headline', 'x']).id === 'linkedin_klassifizierung_v5' && T.detectPreset(['a', 'b']) === null, 'detectPreset unverändert');
