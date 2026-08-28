export interface AppSettings {
  apiKeys: {
    meta_ads: string;
    hunter_io: string;
    findymail: string;
    anthropic: string;
    gemini: string;
    openai: string;
  };
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
  apiKeys: {
    meta_ads: '',
    hunter_io: '',
    findymail: '',
    anthropic: '',
    gemini: '',
    openai: '',
  },
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

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function getApiKey(provider: string): string {
  const settings = loadSettings();
  const key = settings.apiKeys[provider as keyof typeof settings.apiKeys];
  return key || '';
}

export function getAiConfig() {
  const settings = loadSettings();
  return settings.aiConfig;
}
