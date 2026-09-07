// Kostendeckel: Monatskosten, Lauf-Schätzung aus der Historie, Budget-Stufen (ok / warn / over)
const { ok, lib } = require('./setup');
const { monthCost, estimateRunCost, budgetStatus, loadBudget, saveBudget, fmtUsd } = lib('budget');

const now = new Date('2026-09-15T12:00:00');
const at = (s) => new Date(s).toISOString();
const entries = [
  { id: '1', at: at('2026-09-02T10:00:00'), kind: 'ai', datasetId: 'a', dataset: 'a', what: 'k', provider: 'anthropic', model: 'claude-sonnet-5', rows: 100, input: 1_000_000, output: 0, ms: 1 },   // 3 $
  { id: '2', at: at('2026-09-10T10:00:00'), kind: 'ai', datasetId: 'a', dataset: 'a', what: 'k', provider: 'anthropic', model: 'claude-sonnet-5', rows: 100, input: 0, output: 100_000, ms: 1 },     // 1,5 $
  { id: '3', at: at('2026-08-30T10:00:00'), kind: 'ai', datasetId: 'a', dataset: 'a', what: 'k', provider: 'anthropic', model: 'claude-sonnet-5', rows: 999, input: 9_000_000, output: 0, ms: 1 },   // Vormonat
  { id: '4', at: at('2026-09-11T10:00:00'), kind: 'enrich', datasetId: 'a', dataset: 'a', what: 'E-Mail', provider: 'hunter_io', rows: 50, found: 10, ms: 1 },                                        // zählt nicht
  { id: '5', at: at('2026-09-12T10:00:00'), kind: 'ai', datasetId: 'a', dataset: 'a', what: 'k', provider: 'openai', model: 'gpt-unbekannt', rows: 10, input: 10, output: 1, ms: 1 },                 // kein Preis
];

let m = monthCost(entries, now);
ok(Math.abs(m.cost - 4.5) < 1e-9 && m.runs === 3 && m.incomplete, `Monatskosten nur aus KI-Läufen dieses Monats (${m.cost} $, ${m.runs} Läufe, unvollständig)`);

let e = estimateRunCost(entries, 'claude-sonnet-5', 50);
// Historie über alle Monate: 1.199 Zeilen → 10.000.000 rein, 100.000 raus → je Zeile anteilig auf 50 Zeilen
const expect = ((10_000_000 / 1199) * 50 * 3 + (100_000 / 1199) * 50 * 15) / 1e6;
ok(e.basis === 'history' && Math.abs(e.cost - expect) < 1e-9, `Schätzung aus der Historie (${e.cost.toFixed(4)} $)`);
e = estimateRunCost(entries, 'gpt-4o', 1000);
ok(e.basis === 'default' && Math.abs(e.cost - (350_000 * 2.5 + 8_000 * 10) / 1e6) < 1e-9, `ohne Historie: Richtwert je Zeile (${e.cost} $)`);
ok(estimateRunCost(entries, 'gpt-unbekannt', 10).cost === null, 'Modell ohne Preis → null');

ok(budgetStatus(entries, { monthlyUsd: null }, now).level === 'none', 'ohne Budget: none');
let s = budgetStatus(entries, { monthlyUsd: 10 }, now);
ok(s.level === 'ok' && s.spent === 4.5 && s.limit === 10, 'unter 80 %: ok');
s = budgetStatus(entries, { monthlyUsd: 10 }, now, 4);
ok(s.level === 'warn' && Math.abs(s.ratio - 0.85) < 1e-9, 'mit geplantem Lauf ≥ 80 %: warn');
s = budgetStatus(entries, { monthlyUsd: 10 }, now, 6);
ok(s.level === 'over', 'geplanter Lauf würde das Budget überschreiten: over');
s = budgetStatus(entries, { monthlyUsd: 4 }, now);
ok(s.level === 'over', 'Budget bereits erreicht: over');

localStorage.clear();
ok(loadBudget().monthlyUsd === null, 'kein Budget gespeichert');
saveBudget(25);
ok(loadBudget().monthlyUsd === 25, 'Budget speichern');
saveBudget(null);
ok(loadBudget().monthlyUsd === null && localStorage.getItem('app_budget') === null, 'Budget entfernen');
ok(fmtUsd(1.5) === '1,50 $' && fmtUsd(0.0042) === '0,0042 $' && fmtUsd(null) === '–', `fmtUsd (${fmtUsd(1.5)}, ${fmtUsd(0.0042)})`);
