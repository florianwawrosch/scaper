const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  runs: {
    list: async () => {
      const res = await fetch(`${API_BASE}/api/runs`);
      if (!res.ok) throw new Error('Failed to fetch runs');
      return res.json() as Promise<ScrapeRun[]>;
    },

    get: async (runId: string) => {
      const res = await fetch(`${API_BASE}/api/runs/${runId}`);
      if (!res.ok) throw new Error('Failed to fetch run');
      return res.json() as Promise<ScrapeRun>;
    },

    create: async (source: string, scraperConfig?: Record<string, unknown>) => {
      const res = await fetch(`${API_BASE}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, scraper_config: scraperConfig }),
      });
      if (!res.ok) throw new Error('Failed to create run');
      return res.json() as Promise<ScrapeRun>;
    },

    update: async (runId: string, data: Partial<ScrapeRun>) => {
      const res = await fetch(`${API_BASE}/api/runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update run');
      return res.json() as Promise<ScrapeRun>;
    },

    getDataset: async (runId: string) => {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/dataset`);
      if (!res.ok) throw new Error('Failed to fetch dataset');
      return res.json();
    },

    saveDataset: async (runId: string, dfData: unknown[], mapping: Record<string, unknown>) => {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/dataset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ df_data: dfData, mapping }),
      });
      if (!res.ok) throw new Error('Failed to save dataset');
      return res.json();
    },

    upload: async (runId: string, formData: FormData) => {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload file');
      return res.json();
    },

    classify: async (runId: string, aiProvider: string, aiModel: string, dfData?: unknown[], mapping?: Record<string, unknown>) => {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProvider, aiModel, df_data: dfData, mapping }),
      });
      if (!res.ok) throw new Error('Failed to classify');
      return res.json();
    },
  },

  sources: {
    list: async () => {
      const res = await fetch(`${API_BASE}/api/sources`);
      if (!res.ok) throw new Error('Failed to fetch sources');
      return res.json() as Promise<Source[]>;
    },

    getPresets: async (sourceKey: string) => {
      const res = await fetch(`${API_BASE}/api/sources/${sourceKey}/presets`);
      if (!res.ok) throw new Error('Failed to fetch presets');
      return res.json() as Promise<Preset[]>;
    },

    savePreset: async (sourceKey: string, name: string, config: Record<string, unknown>) => {
      const res = await fetch(`${API_BASE}/api/sources/${sourceKey}/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config }),
      });
      if (!res.ok) throw new Error('Failed to save preset');
      return res.json() as Promise<Preset>;
    },
  },
};
