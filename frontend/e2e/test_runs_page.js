// /runs: listet lokale Datensätze (Scrape + CSV), Filter-Chips, Klick öffnet den Viewer, Löschen entfernt
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await login(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
    const meta = (filename, extra = {}) => JSON.stringify({ fields: ['a'], filename, createdAt: new Date().toISOString(), rowCount: 3, data: [{ a: '1' }, { a: '2' }, { a: '3' }], ...extra });
    localStorage.setItem('csv_run_csv_1', meta('Meta: yoga, coach', { scrapeConfig: { country: 'DE', platforms: ['FACEBOOK'], adStatus: 'ACTIVE', limit: 100 } }));
    localStorage.setItem('csv_run_csv_2', meta('leads.csv'));
  });
  await page.goto(`${BASE_URL}/runs`, { waitUntil: 'networkidle' });
  const body = await page.textContent('body');
  ok(body.includes('Meta: yoga, coach') && body.includes('leads.csv'), 'beide Datensätze gelistet');
  ok(body.includes('DE · Facebook · Aktiv · max 100'), 'Scrape-Konfiguration als Zusammenfassung');
  ok(body.includes('2 Einträge'), 'Zähler: 2 Einträge');
  await page.click('button:has-text("Scrapes")');
  ok((await page.textContent('body')).includes('1 Einträge') && !(await page.textContent('body')).includes('leads.csv'), 'Filter «Scrapes» zeigt nur den Scrape');
  await page.click('button:has-text("CSV-Importe")');
  ok((await page.textContent('body')).includes('leads.csv'), 'Filter «CSV-Importe» zeigt den Import');
  await page.click('button:has-text("Alle")');
  // Löschen
  await page.locator('button[title="Eintrag löschen"]').first().click();
  await page.waitForSelector('button:has-text("Ja")', { timeout: 3000 });
  await page.locator('button:has-text("Ja")').click();
  await page.waitForTimeout(200);
  ok((await page.textContent('body')).includes('1 Einträge'), 'Eintrag gelöscht');
  ok(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('csv_run_')).length) === 1, 'localStorage-Eintrag entfernt');
  // Klick öffnet Viewer
  await page.waitForSelector('text=leads.csv');
  await page.locator('text=leads.csv').first().click();
  await page.waitForURL(/\/csv\/csv_2/);
  ok(true, 'Klick öffnet den Viewer');
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
