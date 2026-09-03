// lib/ai Kernlogik: Prompt-Aufbau, Fingerprints, Multi-Output-Split, Enum-Normalisierung, Regel-Spalten
const { ok, lib } = require('./setup');
const { buildRowPrompt, shortHash, rowFingerprint, splitMultiOutput, normalizeMultiOutput, applyDerivedRules, isUsableAiValue, isAiError, isPendingAiValue, PENDING } = lib('ai');

// --- buildRowPrompt ---
const row = { voller_name: 'Max Muster', firma: 'ACME', leer: '', _idx: '3', headline: 'Coach' };
const p1 = buildRowPrompt(row, 'Frage?');
ok(p1.startsWith('Frage?\n\nDaten:\n') && p1.includes('voller_name: Max Muster') && !p1.includes('leer:') && !p1.includes('_idx'), 'Prompt: nur gefüllte Spalten, kein _idx, Daten-Block');
ok(p1.endsWith('Antworte nur kurz und direkt.'), 'Prompt: Standard-Nachsatz');
const p2 = buildRowPrompt(row, 'Frage?', ['headline', 'fehlt'], true);
ok(p2 === 'Frage?\nheadline: Coach', 'Prompt bare + inputColumns: nur gewählte, fehlende Spalte weggelassen');

// --- Hash / Fingerprint ---
ok(shortHash('abc') === shortHash('abc') && shortHash('abc') !== shortHash('abd') && /^[0-9a-f]{8}$/.test(shortHash('x')), 'shortHash stabil, 8 hex');
ok(rowFingerprint(row) === rowFingerprint({ ...row, _idx: '99' }), 'rowFingerprint ignoriert _idx');
ok(rowFingerprint(row, ['firma']) === rowFingerprint({ firma: 'ACME', voller_name: 'Anders' }, ['firma']), 'rowFingerprint mit inputColumns: nur diese zählen');
ok(rowFingerprint(row) !== rowFingerprint({ ...row, firma: 'Other' }), 'rowFingerprint ändert sich mit dem Wert');

// --- Sentinels ---
ok(isPendingAiValue(PENDING) && !isUsableAiValue(PENDING) && !isUsableAiValue('') && !isUsableAiValue(undefined), 'PENDING/leer sind nicht «usable»');
ok(isAiError('Fehler: x') && !isUsableAiValue('Fehler: x') && isUsableAiValue('Coach'), '«Fehler:» erkannt, normaler Wert usable');

// --- splitMultiOutput ---
const fields = ['a', 'b', 'c'];
const split = splitMultiOutput(['1 | 2 | 3', PENDING, 'Fehler: kaputt', 'x|y'], fields);
ok(split.a.join(',') === '1,·,,x' && split.b.join(',') === '2,·,,y' && split.c.join(',') === '3,·,,', 'Split: Werte, PENDING durchgereicht, Fehler → leer, fehlende Teile leer');

// --- normalizeMultiOutput ---
const enums = { a: ['Coach', 'Trainer'], b: ['ja', 'nein'] };
ok(normalizeMultiOutput('coach | JA', ['a', 'b'], enums) === 'Coach | ja', 'Enum: Schreibweise wird kanonisiert');
ok(normalizeMultiOutput('Coach | vielleicht', ['a', 'b'], enums).startsWith('Fehler: "vielleicht" ist kein erlaubter Wert für b'), 'Enum: unerlaubter Wert → Fehler');
ok(normalizeMultiOutput('Coach', ['a', 'b'], enums).startsWith('Fehler: Ungültige Antwort (1 statt 2 Werte)'), 'falsche Anzahl → Fehler');
ok(normalizeMultiOutput(' x |  y ', ['a', 'b']) === 'x | y', 'ohne Enums: nur trimmen und normal joinen');
ok(normalizeMultiOutput(PENDING, ['a'], enums) === PENDING && normalizeMultiOutput('Fehler: alt', ['a'], enums) === 'Fehler: alt', 'PENDING/Fehler unverändert');
ok(normalizeMultiOutput('Coach | ja', ['a', 'b'], { a: ['Coach'] }) === 'Coach | ja', 'Feld ohne Enum-Liste wird durchgereicht');

// --- applyDerivedRules ---
const rule = { name: 'ziel', allOf: [{ field: 'coaching', anyOf: ['ja', 'wahrscheinlich'] }, { field: 'agentur', anyOf: ['nein'] }], then: 'ja', else: 'nein' };
const cols = { coaching: ['ja', 'nein', 'ja', PENDING, 'ja'], agentur: ['nein', 'nein', 'ja', 'nein', ''] };
const derived = applyDerivedRules([rule], cols, 5);
ok(derived.ziel.join(',') === `ja,nein,nein,${PENDING},${PENDING}`, 'Regel: then/else, PENDING und leer bleiben PENDING (nicht «nein»)');
ok(applyDerivedRules([rule], {}, 2).ziel.join(',') === `${PENDING},${PENDING}`, 'Regel ohne Spalten → alles PENDING');
