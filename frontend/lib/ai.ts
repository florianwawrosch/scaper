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

/** Compute derived columns from already-split output columns. */
export function applyDerivedRules(
  rules: DerivedRule[],
  columns: Record<string, string[]>,
  rowCount: number,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const rule of rules) {
    out[rule.name] = Array.from({ length: rowCount }, (_, i) => {
      const ok = rule.allOf.every(c => c.anyOf.includes((columns[c.field]?.[i] ?? '').trim()));
      return ok ? rule.then : rule.else;
    });
  }
  return out;
}

/**
 * Run one AI column over all rows via /api/ai/analyze, in chunks so no single
 * request hits the serverless time limit. `onProgress` is called after each
 * chunk with the values collected so far (padded to the row count) so the UI
 * can stream results into the table. Throws with a readable message on error.
 */
export async function runAiColumn(opts: {
  rows: Record<string, string>[];
  provider: string;
  model: string;
  prompt: string;
  apiKey?: string;
  chunkSize?: number;
  inputColumns?: string[];
  multiOutput?: boolean;
  onProgress?: (partial: string[]) => void;
}): Promise<string[]> {
  const { rows, provider, model, prompt, apiKey, chunkSize = 20, inputColumns, multiOutput, onProgress } = opts;
  const values: string[] = [];

  for (let i = 0; i < rows.length; i += chunkSize) {
    const prompts = rows.slice(i, i + chunkSize).map(r => buildRowPrompt(r, prompt, inputColumns, multiOutput));
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
    values.push(...(data.values ?? []));
    onProgress?.([...values, ...Array(Math.max(0, rows.length - values.length)).fill('·')]);
  }
  return values;
}
