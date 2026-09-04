const { playwright, login, shot, BASE_URL } = require('./helpers');
const { chromium } = playwright();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await login(page);

  const id = 'csv_derived_' + Date.now();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    localStorage.setItem('appSettings', JSON.stringify({
      apiKeys: { meta_ads: '', openai: '', gemini: '', anthropic: 'fake-key', hunter_io: '', findymail: '' },
      theme: 'noir',
    }));
  });

  // 25 rows, chunkSize=20 -> chunk 1 (20 rows) succeeds, chunk 2 (5 rows) fails.
  // This means rows 20-24 stay PENDING when applyDerivedRules runs on failure.
  await page.evaluate((id) => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ name: `Person ${i}`, company: `Firma ${i}` }));
    const meta = { fields: ['name', 'company'], filename: 'derived_test.csv', createdAt: new Date().toISOString(), rowCount: rows.length };
    localStorage.setItem(`csv_run_${id}`, JSON.stringify(meta));
    const configs = [{
      id: 'cfg_d1', provider: 'anthropic', model: 'claude-sonnet-5', name: 'ki_klassifizierung',
      prompt: 'Classify', inputColumns: ['name', 'company'],
      outputFields: ['ki_bietet_coaching', 'ki_marketing_agentur', 'ki_anbieterstatus'],
      outputEnums: {
        ki_bietet_coaching: ['ja', 'nein'],
        ki_marketing_agentur: ['ja', 'nein'],
        ki_anbieterstatus: ['selbststaendig', 'angestellt'],
      },
      derived: [{
        name: 'ki_zielgruppe',
        allOf: [
          { field: 'ki_bietet_coaching', anyOf: ['ja'] },
          { field: 'ki_marketing_agentur', anyOf: ['nein'] },
          { field: 'ki_anbieterstatus', anyOf: ['selbststaendig'] },
        ],
        then: 'ja', else: 'nein',
      }],
    }];
    localStorage.setItem(`analysis_configs_${id}`, JSON.stringify(configs));
  }, id);

  await page.evaluate(async (id) => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ name: `Person ${i}`, company: `Firma ${i}` }));
    const fields = Object.keys(rows[0]);
    const csv = [fields.join(','), ...rows.map(r => fields.map(f => `"${String(r[f])}"`).join(','))].join('\n');
    const dbReq = indexedDB.open('scaper_csv', 1);
    await new Promise((resolve, reject) => {
      dbReq.onupgradeneeded = () => { if (!dbReq.result.objectStoreNames.contains('files')) dbReq.result.createObjectStore('files'); };
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

  // Mock: all rows get a valid "ja | nein | selbststaendig" -> should compute ki_zielgruppe=ja
  // Chunk 1 (20 rows) succeeds, chunk 2 (5 rows) fails with 500
  let callCount = 0;
  await page.route('**/api/ai/analyze', async route => {
    callCount++;
    if (callCount === 1) {
      const body = JSON.parse(route.request().postData());
      const values = body.prompts.map(() => 'ja | nein | selbststaendig');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values }) });
    } else {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Simulated failure' }) });
    }
  });

  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const runBtn = page.locator('button:has-text("▶")').first();
  await runBtn.click();
  await page.waitForTimeout(3000);

  // Check row 25 (index 24, one of the still-pending rows from chunk 2) in ki_zielgruppe column
  const headers = await page.locator('th').allTextContents();
  console.log('Headers include ki_zielgruppe:', headers.some(h => h.includes('ki_zielgruppe')));

  // Get all cell values in the ki_zielgruppe column for rows that were NOT reached (21-25)
  const rows = await page.locator('tbody tr').all();
  console.log(`Total visible rows: ${rows.length}`);

  // Row 21 (0-indexed row 20, the first of the 5 still-pending rows) should NOT show "nein"
  const row21Cells = await rows[20].locator('td').allTextContents();
  console.log('Row 21 (should be still-pending) cells:', JSON.stringify(row21Cells));

  const row1Cells = await rows[0].locator('td').allTextContents();
  console.log('Row 1 (should be classified ja) cells:', JSON.stringify(row1Cells));

  await page.screenshot({ path: shot('derived_pending.png') });

  await browser.close();
})();
