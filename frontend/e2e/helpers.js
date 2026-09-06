// Gemeinsame Helfer für die Playwright-E2E-Tests (siehe e2e/README in der Haupt-README).
// Voraussetzung: `npm run dev` läuft (BASE_URL, Standard http://localhost:3000)
// und .env.local enthält APP_USER/APP_PASSWORD — dieselben Werte hier als Env setzen.
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DIR = __dirname;
const SHOTS = path.join(DIR, '.shots');
fs.mkdirSync(SHOTS, { recursive: true });

/** Playwright: lokale devDependency, sonst globale Installation */
function playwright() {
  try { return require('playwright'); }
  catch { return require('/opt/node22/lib/node_modules/playwright'); }
}

/**
 * Loggt den Browser-Kontext über das echte /api/auth ein und gibt ihm einen
 * eigenen Namensraum im gemeinsamen Speicher (Datei-Treiber der Entwicklung),
 * damit Testläufe sich nicht gegenseitig Daten unterschieben. Zwei Kontexte
 * mit demselben `ns` teilen sich den Speicher (Kollegen-Szenario).
 */
async function login(page, ns = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)) {
  const r = await page.request.post(`${BASE_URL}/api/auth`, {
    data: { username: process.env.APP_USER || 'florian', password: process.env.APP_PASSWORD || 'testpass123' },
  });
  if (!r.ok()) throw new Error(`login failed HTTP ${r.status()}: ${await r.text()} — APP_USER/APP_PASSWORD passend zu .env.local setzen`);
  await page.context().addCookies([{ name: 'lp_ns', value: ns, url: BASE_URL }]);
  // Unter paralleler Testlast braucht «networkidle» länger — großzügige Timeouts statt Flakes
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(45000);
  return ns;
}

/**
 * API-Keys liegen nur auf dem Server: der Test tut so, als hätten die genannten
 * Anbieter dort einen Key (Antwort von /api/keys/available).
 */
const ALL_PROVIDERS = ['meta_ads', 'openai', 'gemini', 'anthropic', 'hunter_io', 'findymail'];
const ENV_NAMES = { meta_ads: 'META_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', hunter_io: 'HUNTER_IO_KEY', findymail: 'FINDYMAIL_API_KEY' };
async function mockKeys(page, providers = [], extra = {}) {
  const providersMap = Object.fromEntries(ALL_PROVIDERS.map(p => [p, providers.includes(p)]));
  const setup = { providers: providersMap, envNames: ENV_NAMES, hosted: 'vercel', settingsUrl: 'https://vercel.com/dashboard', project: 'scaper', ...extra };
  await page.route('**/api/keys/available', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(setup) }));
}

const fixture = (name) => path.join(DIR, 'fixtures', name);
const shot = (name) => path.join(SHOTS, name);
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };

module.exports = { BASE_URL, DIR, SHOTS, playwright, login, mockKeys, fixture, shot, ok };
