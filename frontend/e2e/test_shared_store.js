// Gemeinsamer Speicher: zwei Browser (Kollegen) mit demselben Login sehen dieselben
// Datensätze, KI-Spalten und Blockliste; Löschen auf dem einen verschwindet beim anderen
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
/** Warten, bis alle vorgemerkten Änderungen dieses Browsers auf dem Server sind */
const settled = (p) => p.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('lp_sync_pending') || '{}')).length === 0);
(async () => {
  const browser = await chromium.launch();
  const ctxA = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const a = await ctxA.newPage();
  const ns = await login(a);
  await a.goto(BASE_URL, { waitUntil: 'networkidle' });
  await settled(a);
  ok((await a.locator('[data-testid="store-banner"]').count()) === 0, 'keine Hinweisleiste — Server verbunden, nichts zu sehen');

  // Kollege A: Datensatz (Meta + CSV-Text) anlegen, KI-Spalte und Blocklisten-Eintrag speichern
  const id = 'csv_shared_' + Date.now();
  await a.evaluate(async (id) => {
    localStorage.setItem('appSettings', JSON.stringify({ apiKeys: { meta_ads: '', openai: '', gemini: '', anthropic: 'k', hunter_io: '', findymail: '' }, theme: 'noir' }));
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['page_name', 'ad_text'], filename: 'Meta: kollege-a', createdAt: new Date().toISOString(), rowCount: 2 }));
    const req = indexedDB.open('scaper_csv', 1);
    await new Promise((res, rej) => { req.onupgradeneeded = () => req.result.createObjectStore('files'); req.onsuccess = res; req.onerror = () => rej(req.error); });
    await new Promise((res, rej) => { const tx = req.result.transaction('files', 'readwrite'); tx.objectStore('files').put('page_name,ad_text\nAnna Coach,Abnehmen\nBob Maler,Wände\n', id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }, id);
  await a.reload({ waitUntil: 'networkidle' }); // Laden schickt nur-lokale Einträge zum Server
  await settled(a);
  await a.goto(`${BASE_URL}/settings?tab=templates`, { waitUntil: 'networkidle' });
  await a.click('[data-testid="tpl-new"]');
  await a.waitForSelector('[data-testid^="tpl-editor-"]');
  const pid = await a.evaluate(() => JSON.parse(localStorage.getItem('user_presets'))[0].id);
  await a.fill(`[data-testid="tpl-title-${pid}"]`, 'ki_geteilt');
  await a.fill(`[data-testid="tpl-prompt-${pid}"]`, 'Geteilter Prompt?');
  await a.click(`[data-testid="tpl-save-${pid}"]`);
  await a.waitForSelector(`[data-testid="tpl-saved-${pid}"]`);
  await a.goto(`${BASE_URL}/settings?tab=blocklist`, { waitUntil: 'networkidle' });
  await a.fill('[data-testid="block-input"]', 'https://www.facebook.com/ads/library/?view_all_page_id=4242424242');
  await a.click('[data-testid="block-add"]');
  await a.waitForSelector('[data-testid="block-row"]');
  await settled(a);

  // Kollege B: frischer Browser, gleicher Speicher
  const ctxB = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const b = await ctxB.newPage();
  await login(b, ns);
  await b.goto(`${BASE_URL}/runs`, { waitUntil: 'networkidle' });
  await b.waitForSelector('text=Meta: kollege-a');
  ok(true, 'B sieht den Datensatz von A im Verlauf');
  await b.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await b.waitForSelector('text=Anna Coach');
  ok(true, 'B kann den Datensatz öffnen (CSV-Text vom Server geholt)');
  await b.goto(`${BASE_URL}/settings?tab=templates`, { waitUntil: 'networkidle' });
  await b.waitForSelector('text=ki_geteilt');
  ok(true, 'B sieht die KI-Spalte von A');
  await b.goto(`${BASE_URL}/settings?tab=blocklist`, { waitUntil: 'networkidle' });
  ok((await b.textContent('body')).includes('4242424242') || (await b.locator('a[href*="4242424242"]').count()) > 0, 'B sieht den Blocklisten-Eintrag von A');

  // A hat den Datensatz offen (mit einer KI-Spalte), B ändert ihn → A bekommt den Hinweis und lädt neu
  await a.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await a.waitForSelector('text=Anna Coach');
  await a.click('[data-testid="ai-column-menu-btn"]');
  await a.click('[data-testid="preset-load-keep_drop"]');
  await a.waitForSelector('th:has-text("ki_bewertung")');
  await settled(a);
  await b.evaluate((id) => {
    const m = JSON.parse(localStorage.getItem(`csv_run_${id}`));
    m.filename = 'Meta: kollege-a (von B umbenannt)';
    localStorage.setItem(`csv_run_${id}`, JSON.stringify(m));
  }, id);
  // direkt über die API-Schicht schreiben, wie es die App tut
  await b.evaluate(async (id) => {
    const value = localStorage.getItem(`csv_run_${id}`);
    await fetch('/api/store', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: `csv_run_${id}`, value }) });
  }, id);
  ok((await a.locator('[data-testid="dataset-changed"]').count()) === 0, 'vor dem Abgleich kein Hinweis');
  await a.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // Zurück-in-den-Tab simulieren
  await a.waitForSelector('[data-testid="dataset-changed"]');
  ok(!(await a.textContent('h1')).includes('von B umbenannt'), 'Änderung wird nicht still übernommen');
  // ▶ auf veraltetem Stand wird verweigert (würde B's Stand überschreiben)
  const th = a.locator('th:has-text("ki_bewertung")').first();
  await th.hover();
  await th.locator('button[title*="nalys"], button:has-text("▶")').first().click();
  await a.waitForSelector('text=erst «↻ Neu laden»');
  ok(true, 'KI-Lauf auf veraltetem Stand verweigert');
  await a.click('[data-testid="dataset-reload"]');
  await a.waitForSelector('h1:has-text("von B umbenannt")');
  ok(true, 'A: Hinweis → Neu laden → Änderung von B da');
  await a.goto(`${BASE_URL}/runs`, { waitUntil: 'networkidle' });
  await a.waitForSelector('text=von B umbenannt');
  ok(true, 'A sieht die Änderung von B im Verlauf');

  // A löscht den Datensatz → bei B weg
  await a.locator('button[title="Eintrag löschen"]').first().click();
  await a.locator('button:has-text("Ja")').click();
  await settled(a);
  await b.goto(`${BASE_URL}/runs`, { waitUntil: 'networkidle' });
  await b.waitForFunction(() => !document.body.innerText.includes('kollege-a'));
  ok(true, 'Löschen bei A entfernt den Datensatz auch bei B (Tombstone)');
  ok((await b.evaluate((id) => localStorage.getItem(`csv_run_${id}`), id)) === null, 'lokaler Cache von B bereinigt');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
