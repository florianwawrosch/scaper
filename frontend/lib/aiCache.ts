// feld_hash-Cache (wie im Sheet): Welche Zeilen muss ein KI-Lauf wirklich
// klassifizieren? Unveränderter Prompt + unveränderte Eingabewerte + schon ein
// brauchbares Ergebnis = übersprungen, kostet keine Credits. Fehler-Zeilen und
// geänderte Zeilen laufen erneut. Reine Funktionen, unit-getestet.
import { shortHash, rowFingerprint, isUsableAiValue, type AnalysisConfig } from './ai';

/** Gespeicherter Stand eines Laufs je Config (localStorage analysis_hashes_<id>) */
export interface HashEntry { promptHash: string; rowHashes: string[] }
export type HashStore = Record<string, HashEntry>;

/** Alles, was die Antwort beeinflusst: Anbieter, Modell, Prompt, Eingabespalten */
export const configHash = (cfg: Pick<AnalysisConfig, 'provider' | 'model' | 'prompt' | 'inputColumns'>): string =>
  shortHash([cfg.provider, cfg.model, cfg.prompt, ...(cfg.inputColumns ?? [])].join('\x1f'));

export interface RunPlan {
  /** Zeilenindizes, die klassifiziert werden müssen */
  todo: number[];
  /** Zeilen, die dank Cache übersprungen werden */
  skipped: number;
  promptHash: string;
  rowHashes: string[];
}

/**
 * Lauf planen: `existing` sind die aktuellen Werte der Spalte (Platzhalter,
 * Fehler oder Ergebnis je Zeile), `prev` der gespeicherte Stand des letzten Laufs.
 */
export function planRun(
  rows: Record<string, string>[],
  cfg: Pick<AnalysisConfig, 'provider' | 'model' | 'prompt' | 'inputColumns'>,
  existing: (string | undefined)[],
  prev?: HashEntry,
): RunPlan {
  const promptHash = configHash(cfg);
  const rowHashes = rows.map(r => rowFingerprint(r, cfg.inputColumns));
  const todo: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const cached = prev?.promptHash === promptHash && prev.rowHashes[i] === rowHashes[i] && isUsableAiValue(existing[i]);
    if (!cached) todo.push(i);
  }
  return { todo, skipped: rows.length - todo.length, promptHash, rowHashes };
}

export function readHashStore(raw: string | null): HashStore {
  try { const v = JSON.parse(raw ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
