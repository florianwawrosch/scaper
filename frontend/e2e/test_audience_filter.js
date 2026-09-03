const { playwright, login, shot, BASE_URL } = require('./helpers');
const { chromium } = playwright();


(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await login(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  const id = 'csv_test_' + Date.now();

  // Simulate a CSV run that already has classification results
  await page.evaluate((id) => {
    const meta = {
      fields: ['voller_name', 'firma', 'ki_klassifizierung', 'ki_haupttyp', 'ki_bietet_coaching', 'ki_marketing_agentur', 'ki_themenfeld', 'ki_anbieterstatus', 'ki_rollenbezug', 'ki_sicherheit', 'ki_zielgruppe'],
      filename: 'classified_test.csv',
      createdAt: new Date().toISOString(),
      rowCount: 3,
    };
    localStorage.setItem(`csv_run_${id}`, JSON.stringify(meta));

    const configs = [{
      id: 'cfg_1', provider: 'anthropic', model: 'claude-sonnet-5', name: 'ki_klassifizierung',
      prompt: 'test', inputColumns: ['voller_name', 'firma'],
      outputFields: ['ki_haupttyp','ki_bietet_coaching','ki_marketing_agentur','ki_themenfeld','ki_anbieterstatus','ki_rollenbezug','ki_sicherheit'],
      derived: [{ name: 'ki_zielgruppe', allOf: [
        { field: 'ki_bietet_coaching', anyOf: ['ja','wahrscheinlich'] },
        { field: 'ki_marketing_agentur', anyOf: ['nein'] },
        { field: 'ki_anbieterstatus', anyOf: ['selbststaendig','unternehmen'] },
      ], then: 'ja', else: 'nein' }],
      promptVersion: 'v5',
    }];
    localStorage.setItem(`analysis_configs_${id}`, JSON.stringify(configs));
  }, id);

  // Write CSV content to IndexedDB via the app's own storage (must use its csvStorage helper)
  await page.evaluate(async (id) => {
    // Minimal reimplementation matching lib/csvStorage.ts idb schema
    const rows = [
      { voller_name: 'John Coach', firma: 'John Coaching GmbH', ki_klassifizierung: 'Coach | ja | nein | Beziehung | selbststaendig | eigenes_angebot | hoch', ki_haupttyp: 'Coach', ki_bietet_coaching: 'ja', ki_marketing_agentur: 'nein', ki_themenfeld: 'Beziehung', ki_anbieterstatus: 'selbststaendig', ki_rollenbezug: 'eigenes_angebot', ki_sicherheit: 'hoch', ki_zielgruppe: 'ja' },
      { voller_name: 'Sarah Agentur', firma: 'Marketing Pro GmbH', ki_klassifizierung: 'Agentur | nein | ja | Marketing | unternehmen | eigenes_angebot | hoch', ki_haupttyp: 'Agentur', ki_bietet_coaching: 'nein', ki_marketing_agentur: 'ja', ki_themenfeld: 'Marketing', ki_anbieterstatus: 'unternehmen', ki_rollenbezug: 'eigenes_angebot', ki_sicherheit: 'hoch', ki_zielgruppe: 'nein' },
      { voller_name: 'Max Angestellt', firma: 'BigCorp AG', ki_klassifizierung: 'Konzern | nein | nein | Business | angestellt | nur_zielgruppe | mittel', ki_haupttyp: 'Konzern', ki_bietet_coaching: 'nein', ki_marketing_agentur: 'nein', ki_themenfeld: 'Business', ki_anbieterstatus: 'angestellt', ki_rollenbezug: 'nur_zielgruppe', ki_sicherheit: 'mittel', ki_zielgruppe: 'nein' },
    ];
    // Papa.unparse equivalent (simple, values have no commas/quotes here)
    const fields = Object.keys(rows[0]);
    const csv = [fields.join(','), ...rows.map(r => fields.map(f => `"${String(r[f]).replace(/"/g,'""')}"`).join(','))].join('\n');

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

  await page.goto(`${BASE_URL}/csv/${id}/enrich`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const bodyText = await page.locator('body').textContent();
  console.log('Contains audience filter text:', bodyText.includes('Nur Zielgruppe enrichen'));
  console.log('Contains "1 von 3":', bodyText.includes('1 von 3') || bodyText.includes('von 3 Zeilen'));

  await page.screenshot({ path: shot('enrichment_with_audience.png') });

  const errorText = await page.locator('text=/⚠/').first().textContent().catch(() => null);
  if (errorText) console.log('ERROR ON PAGE:', errorText);

  // Uncheck the audience filter and verify all 3 rows show
  const checkbox = page.locator('input[type="checkbox"]').first();
  await checkbox.uncheck();
  await page.waitForTimeout(300);
  const bodyText2 = await page.locator('body').textContent();
  console.log('After uncheck - "3 Leads":', bodyText2.includes('3 Leads'));

  await browser.close();
})();
