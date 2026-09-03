// Gespeicherte Suchen: speichern → Modal zeigt sie → laden befüllt die Maske → löschen
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  await login(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('presets'));
  await page.reload({ waitUntil: 'networkidle' });

  // Element-Handle statt Locator: der Platzhalter verschwindet nach dem ersten Tag
  const tagInput = await page.$('input[placeholder*="Begriff"]');
  await tagInput.fill('yoga'); await tagInput.press('Enter');
  await tagInput.fill('pilates'); await tagInput.press('Enter');
  await page.locator('input[placeholder="Suche benennen…"]').first().fill('Fitness DE');
  await page.locator('button:has-text("+ Speichern")').first().click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('presets') || '{}'));
  ok(stored['Fitness DE']?.keywords?.join() === 'yoga,pilates' && !!stored['Fitness DE'].savedAt, 'Suche in localStorage gespeichert (keywords + savedAt)');

  // Maske leeren, dann laden
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('button:has-text("Gespeicherte Suchen")').click();
  await page.waitForSelector('text=Fitness DE');
  ok(true, 'Modal zeigt gespeicherte Suche');
  await page.locator('button:has-text("Laden")').first().click();
  await page.waitForTimeout(300);
  const body = await page.textContent('body');
  ok(body.includes('yoga') && body.includes('pilates'), 'Laden befüllt die Suchbegriffe');
  ok((await page.locator('text=Gespeicherte Suchen').count()) >= 1 && (await page.locator('button:has-text("Laden")').count()) === 0, 'Modal nach Laden geschlossen');

  await page.locator('button:has-text("Gespeicherte Suchen")').click();
  await page.locator('button[title="Suche löschen"]').click();
  await page.locator('button:has-text("Ja")').click();
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('presets') || '{}')).length) === 0, 'Suche gelöscht');
  ok((await page.textContent('body')).includes('Noch keine Suchen'), 'Modal zeigt Leerzustand');
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
