// Auth primitives shared by proxy.ts and the API routes. Nothing here may
// depend on the Node `crypto` module (proxy may run on the Edge runtime).

export const AUTH_COOKIE = 'app_auth';
/** One login per browser, then a year of peace — changing user or password logs everyone out. */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Login credentials from the server env. `missing` names what still has to be set in Vercel. */
export function authEnv(): { user: string; password: string; missing: string[] } {
  const user = process.env.APP_USER ?? '';
  const password = process.env.APP_PASSWORD ?? '';
  const missing: string[] = [];
  if (!user) missing.push('APP_USER');
  if (!password) missing.push('APP_PASSWORD');
  return { user, password, missing };
}

/**
 * Constant-time string compare — plain !== leaks timing info character-by-
 * character, letting an attacker guess a secret one byte at a time.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Session token stored in the cookie: HMAC-SHA256 keyed with user+password
 * over a fixed label. The cookie therefore never carries the credentials (a
 * leaked cookie can't be read back into them), stays valid as long as they
 * don't change, and is invalidated on every device the moment either does.
 * Web Crypto, so it works in both runtimes.
 */
export async function authToken(user: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(`${user}\n${password}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('app_auth_v2'));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
}
