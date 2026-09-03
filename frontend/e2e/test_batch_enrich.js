const { playwright, login, shot, BASE_URL } = require('./helpers');
const { chromium } = playwright();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await login(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  const id = 'csv_batch_' + Date.now();

  // Simulate: 5 rows, 2 already have email_enriched, 3 don't
  await page.evaluate((id) => {
    const meta = {
      fields: ['voller_name', 'firma', 'email_enriched'],
      filename: 'batch_test.csv',
      createdAt: new Date().toISOString(),
      rowCount: 5,
    };
    localStorage.setItem(`csv_run_${id}`, JSON.stringify(meta));
  }, id);

  await page.evaluate(async (id) => {
    const rows = [
      { voller_name: 'Person A', firma: 'Firma A', email_enriched: 'a@firma-a.de' },
      { voller_name: 'Person B', firma: 'Firma B', email_enriched: '' },
      { voller_name: 'Person C', firma: 'Firma C', email_enriched: 'c@firma-c.de' },
      { voller_name: 'Person D', firma: 'Firma D', email_enriched: '' },
      { voller_name: 'Person E', firma: 'Firma E', email_enriched: '' },
    ];
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
  console.log('Shows "2 Zeilen bereits enricht":', bodyText.includes('2 Zeile') && bodyText.includes('bereits enricht'));
  console.log('Shows "3 Leads" (only unenriched):', bodyText.includes('3 Leads'));
  console.log('Shows skip hint:', bodyText.includes('werden übersprungen'));

  await page.screenshot({ path: shot('batch_enrich.png') });

  await browser.close();
})();
