// Lead-Gedächtnis: neuer Datensatz wird gegen ältere abgeglichen (bekannt_aus, exportiert_am),
// Outreach-Export lässt bereits Exportierte weg und markiert die exportierten Zeilen;
// der Abgleich im alten Datensatz übernimmt das Export-Datum zurück.
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const A = 'csv_old_' + Date.now(), B = 'csv_new_' + (Date.now() + 1);
  await page.evaluate(({ A, B }) => {
    localStorage.clear();
    localStorage.setItem('appSettings', JSON.stringify({ apiKeys: { meta_ads: '', openai: '', gemini: '', anthropic: '', hunter_io: '', findymail: '' }, theme: 'noir' }));
    const meta = (filename, createdAt, fields, data) => JSON.stringify({ fields, filename, createdAt, rowCount: data.length, data });
    localStorage.setItem(`csv_run_${A}`, meta('Meta: alt', '2026-08-01T10:00:00Z', ['page_id', 'page_name', 'email', 'exportiert_am', 'email_enriched'], [
      { page_id: '1', page_name: 'Coach Anna', email: 'a@x.de', exportiert_am: '2026-08-02', email_enriched: '' },
      { page_id: '2', page_name: 'Bob Berater', email: 'b@x.de', exportiert_am: '', email_enriched: 'bob@enriched.de' },
    ]));
    localStorage.setItem(`csv_run_${B}`, meta('Meta: neu', '2026-09-01T10:00:00Z', ['page_id', 'page_name', 'email'], [
      { page_id: '1', page_name: 'Coach Anna', email: 'a@x.de' },
      { page_id: '2', page_name: 'Bob Berater', email: 'b@x.de' },
      { page_id: '3', page_name: 'Cleo Coach', email: 'c@x.de' },
    ]));
  }, { A, B });

  // Neuer Datensatz: automatischer Abgleich beim Öffnen
  await page.goto(`${BASE_URL}/csv/${B}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('button:has-text("neu: 1")', { timeout: 10000 });
  const body = await page.textContent('body');
  ok(body.includes('bekannt aus «Meta: alt»: 2') && body.includes('bereits exportiert: 1'), 'Chips: 2 bekannt aus «Meta: alt», 1 bereits exportiert');
  const metaB = await page.evaluate((B) => JSON.parse(localStorage.getItem(`csv_run_${B}`)).fields, B);
  ok(metaB.includes('bekannt_aus') && metaB.includes('exportiert_am') && metaB.includes('email_enriched'), 'Spalten bekannt_aus/exportiert_am/email_enriched persistiert');
  ok((await page.textContent('body')).includes('bob@enriched.de'), 'E-Mail aus früherem Enrichment übernommen (kein neuer Credit)');
  // Chip «neu» filtert auf Cleo
  await page.click('button:has-text("neu: 1")');
  ok((await page.textContent('body')).includes('1/3 sichtbar'), 'Chip «neu» filtert auf die neue Zeile');
  await page.click('button:has-text("neu: 1")');

  // Outreach: Anna (bereits exportiert) bleibt draußen, Bob + Cleo werden exportiert und markiert
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Outreach")')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  const lines = csv.trim().split('\n');
  ok(lines.length === 3 && !csv.includes('a@x.de') && csv.includes('bob@enriched.de') && csv.includes('c@x.de'), `Outreach: 2 Zeilen ohne die bereits exportierte (${lines.length - 1} Zeilen)`);
  await page.waitForSelector('button:has-text("bereits exportiert: 3")', { timeout: 8000 });
  ok(true, 'nach Export: 3 als exportiert markiert');
  const rowsB = await page.evaluate(async (B) => {
    const req = indexedDB.open('scaper_csv', 1);
    await new Promise(r => { req.onsuccess = r; });
    const db = req.result;
    return await new Promise(r => { const g = db.transaction('files').objectStore('files').get(B); g.onsuccess = () => r(g.result); });
  }, B);
  ok(rowsB.split('\n').filter(l => /\d{4}-\d{2}-\d{2}/.test(l)).length === 3, 'exportiert_am in der gespeicherten CSV');

  // Alter Datensatz: manueller Abgleich holt das Export-Datum von Bob zurück
  await page.goto(`${BASE_URL}/csv/${A}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="match-btn"]');
  await page.click('[data-testid="match-btn"]');
  await page.waitForSelector('button:has-text("bereits exportiert: 2")', { timeout: 10000 });
  ok(true, 'alter Datensatz: Bob jetzt ebenfalls als exportiert markiert');
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
