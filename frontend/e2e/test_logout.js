// Abmelden: Header-Button löscht den Cookie, danach ist die App wieder gesperrt
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await login(page);
  await page.goto(`${BASE_URL}/runs`, { waitUntil: 'networkidle' });
  ok(page.url().endsWith('/runs'), 'eingeloggt: /runs erreichbar');
  ok((await page.textContent('body')).includes('Verlauf'), 'Nav zeigt «Verlauf»');
  await page.click('[data-testid="logout"]');
  await page.waitForURL(/\/login/, { timeout: 8000 });
  ok(true, 'nach Abmelden auf /login');
  const r = await page.request.get(`${BASE_URL}/runs`, { maxRedirects: 0 });
  ok(r.status() === 307 || r.status() === 302, `Seite ohne Cookie wieder gesperrt (HTTP ${r.status()})`);
  ok((await page.locator('[data-testid="logout"]').count()) === 0, 'kein Abmelden-Button auf der Login-Seite');
  const sec = await page.request.get(`${BASE_URL}/login`);
  ok(sec.headers()['x-frame-options'] === 'DENY' && sec.headers()['x-content-type-options'] === 'nosniff', 'Security-Header gesetzt');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
