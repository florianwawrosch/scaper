// Shared AI provider metadata and the chunked analysis runner used by both
// the CSV viewer (in-table columns) and the AnalysisPanel.

export interface AiProvider {
  id: string;
  label: string;
  models: string[];
}

export const AI_PROVIDERS: AiProvider[] = [
  { id: 'gemini',    label: 'Gemini', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'anthropic', label: 'Claude', models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] },
  { id: 'openai',    label: 'GPT',    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
];

export const providerLabel = (id: string) =>
  AI_PROVIDERS.find(p => p.id === id)?.label ?? id;

export const modelsFor = (id: string) =>
  AI_PROVIDERS.find(p => p.id === id)?.models ?? [];

export const defaultModel = (id: string) => modelsFor(id)[0] ?? '';

/** Same per-row prompt format the Python backend used (main.py analyze_run). */
export function buildRowPrompt(
  row: Record<string, string>,
  userPrompt: string,
  inputColumns?: string[],
  bare?: boolean,
): string {
  const entries = inputColumns?.length
    ? inputColumns.map(k => [k, row[k] ?? ''] as [string, string])
    : Object.entries(row);
  const rowText = entries
    .filter(([k, v]) => k !== '_idx' && v && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return bare
    ? `${userPrompt}\n${rowText}`
    : `${userPrompt}\n\nDaten:\n${rowText}\n\nAntworte nur kurz und direkt.`;
}

/** djb2 — short, stable fingerprint for cache keys (like the sheet's feld_hash). */
export function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** Fingerprint of the row values that actually go into the prompt. */
export function rowFingerprint(row: Record<string, string>, inputColumns?: string[]): string {
  const entries = inputColumns?.length
    ? inputColumns.map(k => [k, row[k] ?? ''] as [string, string])
    : Object.entries(row).filter(([k]) => k !== '_idx');
  return shortHash(entries.map(([k, v]) => `${k}=${v}`).join('\x1f'));
}

// Sentinel contract for AI cell values — shared by pipeline, table and the
// analyze route (which mints the "Fehler:" strings): '·' = pending/not run,
// "Fehler: …" = failed and will be retried on the next run.
export const PENDING = '·';
export const isPendingAiValue = (v: string | undefined): boolean => v === PENDING;
export const isAiError = (v: string | undefined): boolean => !!v?.startsWith('Fehler:');

/** A stored value that makes a re-run unnecessary (not empty/pending/failed). */
export const isUsableAiValue = (v: string | undefined): boolean =>
  !!v && !isPendingAiValue(v) && !isAiError(v);

/** Split pipe-separated multi-value answers into one value array per field. */
export function splitMultiOutput(values: string[], fields: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  fields.forEach(f => { out[f] = []; });
  for (const raw of values) {
    const s = String(raw ?? '').trim();
    if (s === '·') { fields.forEach(f => out[f].push('·')); continue; }
    // Fehlerhafte Antworten bleiben in der Roh-Spalte sichtbar; Splits bleiben leer
    if (s.startsWith('Fehler:')) { fields.forEach(f => out[f].push('')); continue; }
    const parts = s.split('|').map(p => p.trim());
    fields.forEach((f, i) => out[f].push(parts[i] ?? ''));
  }
  return out;
}

/**
 * Validate + normalize one pipe-separated multi-output answer against the
 * allowed values per field (case-insensitive; the canonical spelling wins).
 * Returns the normalized answer, or an error string starting with "Fehler:"
 * so the row is retried on the next run.
 */
export function normalizeMultiOutput(
  raw: string,
  fields: string[],
  enums?: Record<string, string[]>,
): string {
  const s = String(raw ?? '').trim();
  if (s === '·' || s.startsWith('Fehler:')) return s;
  const parts = s.split('|').map(p => p.trim());
  if (parts.length !== fields.length) {
    return `Fehler: Ungültige Antwort (${parts.length} statt ${fields.length} Werte) — "${s.slice(0, 80)}"`;
  }
  if (!enums) return parts.join(' | ');
  const norm: string[] = [];
  for (let i = 0; i < fields.length; i++) {
    const allowed = enums[fields[i]];
    if (!allowed?.length) { norm.push(parts[i]); continue; }
    const hit = allowed.find(a => a.toLowerCase() === parts[i].toLowerCase());
    if (!hit) return `Fehler: "${parts[i]}" ist kein erlaubter Wert für ${fields[i]}`;
    norm.push(hit);
  }
  return norm.join(' | ');
}

/** Serializable rule for a column derived from other columns (all conditions must hold). */
export interface DerivedRule {
  name: string;
  allOf: { field: string; anyOf: string[] }[];
  then: string;
  else: string;
}

/** Eine KI-Spalte eines Datensatzes (Konfiguration, ohne Ergebnisse) */
export interface AnalysisConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  prompt: string;
  /** Only these row columns go into the prompt (all non-empty columns otherwise) */
  inputColumns?: string[];
  /** Pipe-separated answer is split into these columns (multi-output template) */
  outputFields?: string[];
  /** Allowed values per output field — answers outside become "Fehler:" and re-run */
  outputEnums?: Record<string, string[]>;
  /** Rule columns computed from the split output fields */
  derived?: DerivedRule[];
  /** Template version the prompt came from (e.g. "v5") — shown in the column label */
  promptVersion?: string;
  /** Gespeicherte KI-Spalte (Einstellungen), aus der diese Config geladen wurde — verhindert doppeltes Laden */
  presetId?: string;
}

/** Compute derived columns from already-split output columns. */
export function applyDerivedRules(
  rules: DerivedRule[],
  columns: Record<string, string[]>,
  rowCount: number,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const rule of rules) {
    out[rule.name] = Array.from({ length: rowCount }, (_, i) => {
      const values = rule.allOf.map(c => (columns[c.field]?.[i] ?? '').trim());
      // A required field that's still pending ('·', not classified yet in
      // this run) or empty (cleared by splitMultiOutput after a "Fehler:"
      // response) means this row hasn't actually been evaluated — falling
      // through to "else" here would mislabel a not-yet-classified row as
      // definitively excluded from the target audience, and that mislabel
      // can now outlive the run (e.g. persisted on a mid-run failure).
      if (values.some(v => v === '' || v === PENDING)) return PENDING;
      const ok = rule.allOf.every((c, j) => c.anyOf.includes(values[j]));
      return ok ? rule.then : rule.else;
    });
  }
  return out;
}

/**
 * Wie viele 20er-Chunks gleichzeitig an /api/ai/analyze gehen. Der Server
 * fährt pro Request 4 Provider-Aufrufe parallel, also 12 gleichzeitige Calls
 * bei 3 Chunks — für Claude/OpenAI-Limits unkritisch. Geminis Free-Tier
 * (15 Anfragen/Minute) verträgt nur einen Chunk auf einmal.
 */
const PARALLEL_CHUNKS: Record<string, number> = { anthropic: 3, openai: 3, gemini: 1 };

/**
 * Run one AI column over all rows via /api/ai/analyze, in chunks so no single
 * request hits the serverless time limit. Several chunks run concurrently
 * (provider-dependent); `onProgress` is called after each finished chunk with
 * the values collected so far — unfinished slots hold PENDING, and chunks may
 * complete out of order — so the UI can stream results into the table.
 * Throws with a readable message on the first failed chunk.
 */
export async function runAiColumn(opts: {
  rows: Record<string, string>[];
  provider: string;
  model: string;
  prompt: string;
  apiKey?: string;
  chunkSize?: number;
  /** Gleichzeitige Chunks (Standard: je Provider, siehe PARALLEL_CHUNKS) */
  parallel?: number;
  inputColumns?: string[];
  multiOutput?: boolean;
  onProgress?: (partial: string[]) => void;
}): Promise<string[]> {
  const { rows, provider, model, prompt, apiKey, chunkSize = 20, inputColumns, multiOutput, onProgress } = opts;
  const parallel = Math.max(1, opts.parallel ?? PARALLEL_CHUNKS[provider] ?? 2);
  const values: string[] = Array(rows.length).fill(PENDING);
  const starts: number[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) starts.push(i);

  const runChunk = async (start: number) => {
    const prompts = rows.slice(start, start + chunkSize).map(r => buildRowPrompt(r, prompt, inputColumns, multiOutput));
    const res = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, prompts, ...(apiKey && { apiKey }) }),
    });
    if (!res.ok) {
      let msg = `Analyse fehlgeschlagen (HTTP ${res.status})`;
      try { msg = (await res.json()).detail ?? msg; } catch {}
      throw new Error(msg);
    }
    const data = await res.json();
    const got: string[] = data.values ?? [];
    for (let j = 0; j < prompts.length; j++) values[start + j] = got[j] ?? `Fehler: keine Antwort`;
    onProgress?.([...values]);
  };

  // Worker-Pool: jeder Worker zieht den nächsten Chunk; der erste Fehler
  // bricht ab (laufende Chunks liefern ihre Werte noch per onProgress).
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(parallel, starts.length) }, async () => {
      while (next < starts.length) await runChunk(starts[next++]);
    }),
  );
  return values;
}
