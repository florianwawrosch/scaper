const { playwright, login, shot, BASE_URL } = require('./helpers');
const { chromium } = playwright();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await login(page);

  const id = 'csv_partial_' + Date.now();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Set a fake local Anthropic key so runColumn doesn't bail early
  await page.evaluate(() => {
    localStorage.setItem('appSettings', JSON.stringify({
      apiKeys: { meta_ads: '', openai: '', gemini: '', anthropic: 'fake-key', hunter_io: '', findymail: '' },
      theme: 'noir',
    }));
  });

  // Seed a 25-row dataset (chunkSize=20 -> 2 chunks: 20 then 5) with a simple
  // single-output AI config (no outputFields, so multi=false keeps it simple)
  await page.evaluate((id) => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ name: `Person ${i}`, company: `Firma ${i}` }));
    const meta = {
      fields: ['name', 'company'],
      filename: 'partial_test.csv',
      createdAt: new Date().toISOString(),
      rowCount: rows.length,
    };
    localStorage.setItem(`csv_run_${id}`, JSON.stringify(meta));
    const configs = [{
      id: 'cfg_p1', provider: 'anthropic', model: 'claude-sonnet-5', name: 'ki_test',
      prompt: 'Classify this row', inputColumns: ['name', 'company'],
    }];
    localStorage.setItem(`analysis_configs_${id}`, JSON.stringify(configs));

    return rows;
  }, id);

  await page.evaluate(async (id) => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ name: `Person ${i}`, company: `Firma ${i}` }));
    const fields = Object.keys(rows[0]);
    const csv = [fields.join(','), ...rows.map(r => fields.map(f => `"${String(r[f])}"`).join(','))].join('\n');
    const dbReq = indexedDB.open('scaper_csv', 1);
    await new Promise((resolve, reject) => {
      dbReq.onupgradeneeded = () => {
        const db = dbReq.result;
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      };
      dbReq.onsuccess = () => resolve();
      dbReq.onerror = () => reject(dbReq.error);
    });
    const db = dbReq.result;
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(csv, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, id);

  // Mock /api/ai/analyze: 1st call (chunk of 20) succeeds, 2nd call (chunk of 5) fails
  let callCount = 0;
  await page.route('**/api/ai/analyze', async route => {
    callCount++;
    if (callCount === 1) {
      const req = route.request();
      const body = JSON.parse(req.postData());
      const values = body.prompts.map((_, i) => `Result-${i}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values }) });
    } else {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Simulated network failure' }) });
    }
  });

  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Trigger the classification run
  const runBtn = page.locator('button[title*="nalys"], button:has-text("▶")').first();
  const btnExists = await runBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('Run button visible:', btnExists);
  if (btnExists) {
    await runBtn.click();
  } else {
    console.log('Could not find run button — trying to locate any ▶ button');
    const allBtns = await page.locator('button').allTextContents();
    console.log('Buttons:', allBtns.filter(t => t.includes('▶')));
  }

  await page.waitForTimeout(3000);

  const bodyTextAfterRun = await page.locator('body').textContent();
  console.log('Shows error toast:', bodyTextAfterRun.includes('bereits klassifizierte Zeilen wurden gespeichert') || bodyTextAfterRun.includes('Simulated network failure'));

  // Check the table cell content for row 0 (should show "Result-0", not pending/blank)
  const firstCellText = await page.locator('td').filter({ hasText: 'Result-0' }).count();
  console.log('Table shows Result-0 (chunk 1 succeeded):', firstCellText > 0);

  console.log(`\nAPI calls made: ${callCount}`);

  // Now RELOAD the page and check if the partial results survived
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const afterReloadCell = await page.locator('td').filter({ hasText: 'Result-0' }).count();
  console.log('After RELOAD, still shows Result-0 (partial progress persisted):', afterReloadCell > 0);

  await page.screenshot({ path: shot('partial_failure.png'), fullPage: false });

  // Now retry: mock the API to succeed this time, and check ONLY 5 rows are sent (not 25)
  let retryCallRowCounts = [];
  await page.unroute('**/api/ai/analyze');
  await page.route('**/api/ai/analyze', async route => {
    const req = route.request();
    const body = JSON.parse(req.postData());
    retryCallRowCounts.push(body.prompts.length);
    const values = body.prompts.map((_, i) => `Retry-${i}`);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values }) });
  });

  const runBtn2 = page.locator('button:has-text("▶")').first();
  await runBtn2.click();
  await page.waitForTimeout(2000);

  console.log('\nRetry: rows sent per API call:', retryCallRowCounts);
  console.log('Retry only processed the missing 5 rows (not all 25):', retryCallRowCounts.reduce((a,b)=>a+b,0) === 5);

  await browser.close();
})();
