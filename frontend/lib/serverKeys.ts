// Server-side only: maps provider ids to every env var name we accept.
// Users name their Vercel vars differently (META_API_KEY, FINDYMAIL_API_KEY, ...)
// — first match wins. Der erste Name je Anbieter ist der empfohlene (wird in
// den Einstellungen angezeigt).
export const KEY_ENV: Record<string, string[]> = {
  meta_ads:  ['META_API_KEY', 'META_ADS_TOKEN', 'META_ADS_API_TOKEN', 'META_TOKEN', 'NEXT_PUBLIC_META_ADS_TOKEN'],
  openai:    ['OPENAI_API_KEY', 'NEXT_PUBLIC_OPENAI_API_KEY'],
  gemini:    ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'NEXT_PUBLIC_GEMINI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'NEXT_PUBLIC_ANTHROPIC_API_KEY'],
  hunter_io: ['HUNTER_IO_KEY', 'HUNTER_IO_API_KEY', 'HUNTER_API_KEY', 'NEXT_PUBLIC_HUNTER_IO_KEY'],
  findymail: ['FINDYMAIL_API_KEY', 'FINDYMAIL_KEY', 'NEXT_PUBLIC_FINDYMAIL_KEY'],
};

export function envKey(provider: string): string {
  for (const name of KEY_ENV[provider] ?? []) {
    const v = process.env[name];
    if (v) return v;
  }
  return '';
}

/** Which providers have a key on this server — booleans only, safe to expose. */
export function availableKeys(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const p of Object.keys(KEY_ENV)) out[p] = !!envKey(p);
  return out;
}

/** Was die Einstellungen anzeigen: wo die Keys liegen und wie man hinkommt — nie die Keys selbst */
export interface KeySetup {
  providers: Record<string, boolean>;
  /** Empfohlener Variablenname je Anbieter */
  envNames: Record<string, string>;
  /** 'vercel' = läuft auf Vercel (Keys in den Projekt-Einstellungen), 'local' = Dev-Server (.env.local) */
  hosted: 'vercel' | 'local';
  /** Link zu den Umgebungsvariablen: ENV_SETTINGS_URL, sonst das Vercel-Dashboard */
  settingsUrl: string;
  /** Projektname auf Vercel (aus der Produktions-URL), für den Klickpfad */
  project: string;
}

export function keySetup(env: NodeJS.ProcessEnv = process.env): KeySetup {
  const envNames: Record<string, string> = {};
  for (const [p, names] of Object.entries(KEY_ENV)) envNames[p] = names[0];
  const hosted = env.VERCEL ? 'vercel' : 'local';
  const project = (env.VERCEL_PROJECT_PRODUCTION_URL ?? '').split('.')[0] || '';
  const settingsUrl = env.ENV_SETTINGS_URL || 'https://vercel.com/dashboard';
  return { providers: availableKeys(), envNames, hosted, settingsUrl, project };
}
