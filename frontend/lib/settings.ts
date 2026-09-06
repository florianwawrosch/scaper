export interface AppSettings {
  aiConfig: {
    provider: 'gemini' | 'anthropic' | 'openai';
    model: string;
  };
  defaults: {
    countries: string[];
    platforms: string[];
  };
  theme: 'noir' | 'classic';
}

const STORAGE_KEY = 'appSettings';
const DEFAULT_SETTINGS: AppSettings = {
  aiConfig: {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
  },
  defaults: {
    countries: ['DE', 'AT'],
    platforms: ['FACEBOOK', 'INSTAGRAM'],
  },
  theme: 'noir',
};

/**
 * Anzeige-Einstellungen dieses Browsers. API-Keys gehören NICHT hierher: die
 * liegen ausschließlich als Umgebungsvariablen auf dem Server (lib/serverKeys.ts).
 * Ältere Versionen haben Keys im Browser gespeichert — die werden beim ersten
 * Laden entfernt, damit auf keinem Rechner ein Key zurückbleibt.
 */
export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(stored) as AppSettings & { apiKeys?: unknown };
    if ('apiKeys' in parsed) {
      delete parsed.apiKeys;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}
