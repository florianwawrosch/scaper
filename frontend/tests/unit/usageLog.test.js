// Verbrauchsprotokoll: anhängen (Obergrenze), Summen je Modell mit Kostenschätzung,
// Enrichment getrennt, Zeitfenster
const { ok, lib } = require('./setup');
const { appendUsage, loadUsageLog, clearUsageLog, summarizeUsage, MAX_ENTRIES } = lib('usageLog');
const { estimateCost } = lib('aiPricing');

localStorage.clear();
const day = 86_400_000;
const now = Date.parse('2026-09-06T12:00:00Z');
const at = (d) => new Date(now - d * day).toISOString();

appendUsage({ at: at(1), kind: 'ai', datasetId: 'a', dataset: 'a.csv', what: 'ki_x', provider: 'anthropic', model: 'claude-sonnet-5', rows: 100, input: 1_000_000, output: 100_000, ms: 5000 });
appendUsage({ at: at(2), kind: 'ai', datasetId: 'a', dataset: 'a.csv', what: 'ki_y', provider: 'anthropic', model: 'claude-sonnet-5', rows: 50, input: 500_000, output: 50_000, ms: 3000, failed: 2 });
appendUsage({ at: at(3), kind: 'ai', datasetId: 'b', dataset: 'b.csv', what: 'ki_z', provider: 'openai', model: 'gpt-9-unknown', rows: 10, input: 1000, output: 100, ms: 800 });
appendUsage({ at: at(4), kind: 'enrich', datasetId: 'a', dataset: 'a.csv', what: 'E-Mail', provider: 'hunter_io', rows: 120, found: 80, ms: 9000 });
appendUsage({ at: at(45), kind: 'ai', datasetId: 'old', dataset: 'old.csv', what: 'ki_old', provider: 'gemini', model: 'gemini-2.0-flash', rows: 999, input: 10, output: 10, ms: 1 });

const log = loadUsageLog();
ok(log.length === 5 && log[0].what === 'ki_x' && log[4].what === 'ki_old', 'loadUsageLog: neueste zuerst');

const s = summarizeUsage(log, 30, now);
ok(s.runs === 3 && s.rows === 160, `30 Tage: 3 KI-Läufe, 160 Zeilen (alter Lauf ausgeschlossen) — ${s.runs}/${s.rows}`);
ok(s.input === 1_501_000 && s.output === 150_100, 'Token summiert');
ok(s.byModel.length === 2 && s.byModel[0].model === 'claude-sonnet-5' && s.byModel[0].runs === 2 && s.byModel[0].rows === 150, 'je Modell gruppiert, größtes zuerst');
ok(Math.abs(s.byModel[0].cost - (1.5 * 3 + 0.15 * 15)) < 1e-9, `Kosten Sonnet: 1,5M×3$ + 0,15M×15$ = ${s.byModel[0].cost}`);
ok(s.byModel[1].cost === null && s.costIncomplete === true, 'unbekanntes Modell: kein Preis, Summe als unvollständig markiert');
ok(Math.abs(s.cost - 6.75) < 1e-9, `Gesamtkosten nur aus bepreisten Modellen (${s.cost})`);
ok(s.enrich.runs === 1 && s.enrich.rows === 120 && s.enrich.found === 80, 'Enrichment getrennt gezählt');
ok(estimateCost('gpt-4o', 1_000_000, 0) === 2.5 && estimateCost(undefined, 1, 1) === null, 'estimateCost');

// Obergrenze: die ältesten fallen weg
for (let i = 0; i < MAX_ENTRIES + 20; i++) appendUsage({ at: new Date(now + i * 1000).toISOString(), kind: 'ai', datasetId: 'c', dataset: 'c', what: `k${i}`, provider: 'gemini', model: 'gemini-2.0-flash', rows: 1, input: 1, output: 1, ms: 1 });
const capped = loadUsageLog();
ok(capped.length === MAX_ENTRIES && capped[0].what === `k${MAX_ENTRIES + 19}` && !capped.some(e => e.what === 'ki_old'), `Obergrenze ${MAX_ENTRIES}, älteste weg`);

clearUsageLog();
ok(loadUsageLog().length === 0, 'clearUsageLog');
