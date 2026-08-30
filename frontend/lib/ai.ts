// Shared AI provider metadata and the chunked analysis runner used by both
// the CSV viewer (in-table columns) and the AnalysisPanel.

export interface AiProvider {
  id: string;
  label: string;
  models: string[];
}

export const AI_PROVIDERS: AiProvider[] = [
  { id: 'gemini',    label: 'Gemini', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'anthropic', label: 'Claude', models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'] },
  { id: 'openai',    label: 'GPT',    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
];

export const providerLabel = (id: string) =>
  AI_PROVIDERS.find(p => p.id === id)?.label ?? id;

export const modelsFor = (id: string) =>
  AI_PROVIDERS.find(p => p.id === id)?.models ?? [];

export const defaultModel = (id: string) => modelsFor(id)[0] ?? '';

/** Same per-row prompt format the Python backend used (main.py analyze_run). */
export function buildRowPrompt(row: Record<string, string>, userPrompt: string): string {
  const rowText = Object.entries(row)
    .filter(([k, v]) => k !== '_idx' && v && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `${userPrompt}\n\nDaten:\n${rowText}\n\nAntworte nur kurz und direkt.`;
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
  onProgress?: (partial: string[]) => void;
}): Promise<string[]> {
  const { rows, provider, model, prompt, apiKey, chunkSize = 20, onProgress } = opts;
  const values: string[] = [];

  for (let i = 0; i < rows.length; i += chunkSize) {
    const prompts = rows.slice(i, i + chunkSize).map(r => buildRowPrompt(r, prompt));
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
