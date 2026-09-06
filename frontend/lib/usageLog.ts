import { lsSet, lsRemove } from './store';
import { estimateCost } from './aiPricing';

/**
 * Verbrauchsprotokoll: ein Eintrag je KI-Lauf (Spalte × Datensatz) und je
 * Enrichment-Lauf — Zeilen, Modell, Token, Dauer. Liegt im gemeinsamen
 * Speicher, damit alle Kollegen dieselbe Übersicht sehen.
 */
export interface UsageEntry {
  id: string;
  at: string;
  kind: 'ai' | 'enrich';
  datasetId: string;
  dataset: string;
  /** KI: Spaltenname · Enrichment: geholte Felder («E-Mail + Telefon») */
  what: string;
  provider: string;
  model?: string;
  /** Verarbeitete Zeilen (KI: neu klassifiziert, Cache-Treffer zählen nicht) */
  rows: number;
  input?: number;
  output?: number;
  /** Enrichment: Treffer (E-Mails + Telefonnummern) */
  found?: number;
  failed?: number;
  ms: number;
}

export const USAGE_KEY = 'usage_log';
export const MAX_ENTRIES = 500;

const read = (): UsageEntry[] => {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(e => e && typeof e === 'object' && typeof e.at === 'string') : [];
  } catch { return []; }
};

/** Neueste zuerst */
export function loadUsageLog(): UsageEntry[] {
  return read().sort((a, b) => b.at.localeCompare(a.at));
}

/** Eintrag anhängen; die ältesten fallen weg, sobald das Protokoll voll ist */
export function appendUsage(entry: Omit<UsageEntry, 'id' | 'at'> & Partial<Pick<UsageEntry, 'id' | 'at'>>): UsageEntry {
  const full: UsageEntry = {
    id: entry.id ?? `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: entry.at ?? new Date().toISOString(),
    ...entry,
  } as UsageEntry;
  const next = [...read(), full].sort((a, b) => a.at.localeCompare(b.at)).slice(-MAX_ENTRIES);
  lsSet(USAGE_KEY, JSON.stringify(next));
  return full;
}

export function clearUsageLog(): void {
  lsRemove(USAGE_KEY);
}

export interface ModelTotals {
  provider: string;
  model: string;
  runs: number;
  rows: number;
  input: number;
  output: number;
  /** Schätzung in USD, null wenn das Modell keinen Preis hat */
  cost: number | null;
}

export interface UsageSummary {
  runs: number;
  rows: number;
  input: number;
  output: number;
  /** Summe der schätzbaren Modelle */
  cost: number;
  /** true, wenn mindestens ein Modell keinen Preis hat (Summe ist dann unvollständig) */
  costIncomplete: boolean;
  byModel: ModelTotals[];
  enrich: { runs: number; rows: number; found: number };
}

/** Summen über die letzten `days` Tage (KI-Läufe nach Modell, Enrichment gesamt) */
export function summarizeUsage(entries: UsageEntry[], days = 30, now = Date.now()): UsageSummary {
  const since = now - days * 86_400_000;
  const recent = entries.filter(e => Date.parse(e.at) >= since);
  const byKey = new Map<string, ModelTotals>();
  const s: UsageSummary = { runs: 0, rows: 0, input: 0, output: 0, cost: 0, costIncomplete: false, byModel: [], enrich: { runs: 0, rows: 0, found: 0 } };
  for (const e of recent) {
    if (e.kind === 'enrich') {
      s.enrich.runs++; s.enrich.rows += e.rows; s.enrich.found += e.found ?? 0;
      continue;
    }
    s.runs++; s.rows += e.rows; s.input += e.input ?? 0; s.output += e.output ?? 0;
    const key = `${e.provider}/${e.model ?? ''}`;
    const m = byKey.get(key) ?? { provider: e.provider, model: e.model ?? '', runs: 0, rows: 0, input: 0, output: 0, cost: 0 };
    m.runs++; m.rows += e.rows; m.input += e.input ?? 0; m.output += e.output ?? 0;
    byKey.set(key, m);
  }
  for (const m of byKey.values()) {
    m.cost = estimateCost(m.model, m.input, m.output);
    if (m.cost === null) s.costIncomplete = true; else s.cost += m.cost;
  }
  s.byModel = [...byKey.values()].sort((a, b) => b.rows - a.rows);
  return s;
}

const PROVIDER_LABELS: Record<string, string> = { gemini: 'Gemini', anthropic: 'Claude', openai: 'GPT', hunter_io: 'Hunter.io', findymail: 'FindyMail' };
export const usageProviderLabel = (id: string) => PROVIDER_LABELS[id] ?? id;
