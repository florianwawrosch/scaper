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

// Env vars (NEXT_PUBLIC_*) as fallback when localStorage has no key saved yet.
const ENV_KEYS: Record<keyof AppSettings['apiKeys'], string | undefined> = {
  gemini:    process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  anthropic: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
  openai:    process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  meta_ads:  process.env.NEXT_PUBLIC_META_ADS_TOKEN,
  hunter_io: process.env.NEXT_PUBLIC_HUNTER_IO_KEY,
  findymail:  process.env.NEXT_PUBLIC_FINDYMAIL_KEY,
};

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const base: AppSettings = stored ? JSON.parse(stored) : { ...DEFAULT_SETTINGS };
    // Fill any missing key from env var fallbacks
    for (const k of Object.keys(ENV_KEYS) as (keyof AppSettings['apiKeys'])[]) {
      if (!base.apiKeys[k] && ENV_KEYS[k]) base.apiKeys[k] = ENV_KEYS[k]!;
    }
    return base;
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

/**
 * Fetch keys the server holds as env vars (any naming variant, no NEXT_PUBLIC_
 * needed) and fill them into localStorage — only where no key is set locally,
 * so user-entered keys always win. Returns true if anything was added.
 */
export async function syncServerKeys(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const res = await fetch('/api/keys', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const serverKeys: Record<string, string> = await res.json();
    if (!serverKeys || typeof serverKeys !== 'object') return false;

    const current = loadSettings();
    let changed = false;
    for (const k of Object.keys(current.apiKeys) as (keyof AppSettings['apiKeys'])[]) {
      if (!current.apiKeys[k] && serverKeys[k]) {
        current.apiKeys[k] = serverKeys[k];
        changed = true;
      }
    }
    if (changed) saveSettings(current);
    return changed;
  } catch {
    return false;
  }
}

export function getApiKey(provider: string): string {
  const settings = loadSettings();
  const key = settings.apiKeys[provider as keyof typeof settings.apiKeys];
  return key || '';
}

