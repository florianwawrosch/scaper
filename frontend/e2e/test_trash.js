// Papierkorb: gelöschter Datensatz, Blocklisten-Eintrag und KI-Spalte erscheinen unter
// Einstellungen → Daten, «↺ Wiederherstellen» holt sie zurück (Datensatz inkl. CSV-Text vom
// Server), «Leeren» ist zweistufig und entfernt die Server-Tombstones endgültig
const { playwright, login, mockKeys, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const settled = (p) => p.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('lp_sync_pending') || '{}')).length === 0);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await login(page);
  await mockKeys(page, ['anthropic']);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await settled(page);
  const id = 'csv_trash_' + Date.now();
  await page.evaluate(async (id) => {
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['page_name', 'ad_text'], filename: 'Meta: papierkorb', createdAt: new Date().toISOString(), rowCount: 2 }));
    localStorage.setItem('blocklist', JSON.stringify([{ pageName: 'Spam Seite', pageId: '4242', addedAt: new Date().toISOString() }]));
    localStorage.setItem('user_presets', JSON.stringify([{ id: 'u_trash', name: 'ki_papier', columns: [{ name: 'ki_papier', prompt: 'Papier?', provider: 'anthropic', model: 'claude-sonnet-5' }], userDefined: true }]));
    const req = indexedDB.open('scaper_csv', 1);
    await new Promise((res, rej) => { req.onupgradeneeded = () => req.result.createObjectStore('files'); req.onsuccess = res; req.onerror = () => rej(req.error); });
    await new Promise((res, rej) => { const tx = req.result.transaction('files', 'readwrite'); tx.objectStore('files').put('page_name,ad_text\nAnna Coach,Abnehmen\nBob Maler,Wände\n', id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }, id);
  await page.reload({ waitUntil: 'networkidle' }); // nur-lokale Einträge gehen zum Server
  await settled(page);

  // Löschen: Datensatz (Verlauf), Blocklisten-Eintrag, KI-Spalte — alles zweistufig
  await page.goto(`${BASE_URL}/runs`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Meta: papierkorb');
  await page.locator('button[title="Eintrag löschen"]').first().click();
  await page.locator('button:has-text("Ja")').click();
  await page.waitForFunction(() => !document.body.innerText.includes('Meta: papierkorb'));
  await page.goto(`${BASE_URL}/settings?tab=blocklist`, { waitUntil: 'networkidle' });
  await page.locator('button[title="Von Blockliste entfernen"]').click();
  await page.locator('button:has-text("Ja")').click();
  await page.waitForSelector('text=Noch keine Seiten geblockt');
  await page.goto(`${BASE_URL}/settings?tab=templates`, { waitUntil: 'networkidle' });
  await page.click('[data-testid="tpl-delete-u_trash"]');
  await page.locator('button:has-text("Ja")').click();
  await page.waitForFunction(() => !document.body.innerText.includes('ki_papier'));
  await settled(page);

  // Papierkorb zeigt alle drei
  await page.goto(`${BASE_URL}/settings?tab=data`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-testid="trash-restore-ds-${id}"]`);
  const rows = await page.locator('[data-testid="trash-row"]').allInnerTexts();
  ok(rows.length === 3, `3 Einträge im Papierkorb (${rows.length})`);
  ok(rows.some(r => r.includes('Meta: papierkorb') && r.includes('2 Zeilen')) && rows.some(r => r.includes('Spam Seite')) && rows.some(r => r.includes('ki_papier')), 'Datensatz mit Zeilen, Blocklisten-Eintrag, KI-Spalte gelistet');
  ok(!(await page.textContent('body')).includes('bleiben nur im Browser'), 'kein veralteter Key-Hinweis mehr');

  // Datensatz wiederherstellen → Verlauf + Viewer (CSV-Text kommt vom Server)
  await page.click(`[data-testid="trash-restore-ds-${id}"]`);
  await page.waitForSelector('text=wiederhergestellt');
  await page.waitForFunction((id) => !document.querySelector(`[data-testid="trash-restore-ds-${id}"]`), id);
  await page.goto(`${BASE_URL}/runs`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Meta: papierkorb');
  ok(true, 'Datensatz wieder im Verlauf');
  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Anna Coach');
  ok((await page.textContent('body')).includes('Bob Maler'), 'Datensatz öffnet mit allen Zeilen (CSV-Text vom Server)');

  // Blocklisten-Eintrag und KI-Spalte wiederherstellen
  await page.goto(`${BASE_URL}/settings?tab=data`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="trash-row"]');
  await page.locator('[data-testid="trash-row"]:has-text("Spam Seite") button').click();
  await page.locator('[data-testid="trash-row"]:has-text("ki_papier") button').click();
  await page.waitForSelector('[data-testid="trash-empty"]');
  await page.goto(`${BASE_URL}/settings?tab=blocklist`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="block-row"]');
  ok((await page.textContent('body')).includes('Spam Seite'), 'Blocklisten-Eintrag zurück');
  await page.goto(`${BASE_URL}/settings?tab=templates`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=ki_papier');
  ok(true, 'KI-Spalte zurück');

  // Endgültig leeren: nochmal löschen, dann «Leeren» (zweistufig) → Server-Tombstones weg
  await page.goto(`${BASE_URL}/runs`, { waitUntil: 'networkidle' });
  await page.locator('button[title="Eintrag löschen"]').first().click();
  await page.locator('button:has-text("Ja")').click();
  await settled(page);
  await page.goto(`${BASE_URL}/settings?tab=data`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-testid="trash-restore-ds-${id}"]`);
  await page.click('[data-testid="trash-purge"]');
  ok((await page.locator('[data-testid="trash-row"]').count()) === 1, 'erster Klick leert noch nichts');
  await page.locator('button:has-text("Ja")').click();
  await page.waitForSelector('[data-testid="trash-empty"]');
  const remote = await page.evaluate(async () => (await (await fetch('/api/store?trash=1')).json()).entries.length);
  ok(remote === 0, 'Server-Papierkorb leer');
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
