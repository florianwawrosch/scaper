// Credit-Schutz: manueller ▶ mit > 100 zu klassifizierenden Zeilen fragt nach (Abbrechen = kein Aufruf),
// Autorun («direkt ausfüllen») läuft ohne Nachfrage
const { playwright, login, mockKeys, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await login(page);
  await mockKeys(page, ['anthropic']);
  let aiCalls = 0;
  await page.route('**/api/ai/analyze', async route => {
    aiCalls++;
    const body = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: body.prompts.map(() => 'ja') }) });
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const id = 'csv_big_' + Date.now();
  await page.evaluate((id) => {
    localStorage.clear();
    localStorage.setItem('appSettings', JSON.stringify({ theme: 'noir' }));
    const data = Array.from({ length: 150 }, (_, i) => ({ page_name: `Seite ${i + 1}`, ad_text: `Text ${i + 1}` }));
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['page_name', 'ad_text'], filename: 'big.csv', createdAt: new Date().toISOString(), rowCount: 150, data }));
    localStorage.setItem(`analysis_configs_${id}`, JSON.stringify([{ id: 'cfg_big', provider: 'anthropic', model: 'claude-sonnet-5', name: 'ki_x', prompt: 'Coach?' }]));
  }, id);
  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('th:has-text("ki_x")');
  const run = async () => { const th = page.locator('th:has-text("ki_x")').first(); await th.hover(); await th.locator('button[title*="nalys"], button:has-text("▶")').first().click(); };
  await run();
  await page.waitForSelector('[data-testid="ai-run-confirm"]');
  const txt = await page.locator('[data-testid="ai-run-confirm"]').innerText();
  ok(txt.includes('150 Zeilen') && txt.includes('Claude') && txt.includes('claude-sonnet-5'), `Nachfrage nennt Zeilen und Modell: ${txt.split('\n')[1]?.slice(0, 80)}`);
  await page.click('[data-testid="ai-run-confirm-cancel"]');
  await page.waitForTimeout(400);
  ok(aiCalls === 0 && (await page.locator('[data-testid="ai-run-confirm"]').count()) === 0, 'Abbrechen: kein KI-Aufruf');
  await run();
  await page.click('[data-testid="ai-run-confirm-start"]');
  await page.waitForFunction(() => document.body.innerText.includes('«ki_x»: 150 klassifiziert'), null, { timeout: 30000 });
  ok(aiCalls > 0, `Starten: KI aufgerufen (${aiCalls} Aufrufe)`);
  // Prompt-Test im ⚙-Panel: nur 3 Zeilen, keine Nachfrage
  const id3 = id + '_test';
  await page.evaluate((id3) => {
    const data = Array.from({ length: 130 }, (_, i) => ({ page_name: `P ${i + 1}`, ad_text: `A ${i + 1}` }));
    localStorage.setItem(`csv_run_${id3}`, JSON.stringify({ fields: ['page_name', 'ad_text'], filename: 'test.csv', createdAt: new Date().toISOString(), rowCount: 130, data }));
    localStorage.setItem(`analysis_configs_${id3}`, JSON.stringify([{ id: 'cfg_t', provider: 'anthropic', model: 'claude-sonnet-5', name: 'ki_t', prompt: 'Coach?' }]));
  }, id3);
  await page.goto(`${BASE_URL}/csv/${id3}`, { waitUntil: 'networkidle' });
  const th3 = page.locator('th:has-text("ki_t")').first();
  await th3.hover();
  await th3.locator('button[title*="onfig"], button:has-text("⚙")').first().click();
  await page.waitForSelector('[data-testid="editor-test-run"]');
  const callsBefore = aiCalls;
  await page.click('[data-testid="editor-test-run"]');
  await page.waitForFunction(() => document.body.innerText.includes('Test «ki_t»: 3 Zeilen klassifiziert'), null, { timeout: 30000 });
  ok(aiCalls === callsBefore + 1 && (await page.locator('[data-testid="ai-run-confirm"]').count()) === 0, 'Prompt-Test: 3 Zeilen, ein Aufruf, keine Nachfrage');
  const vals = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].slice(0, 4).map(tr => tr.lastElementChild.innerText.trim()));
  ok(vals.slice(0, 3).every(v => v === 'ja') && vals[3] === '—', `erste 3 Zeilen gefüllt, Rest offen (${vals.join(',')})`);
  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('th:has-text("ki_x")');

  // zweiter ▶: alles gecacht → keine Nachfrage, «nichts zu tun»
  await run();
  await page.waitForSelector('text=nichts zu tun');
  ok((await page.locator('[data-testid="ai-run-confirm"]').count()) === 0, 'alles gecacht → keine Nachfrage');

  // Autorun («direkt ausfüllen»): läuft ohne Nachfrage
  const id2 = id + '_auto';
  await page.evaluate((id2) => {
    const data = Array.from({ length: 120 }, (_, i) => ({ page_name: `S ${i + 1}`, ad_text: `T ${i + 1}` }));
    localStorage.setItem(`csv_run_${id2}`, JSON.stringify({ fields: ['page_name', 'ad_text'], filename: 'auto.csv', createdAt: new Date().toISOString(), rowCount: 120, data }));
    localStorage.setItem(`analysis_configs_${id2}`, JSON.stringify([{ id: 'cfg_auto', provider: 'anthropic', model: 'claude-sonnet-5', name: 'ki_auto', prompt: 'Coach?' }]));
    localStorage.setItem(`autorun_analysis_${id2}`, JSON.stringify(['cfg_auto']));
  }, id2);
  const before = aiCalls;
  await page.goto(`${BASE_URL}/csv/${id2}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.innerText.includes('«ki_auto»: 120 klassifiziert'), null, { timeout: 30000 });
  ok(aiCalls > before && (await page.locator('[data-testid="ai-run-confirm"]').count()) === 0, 'Autorun ohne Nachfrage');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
