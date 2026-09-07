// Kostendeckel: Monatsbudget unter Einstellungen → Verbrauch; erreicht → KI-Lauf blockiert (kein Aufruf),
// nahe dran → Nachfrage mit Kosten und Budgetstand auch bei kleinen Läufen, sonst normal
const { playwright, login, mockKeys, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  await login(page);
  await mockKeys(page, ['anthropic']);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let aiCalls = 0;
  await page.route('**/api/ai/analyze', async route => {
    aiCalls++;
    const body = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: body.prompts.map(() => 'ja'), usage: { input: body.prompts.length * 100, output: body.prompts.length * 5 } }) });
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const id = 'csv_budget_' + Date.now();
  await page.evaluate((id) => {
    localStorage.clear();
    // Lauf dieses Monats: 1 Mio. Eingabe-Token mit claude-sonnet-5 → ≈ 3 $
    localStorage.setItem('usage_log', JSON.stringify([{ id: 'u1', at: new Date().toISOString(), kind: 'ai', datasetId: 'x', dataset: 'x.csv', what: 'ki_x', provider: 'anthropic', model: 'claude-sonnet-5', rows: 1000, input: 1000000, output: 0, ms: 1000 }]));
    const data = Array.from({ length: 30 }, (_, i) => ({ page_name: `Seite ${i + 1}`, ad_text: `Text ${i + 1}` }));
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['page_name', 'ad_text'], filename: 'budget.csv', createdAt: new Date().toISOString(), rowCount: 30, data }));
    localStorage.setItem(`analysis_configs_${id}`, JSON.stringify([{ id: 'cfg_b', provider: 'anthropic', model: 'claude-sonnet-5', name: 'ki_b', prompt: 'Coach?' }]));
  }, id);

  // Budget 2 $ setzen → bereits überschritten
  await page.goto(`${BASE_URL}/settings?tab=usage`, { waitUntil: 'networkidle' });
  await page.fill('[data-testid="budget-input"]', '2');
  await page.click('[data-testid="budget-save"]');
  await page.waitForSelector('[data-testid="budget-bar"]');
  const bar = await page.locator('[data-testid="budget-status"]').innerText();
  ok(bar.includes('3,00 $') && bar.includes('2,00 $'), `Budgetstand: ${bar.replace(/\s+/g, ' ')}`);
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('app_budget')).monthlyUsd)) === 2, 'Budget gespeichert (geteilter Key)');

  const run = async () => { const th = page.locator('th:has-text("ki_b")').first(); await th.hover(); await th.locator('button[title*="nalys"], button:has-text("▶")').first().click(); };
  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('th:has-text("ki_b")');
  await run();
  await page.waitForSelector('text=Monatsbudget erreicht');
  await page.waitForTimeout(300);
  ok(aiCalls === 0, 'Budget erreicht: kein KI-Aufruf');

  // Budget 3,50 $: 3 $ verbraucht + Lauf ≈ 0,09 $ → ≥ 80 % → Nachfrage auch bei 30 Zeilen, mit Kosten und Stand
  await page.goto(`${BASE_URL}/settings?tab=usage`, { waitUntil: 'networkidle' });
  await page.fill('[data-testid="budget-input"]', '3.5');
  await page.click('[data-testid="budget-save"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="budget-status"]')?.textContent?.includes('3,50 $'));
  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('th:has-text("ki_b")');
  await run();
  await page.waitForSelector('[data-testid="ai-run-confirm"]');
  const txt = await page.locator('[data-testid="ai-run-budget"]').innerText();
  ok(txt.includes('Kosten dieses Laufs') && txt.includes('0,09 $') && txt.includes('3,00 $') && txt.includes('3,50 $'), `Nachfrage zeigt Kosten und Budgetstand: ${txt.replace(/\s+/g, ' ').slice(0, 140)}`);
  await page.click('[data-testid="ai-run-confirm-cancel"]');
  ok(aiCalls === 0, 'Abbrechen: kein Aufruf');
  await run();
  await page.waitForSelector('[data-testid="ai-run-confirm"]');
  await page.click('[data-testid="ai-run-confirm-start"]');
  await page.waitForFunction(() => document.body.innerText.includes('«ki_b»: 30 klassifiziert'), null, { timeout: 30000 });
  ok(aiCalls > 0, 'Bestätigt: Lauf läuft');

  // Budget entfernen → kein Limit mehr
  await page.goto(`${BASE_URL}/settings?tab=usage`, { waitUntil: 'networkidle' });
  await page.fill('[data-testid="budget-input"]', '');
  await page.click('[data-testid="budget-save"]');
  await page.waitForFunction(() => localStorage.getItem('app_budget') === null);
  ok((await page.locator('[data-testid="budget-bar"]').count()) === 0, 'ohne Budget keine Anzeige');
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
