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
  return ns;
}

const fixture = (name) => path.join(DIR, 'fixtures', name);
const shot = (name) => path.join(SHOTS, name);
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };

module.exports = { BASE_URL, DIR, SHOTS, playwright, login, fixture, shot, ok };
