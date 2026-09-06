// Verbrauch: ein KI-Lauf landet mit Zeilen, Modell und Token im Protokoll
// (Einstellungen → Verbrauch), Summen der letzten 30 Tage, Protokoll leeren zweistufig
const { playwright, login, mockKeys, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  await login(page);
  await mockKeys(page, ['anthropic']);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/ai/analyze', async route => {
    const body = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      values: body.prompts.map(() => 'ja'),
      usage: { input: body.prompts.length * 100, output: body.prompts.length * 5 },
    }) });
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const id = 'csv_usage_' + Date.now();
  await page.evaluate((id) => {
    localStorage.clear();
    const data = Array.from({ length: 30 }, (_, i) => ({ page_name: `Seite ${i + 1}`, ad_text: `Text ${i + 1}` }));
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['page_name', 'ad_text'], filename: 'usage.csv', createdAt: new Date().toISOString(), rowCount: 30, data }));
    localStorage.setItem(`analysis_configs_${id}`, JSON.stringify([{ id: 'cfg_u', provider: 'anthropic', model: 'claude-sonnet-5', name: 'ki_u', prompt: 'Coach?' }]));
  }, id);
  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('th:has-text("ki_u")');
  const th = page.locator('th:has-text("ki_u")').first();
  await th.hover();
  await th.locator('button[title*="nalys"], button:has-text("▶")').first().click();
  await page.waitForFunction(() => document.body.innerText.includes('«ki_u»: 30 klassifiziert'), null, { timeout: 30000 });

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('usage_log') ?? '[]'));
  ok(stored.length === 1 && stored[0].kind === 'ai' && stored[0].rows === 30 && stored[0].input === 3000 && stored[0].output === 150, `Protokoll-Eintrag: 30 Zeilen, 3000/150 Token (${JSON.stringify(stored[0]).slice(0, 120)})`);
  ok(stored[0].dataset === 'usage.csv' && stored[0].what === 'ki_u' && stored[0].model === 'claude-sonnet-5', 'Eintrag nennt Datensatz, Spalte und Modell');

  await page.goto(`${BASE_URL}/settings?tab=usage`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="usage-row"]');
  const row = await page.locator('[data-testid="usage-row"]').first().innerText();
  ok(row.includes('usage.csv') && row.includes('ki_u') && row.includes('claude-sonnet-5') && row.includes('3.000') && row.includes('150'), `Zeile im Protokoll: ${row.replace(/\s+/g, ' ').slice(0, 120)}`);
  const summary = await page.locator('[data-testid="usage-summary"]').innerText();
  ok(/KI-LÄUFE\s*1/i.test(summary) && summary.includes('30 Zeilen') && summary.includes('3.150'), `Summen: 1 Lauf, 30 Zeilen, 3.150 Token`);
  const model = await page.locator('[data-testid="usage-model"]').first().innerText();
  ok(model.includes('Claude') && model.includes('claude-sonnet-5') && model.includes('$'), `Je Modell mit Kostenschätzung: ${model.replace(/\s+/g, ' ')}`);

  // Leeren: zweistufig
  await page.click('button[title="Protokoll leeren"]');
  ok((await page.locator('[data-testid="usage-row"]').count()) === 1, 'erster Klick löscht noch nichts');
  await page.click('button:has-text("Ja")');
  await page.waitForSelector('[data-testid="usage-empty"]');
  ok((await page.evaluate(() => localStorage.getItem('usage_log'))) === null, 'Protokoll geleert');
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
