// Einstellungen: Integrationen (Server-Keys, Hinweis + Link), Blockliste (hinzufügen/entfernen), Design (Theme), Badges + Deep-Link
const { playwright, login, mockKeys, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await login(page);
  await mockKeys(page, ['anthropic', 'findymail']);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.removeItem('appSettings'); localStorage.removeItem('blocklist'); });
  await page.reload({ waitUntil: 'networkidle' });

  // Integrationen: keine Key-Eingabe im Browser, Status vom Server + Hinweis mit Link
  await page.waitForSelector('[data-testid="integration-status-anthropic"]:has-text("gesetzt")');
  ok((await page.locator('[data-testid="integration-status-findymail"]').innerText()).toLowerCase().includes('gesetzt'), 'FindyMail: Server-Key gesetzt');
  ok((await page.locator('[data-testid="integration-status-openai"]').innerText()).toLowerCase().includes('fehlt'), 'OpenAI: fehlt');
  ok((await page.locator('[data-testid="integration-anthropic"]').innerText()).includes('ANTHROPIC_API_KEY'), 'Variablenname in der Tabelle');
  ok((await page.locator('input').count()) === 0, 'kein Eingabefeld für Keys');
  const info = await page.locator('[data-testid="keys-info"]').innerText();
  ok(info.includes('auf dem Server') && info.includes('Environment Variables') && info.includes('Redeploy'), 'Hinweis: Keys auf dem Server, Klickpfad + Redeploy');
  ok((await page.locator('[data-testid="keys-env-link"]').getAttribute('href')) === 'https://vercel.com/dashboard', 'Link zu Vercel');
  const keyBadge = await page.locator('button:has-text("Integrationen") span').last().innerText();
  ok(keyBadge.trim() === '2', `Badge Integrationen = 2 (${keyBadge.trim()})`);
  // Alte Browser-Keys werden beim Laden entfernt
  await page.evaluate(() => localStorage.setItem('appSettings', JSON.stringify({ apiKeys: { anthropic: 'sk-alt' }, theme: 'noir' })));
  await page.reload({ waitUntil: 'networkidle' });
  const purged = await page.evaluate(() => localStorage.getItem('appSettings'));
  ok(!purged.includes('sk-alt') && !purged.includes('apiKeys'), 'alte Browser-Keys aus appSettings entfernt');

  // Blockliste (Deep-Link)
  await page.goto(`${BASE_URL}/settings?tab=blocklist`, { waitUntil: 'networkidle' });
  ok((await page.textContent('body')).includes('Noch keine Seiten geblockt'), 'Deep-Link öffnet Blockliste');
  await page.locator('input[placeholder*="Seitenname"]').fill('Spam Seite');
  await page.keyboard.press('Enter');
  await page.waitForSelector('text=Spam Seite');
  const badge = await page.locator('button:has-text("Blockliste") span').last().innerText();
  ok(badge.trim() === '1', `Badge Blockliste = 1 (${badge.trim()})`);
  await page.locator('button[title="Von Blockliste entfernen"]').click();
  await page.locator('button:has-text("Ja")').click();
  await page.waitForTimeout(150);
  ok((await page.textContent('body')).includes('Noch keine Seiten geblockt'), 'Eintrag entfernt');

  // Design
  await page.click('button:has-text("Design")');
  await page.click('button:has-text("classic")');
  ok((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'classic', 'Theme classic gesetzt');
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('appSettings')).theme)) === 'classic', 'Theme gespeichert');
  await page.click('button:has-text("noir")');
  ok((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === null, 'Theme noir entfernt data-theme');
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
