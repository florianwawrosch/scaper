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

const API_BASE = getApiBase();

export const API_URL = API_BASE;

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

export interface Source {
  key: string;
  label: string;
  name?: string;
  description: string;
  config_schema: Record<string, unknown>;
}

export interface Preset {
  name: string;
  config: Record<string, unknown>;
  created_at: string;
}

export const api = {
  health: async () => {
    const res = await fetch(`${getApiBase()}/api/health`);
    if (!res.ok) return extractError(res, 'Health check fehlgeschlagen');
    return res.json();
  },

  runs: {
    list: async () => {
      const res = await fetch(`${getApiBase()}/api/runs`);
      if (!res.ok) return extractError(res, 'Runs konnten nicht geladen werden');
      return res.json() as Promise<ScrapeRun[]>;
    },

    get: async (runId: string) => {
      const res = await fetch(`${getApiBase()}/api/runs/${runId}`);
      if (!res.ok) return extractError(res, 'Run konnte nicht geladen werden');
      return res.json() as Promise<ScrapeRun>;
    },

    create: async (source: string, scraperConfig?: Record<string, unknown>) => {
      const res = await fetch(`${getApiBase()}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, scraper_config: scraperConfig }),
      });
      if (!res.ok) return extractError(res, 'Run konnte nicht erstellt werden');
      return res.json() as Promise<ScrapeRun>;
    },

    update: async (runId: string, data: Partial<ScrapeRun>) => {
      const res = await fetch(`${getApiBase()}/api/runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) return extractError(res, 'Run konnte nicht aktualisiert werden');
      return res.json() as Promise<ScrapeRun>;
    },

    getDataset: async (runId: string) => {
      const res = await fetch(`${getApiBase()}/api/runs/${runId}/dataset`);
      if (!res.ok) return extractError(res, 'Datensatz konnte nicht geladen werden');
      return res.json();
    },

    saveDataset: async (runId: string, dfData: unknown[], mapping: Record<string, unknown>) => {
      const res = await fetch(`${getApiBase()}/api/runs/${runId}/dataset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ df_data: dfData, mapping }),
      });
      if (!res.ok) return extractError(res, 'Datensatz konnte nicht gespeichert werden');
      return res.json();
    },

    upload: async (runId: string, formData: FormData) => {
      const res = await fetch(`${getApiBase()}/api/runs/${runId}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) return extractError(res, 'Upload fehlgeschlagen');
      return res.json();
    },

    classify: async (runId: string, aiProvider: string, aiModel: string, dfData?: unknown[], mapping?: Record<string, unknown>, apiKey?: string) => {
      const res = await fetch(`${getApiBase()}/api/runs/${runId}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProvider, aiModel, df_data: dfData, mapping, apiKey }),
      });
      if (!res.ok) return extractError(res, 'Klassifizierung fehlgeschlagen');
      return res.json();
    },

    analyze: async (runId: string, aiProvider: string, aiModel: string, prompt: string, columnName: string, apiKey?: string) => {
      const res = await fetch(`${getApiBase()}/api/runs/${runId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProvider, aiModel, prompt, column_name: columnName, apiKey }),
      });
      if (!res.ok) return extractError(res, 'Analyse fehlgeschlagen');
      return res.json() as Promise<{ column_name: string; values: string[] }>;
    },
  },

  sources: {
    list: async () => {
      const res = await fetch(`${getApiBase()}/api/sources`);
      if (!res.ok) return extractError(res, 'Quellen konnten nicht geladen werden');
      return res.json() as Promise<Source[]>;
    },

    getPresets: async (sourceKey: string) => {
      const res = await fetch(`${getApiBase()}/api/sources/${sourceKey}/presets`);
      if (!res.ok) return extractError(res, 'Presets konnten nicht geladen werden');
      return res.json() as Promise<Preset[]>;
    },

    savePreset: async (sourceKey: string, name: string, config: Record<string, unknown>) => {
      const res = await fetch(`${getApiBase()}/api/sources/${sourceKey}/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config }),
      });
      if (!res.ok) return extractError(res, 'Preset konnte nicht gespeichert werden');
      return res.json() as Promise<Preset>;
    },
  },
};
