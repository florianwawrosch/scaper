// Herkunft: neuer Datensatz bekommt den Standort aus der IP (Vercel-Geo-Header)
// und zeigt ihn im Verlauf und in der Datensatz-Liste
const { playwright, login, mockKeys, ok, BASE_URL, fixture } = require('./helpers');
const { chromium } = playwright();
const fs = require('fs');
(async () => {
  // eigene Fixture schreiben — sie liegt nicht im Repo (CI)
  const file = fixture('origin_test.csv');
  fs.writeFileSync(file, 'page_name,ad_text,email\nCoach Anna,Abnehmen mit Plan,anna@x.de\nMaler Bob,Wände streichen,\n');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await login(page);
  await mockKeys(page, []);
  await page.route('**/api/whoami', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ label: 'Wien, AT', ip: '84.113.1.2', city: 'Wien', country: 'AT' }) }));
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('input[type="file"]', { state: 'attached' });
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.waitForURL(/\/csv\/csv_/, { timeout: 10000 });
  const id = page.url().split('/csv/')[1];
  const meta = await page.evaluate((id) => JSON.parse(localStorage.getItem(`csv_run_${id}`)), id);
  ok(meta.origin === 'Wien, AT', `Meta trägt den Standort (${meta.origin})`);
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForSelector('text=origin_test.csv');
  ok((await page.locator('[data-testid="history-origin"]').first().innerText()).includes('Wien, AT'), 'Verlauf zeigt den Standort');
  await page.goto(`${BASE_URL}/runs`, { waitUntil: 'load' });
  await page.waitForSelector('text=origin_test.csv');
  ok((await page.textContent('body')).includes('Wien, AT'), 'Datensatz-Liste zeigt den Standort');
  // Ohne Standort (localhost) bleibt das Feld weg
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
