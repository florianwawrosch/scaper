import type { AnalysisConfig } from '@/app/components/AnalysisPanel';

export interface AiColumnTemplate {
  name: string;
  provider: 'gemini' | 'anthropic' | 'openai';
  model?: string;
  prompt: string;
  description?: string;
}

export interface ImportPreset {
  id: string;
  name: string;
  description?: string;
  source: 'linkedin' | 'csv' | 'generic';
  columns: AiColumnTemplate[];
}

export const PRESET_LINKEDIN_SEARCH: ImportPreset = {
  id: 'linkedin_search',
  name: 'LinkedIn — Profilsuche',
  description: 'Vordefiniert für LinkedIn-Profile aus Suchresultaten',
  source: 'linkedin',
  columns: [
    {
      name: 'Qualifizierung',
      provider: 'anthropic',
      prompt: 'Ist dies ein qualifiziertes Lead-Profil basierend auf Branche, Position und Erfahrung? Antworte kurz mit: QUALIFIZIERT, EVENTUELL oder NICHT_QUALIFIZIERT',
      description: 'Lead-Qualifizierung nach Standard-Kriterien',
    },
    {
      name: 'Industrie',
      provider: 'anthropic',
      prompt: 'Welche Branche/Industrie wird durch dieses Profil hauptsächlich repräsentiert? Antworte mit einer Kategorie (z.B. Tech, Finanzen, Vertrieb, etc.)',
      description: 'Automatische Branchenklassifizierung',
    },
    {
      name: 'Seniority',
      provider: 'anthropic',
      prompt: 'Welche Seniority-Stufe hat diese Person? Antworte kurz: EXECUTIVE, SENIOR, MID, JUNIOR, oder KEINE_ANGABE',
      description: 'Erfahrungsstufe des Profils',
    },
  ],
};

export const PRESET_LINKEDIN_COMMENTS: ImportPreset = {
  id: 'linkedin_comments',
  name: 'LinkedIn — Kommentare',
  description: 'Vordefiniert für LinkedIn-Kommentare und Engagement-Daten',
  source: 'linkedin',
  columns: [
    {
      name: 'Sentiment',
      provider: 'anthropic',
      prompt: 'Klassifiziere das Sentiment dieses Kommentars. Antworte mit: POSITIV, NEUTRAL oder NEGATIV',
      description: 'Sentiment-Analyse des Kommentars',
    },
    {
      name: 'Engagement-Qualität',
      provider: 'anthropic',
      prompt: 'Ist dies ein hochwertiger, durchdachter Kommentar oder oberflächlich? Antworte: HOCHWERTIG, MITTEL oder OBERFLÄCHLICH',
      description: 'Bewertung der Engagement-Qualität',
    },
    {
      name: 'Relevanz',
      provider: 'anthropic',
      prompt: 'Ist dieser Kommentar für Lead-Generierung relevant? Antworte: RELEVANT, EVENTUELL oder IRRELEVANT',
      description: 'Relevanz für Sales-Pipeline',
    },
  ],
};

export const PRESET_GENERIC_CSV: ImportPreset = {
  id: 'generic_csv',
  name: 'Generische CSV',
  description: 'Einfache Klassifizierung für beliebige CSV-Daten',
  source: 'csv',
  columns: [
    {
      name: 'Klassifizierung',
      provider: 'anthropic',
      prompt: 'Klassifiziere diese Zeile nach Relevanz. Antworte kurz: KEEP oder DROP',
      description: 'Relevanz-Klassifizierung',
    },
  ],
};

export const ALL_PRESETS: ImportPreset[] = [
  PRESET_LINKEDIN_SEARCH,
  PRESET_LINKEDIN_COMMENTS,
  PRESET_GENERIC_CSV,
];

/** Get all presets for a given source type */
export function getPresetsForSource(source: 'linkedin' | 'csv' | 'generic'): ImportPreset[] {
  return ALL_PRESETS.filter(p => p.source === source);
}

/** Convert a preset's column templates into AnalysisConfig objects */
export function templateToConfig(template: AiColumnTemplate, index: number): AnalysisConfig {
  return {
    id: `cfg_preset_${Date.now()}_${index}`,
    name: template.name,
    provider: template.provider,
    model: template.model || 'claude-3-5-sonnet-20241022',
    prompt: template.prompt,
  };
}

/** Load a preset and return its configurations */
export function loadPreset(presetId: string): AnalysisConfig[] | null {
  const preset = ALL_PRESETS.find(p => p.id === presetId);
  if (!preset) return null;
  return preset.columns.map((col, idx) => templateToConfig(col, idx));
}

/** Save a custom preset to localStorage */
export function saveCustomPreset(preset: ImportPreset): void {
  try {
    const key = `custom_preset_${preset.id}`;
    localStorage.setItem(key, JSON.stringify(preset));
  } catch {}
}

/** Load all custom presets from localStorage */
export function loadCustomPresets(): ImportPreset[] {
  const presets: ImportPreset[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('custom_preset_')) {
        const data = localStorage.getItem(key);
        if (data) presets.push(JSON.parse(data));
      }
    }
  } catch {}
  return presets;
}
