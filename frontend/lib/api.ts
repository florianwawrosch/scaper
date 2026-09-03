// Runtime override (Settings) → build-time env var → localhost
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    try {
      const override = localStorage.getItem('backendUrl');
      if (override) return override.replace(/\/+$/, '');
    } catch {}
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

/**
 * All backend calls go through the Next.js server proxy (/api/backend/...):
 * same-origin (no CORS) and the server injects API keys from its env vars
 * whenever the browser didn't send one. The real backend URL travels in a
 * header so the runtime override from Settings keeps working.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('x-backend-url', getApiBase());
  return fetch(`/api/backend${path}`, { ...init, headers });
}

async function extractError(res: Response, fallback: string): Promise<never> {
  let msg = `${fallback} (HTTP ${res.status})`;
  try {
    const body = await res.json();
    const detail = body.detail || body.error || body.message;
    if (detail) msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
  } catch {}
  throw new Error(msg);
}

export interface ScrapeRun {
  id: string;
  source: string;
  status: 'draft' | 'scraping' | 'dataset_ready' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
  rating: number;
  feedback: string;
  classification_results: Record<string, { keep: number; reject: number; unklar: number }>;
  scraper_config?: Record<string, unknown>;
}

export const api = {

  runs: {
    list: async () => {
      const res = await apiFetch(`/api/runs`);
      if (!res.ok) return extractError(res, 'Runs konnten nicht geladen werden');
      return res.json() as Promise<ScrapeRun[]>;
    },

    get: async (runId: string) => {
      const res = await apiFetch(`/api/runs/${runId}`);
      if (!res.ok) return extractError(res, 'Run konnte nicht geladen werden');
      return res.json() as Promise<ScrapeRun>;
    },

    update: async (runId: string, data: Partial<ScrapeRun>) => {
      const res = await apiFetch(`/api/runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) return extractError(res, 'Run konnte nicht aktualisiert werden');
      return res.json() as Promise<ScrapeRun>;
    },

    getDataset: async (runId: string) => {
      const res = await apiFetch(`/api/runs/${runId}/dataset`);
      if (!res.ok) return extractError(res, 'Datensatz konnte nicht geladen werden');
      return res.json();
    },

    analyze: async (runId: string, aiProvider: string, aiModel: string, prompt: string, columnName: string, apiKey?: string) => {
      const res = await apiFetch(`/api/runs/${runId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProvider, aiModel, prompt, column_name: columnName, apiKey }),
      });
      if (!res.ok) return extractError(res, 'Analyse fehlgeschlagen');
      return res.json() as Promise<{ column_name: string; values: string[] }>;
    },
  },

};
