const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ScrapeRun {
  id: string;
  source_key: string;
  status: 'draft' | 'scraping' | 'dataset_ready' | 'in_progress' | 'completed' | 'failed';
  raw_dataset: Record<string, unknown>[];
  filtered_dataset: Record<string, unknown>[];
  enriched_dataset: Record<string, unknown>[];
  exported_data: unknown;
  config: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
  keep_count: number;
  reject_count: number;
  unklar_count: number;
  rating: number | null;
  feedback: string | null;
  error_message: string | null;
}

export interface Source {
  key: string;
  label: string;
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

    create: async (sourceKey: string, config: Record<string, unknown>) => {
      const res = await fetch(`${API_BASE}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_key: sourceKey, config }),
      });
      if (!res.ok) throw new Error('Failed to create run');
      return res.json() as Promise<ScrapeRun>;
    },

    uploadRawData: async (runId: string, data: Record<string, unknown>[]) => {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) throw new Error('Failed to upload data');
      return res.json() as Promise<ScrapeRun>;
    },

    getDataset: async (runId: string, datasetType: 'raw' | 'filtered' | 'enriched') => {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/dataset?type=${datasetType}`);
      if (!res.ok) throw new Error('Failed to fetch dataset');
      return res.json() as Promise<Record<string, unknown>[]>;
    },

    updateDataset: async (runId: string, datasetType: 'filtered' | 'enriched', data: Record<string, unknown>[]) => {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/dataset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: datasetType, data }),
      });
      if (!res.ok) throw new Error('Failed to update dataset');
      return res.json() as Promise<ScrapeRun>;
    },

    classify: async (runId: string) => {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/classify`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to classify');
      return res.json() as Promise<ScrapeRun>;
    },

    updateRating: async (runId: string, rating: number, feedback: string) => {
      const res = await fetch(`${API_BASE}/api/runs/${runId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, feedback }),
      });
      if (!res.ok) throw new Error('Failed to update run');
      return res.json() as Promise<ScrapeRun>;
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
