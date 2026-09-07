import { lsSet, lsRemove } from './store';
import { estimateCost } from './aiPricing';
import type { UsageEntry } from './usageLog';

/**
 * Kostendeckel für KI-Läufe: ein Monatsbudget in USD (geteilt, gilt für alle).
 * Grundlage sind die Schätzwerte des Verbrauchsprotokolls (lib/aiPricing.ts) —
 * also Richtwerte, nicht die Abrechnung des Anbieters. Enrichment-Credits
 * zählen nicht mit; die hat der Anbieter selbst im Blick.
 */
export const BUDGET_KEY = 'app_budget';
/** Ab diesem Anteil fragt jeder KI-Lauf vorher nach */
export const WARN_RATIO = 0.8;
/** Richtwert je Zeile, solange das Modell noch keine eigenen Läufe im Protokoll hat */
export const DEFAULT_TOKENS_PER_ROW = { input: 350, output: 8 };

export interface Budget { monthlyUsd: number | null }

export function loadBudget(): Budget {
  try {
    const b = JSON.parse(localStorage.getItem(BUDGET_KEY) ?? 'null');
    return b && typeof b.monthlyUsd === 'number' && b.monthlyUsd > 0 ? { monthlyUsd: b.monthlyUsd } : { monthlyUsd: null };
  } catch { return { monthlyUsd: null }; }
}

export function saveBudget(monthlyUsd: number | null): void {
  if (monthlyUsd && monthlyUsd > 0) lsSet(BUDGET_KEY, JSON.stringify({ monthlyUsd }));
  else lsRemove(BUDGET_KEY);
}

/** Geschätzte KI-Kosten im laufenden Kalendermonat (lokale Zeit) */
export function monthCost(entries: UsageEntry[], now = new Date()): { cost: number; runs: number; incomplete: boolean } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let cost = 0, runs = 0, incomplete = false;
  for (const e of entries) {
    if (e.kind !== 'ai' || Date.parse(e.at) < start || Date.parse(e.at) > now.getTime()) continue;
    runs++;
    const c = estimateCost(e.model, e.input ?? 0, e.output ?? 0);
    if (c === null) incomplete = true; else cost += c;
  }
  return { cost, runs, incomplete };
}

/**
 * Kosten eines geplanten Laufs: Token je Zeile aus bisherigen Läufen desselben
 * Modells, sonst Richtwert. null, wenn das Modell keinen Preis hat.
 */
export function estimateRunCost(entries: UsageEntry[], model: string | undefined, rows: number): { cost: number | null; basis: 'history' | 'default' } {
  let inp = 0, out = 0, n = 0;
  for (const e of entries) {
    if (e.kind !== 'ai' || e.model !== model || !e.rows || e.input === undefined) continue;
    inp += e.input; out += e.output ?? 0; n += e.rows;
  }
  const perIn  = n > 0 ? inp / n : DEFAULT_TOKENS_PER_ROW.input;
  const perOut = n > 0 ? out / n : DEFAULT_TOKENS_PER_ROW.output;
  return { cost: estimateCost(model, perIn * rows, perOut * rows), basis: n > 0 ? 'history' : 'default' };
}

export type BudgetLevel = 'none' | 'ok' | 'warn' | 'over';
export interface BudgetStatus {
  limit: number | null;
  /** Bisher im Monat (Schätzung) */
  spent: number;
  /** (spent + geplanter Lauf) / limit */
  ratio: number;
  level: BudgetLevel;
}

/** Stand gegen das Budget — `plus` = Schätzung des Laufs, der gerade starten soll */
export function budgetStatus(entries: UsageEntry[], budget: Budget, now = new Date(), plus = 0): BudgetStatus {
  const { cost } = monthCost(entries, now);
  if (!budget.monthlyUsd) return { limit: null, spent: cost, ratio: 0, level: 'none' };
  const ratio = (cost + plus) / budget.monthlyUsd;
  const level: BudgetLevel = cost >= budget.monthlyUsd || cost + plus > budget.monthlyUsd ? 'over' : ratio >= WARN_RATIO ? 'warn' : 'ok';
  return { limit: budget.monthlyUsd, spent: cost, ratio, level };
}

export const fmtUsd = (v: number | null | undefined): string =>
  v === null || v === undefined ? '–' : `${v.toLocaleString('de', { minimumFractionDigits: 2, maximumFractionDigits: v > 0 && v < 0.01 ? 4 : 2 })} $`;
