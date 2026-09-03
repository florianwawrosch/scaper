// Einstellungen: Integrationen (Key anlegen/entfernen), Blockliste (hinzufügen/entfernen), Design (Theme), Badges + Deep-Link
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await login(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.removeItem('appSettings'); localStorage.removeItem('blocklist'); });
  await page.reload({ waitUntil: 'networkidle' });

  // Integrationen: Key anlegen
  const anthropic = page.locator('div', { hasText: /^Anthropic Claude/ }).filter({ has: page.locator('button:has-text("Key")') }).last();
  await anthropic.locator('button:has-text("+ Key"), button:has-text("+ eigener Key")').first().click();
  await page.locator('input[placeholder^="sk-ant"]').fill('sk-ant-test-1234567890');
  await page.locator('button:has-text("Speichern")').first().click();
  await page.waitForSelector('text=sk-a••••••••7890');
  ok(true, 'Integrationen: Key maskiert gespeichert');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('appSettings')).apiKeys.anthropic);
  ok(stored === 'sk-ant-test-1234567890', 'Key in appSettings');
  ok((await page.textContent('body')).includes('Aktiv'), 'Aktiv-Bereich sichtbar');

  // Blockliste (Deep-Link)
  await page.goto(`${BASE_URL}/settings?tab=blocklist`, { waitUntil: 'networkidle' });
  ok((await page.textContent('body')).includes('Noch keine Seiten geblockt'), 'Deep-Link öffnet Blockliste');
  await page.locator('input[placeholder*="Seitenname"]').fill('Spam Seite');
  await page.keyboard.press('Enter');
  await page.waitForSelector('text=Spam Seite');
  const badge = await page.locator('button:has-text("Blockliste") span').last().innerText();
  ok(badge.trim() === '1', `Badge Blockliste = 1 (${badge.trim()})`);
  await page.locator('button[title="Von Blockliste entfernen"]').click();
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
