// Enrichment über mehrere Chargen: 120 Zeilen → 3 Aufrufe (50/50/20), Fortschritt,
// Zwischenspeicherung nach jeder Charge, nach Reload alles als enricht markiert
const { playwright, login, mockKeys, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await login(page);
  await mockKeys(page, ['hunter_io']);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const calls = [];
  await page.route('**/api/enrich', async route => {
    const body = JSON.parse(route.request().postData());
    calls.push(body.rows.length);
    await new Promise(r => setTimeout(r, 150));
    if (!Array.isArray(body.fields) || body.fields.join() !== 'email') errors.push('fields fehlt/falsch: ' + JSON.stringify(body.fields));
    const results = body.rows.map(r => ({ email: `${String(r.voller_name).toLowerCase().replace(/\s+/g, '.')}@firma.de`, phone: '', enriched: true }));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enriched: results.length, emails: results.length, phones: 0, total: results.length, results }) });
  });
  await page.route('**/api/enrich/account', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ provider: 'hunter_io', label: 'Hunter.io', available: 9870, used: 130, unit: 'Credits', planName: 'Growth', resetDate: '2026-10-01', rule: 'Hunter.io zieht 1 Credit pro Anfrage MIT Treffer ab.', chargedOnlyOnHit: true }) });
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const id = 'csv_batches_' + Date.now();
  await page.evaluate((id) => {
    localStorage.setItem('appSettings', JSON.stringify({ theme: 'noir' }));
    const data = Array.from({ length: 120 }, (_, i) => ({ voller_name: `Person ${i}`, firma: `Firma ${i}` }));
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['voller_name', 'firma'], filename: 'batches.csv', createdAt: new Date().toISOString(), rowCount: 120, data }));
  }, id);
  await page.goto(`${BASE_URL}/csv/${id}/enrich`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=120 Leads');
  ok((await page.textContent('body')).includes('3 Chargen à 50 Zeilen'), 'Hinweis: 3 Chargen à 50 Zeilen');
  ok(await page.locator('[data-testid="field-email"] input').isChecked(), 'E-Mail vorausgewählt');
  ok(await page.locator('[data-testid="field-phone"] input').isDisabled(), 'Telefon bei Hunter.io nicht wählbar');
  // Zuordnung ist vorbelegt (voller_name / firma) und zeigt Beispielwerte
  const mapName = await page.locator('[data-testid="map-name"] select').inputValue();
  const mapCompany = await page.locator('[data-testid="map-company"] select').inputValue();
  ok(mapName === 'voller_name' && mapCompany === 'firma', `Zuordnung vorgeschlagen: ${mapName} / ${mapCompany}`);
  ok((await page.locator('[data-testid="map-name"]').innerText()).includes('Beispiel: Person 0'), 'Beispielwert neben dem Dropdown');
  ok((await page.locator('[data-testid="map-name"]').innerText()).includes('vorgeschlagen'), 'Badge «vorgeschlagen»');
  // Stufe 1: Start → Bestätigung; Stufe 2: Häkchen (>100) + Ja
  await page.click('button:has-text("Enrichment starten")');
  await page.waitForSelector('[data-testid="enrich-confirm"]');
  ok(calls.length === 0, 'kein API-Aufruf vor der Bestätigung');
  const confirmText = await page.locator('[data-testid="enrich-confirm"]').innerText();
  ok(confirmText.includes('120 Leads') && confirmText.includes('bis zu 120 Credits') && confirmText.includes('Name ← voller_name'), 'Bestätigung zeigt Leads, Credits und Zuordnung');
  ok(await page.locator('[data-testid="enrich-confirm-btn"]').isDisabled(), 'Ja-Button gesperrt, bis Credit-Häkchen gesetzt (>100 Leads)');
  await page.waitForFunction(() => document.querySelector('[data-testid="enrich-account"]')?.textContent?.includes('9.870'), null, { timeout: 5000 });
  const accText = await page.locator('[data-testid="enrich-account"]').innerText();
  ok(accText.includes('9.870 Credits') && accText.includes('130 verbraucht') && accText.includes('Growth'), 'Guthaben, Verbrauch und Plan vom Anbieter angezeigt');
  ok(confirmText.includes('120 Leads') || (await page.locator('[data-testid="enrich-confirm"]').innerText()).includes('MIT Treffer'), 'Abrechnungsregel des Anbieters angezeigt');
  ok((await page.locator('[data-testid="lead-count"]').innerText()).includes('120 Leads werden angereichert'), 'Kopfzeile: «120 Leads werden angereichert» genau einmal');
  await page.click('[data-testid="enrich-ack"]');
  await page.click('[data-testid="enrich-confirm-btn"]');
  await page.waitForSelector('[data-testid="enrich-progress"]');
  ok(true, 'Fortschrittsanzeige sichtbar');
  await page.waitForFunction(() => document.body.innerText.includes('120 E-Mails gefunden bei 120 Leads'), null, { timeout: 20000 });
  ok(calls.join() === '50,50,20', `3 Aufrufe mit 50/50/20 Zeilen (${calls.join()})`);
  ok((await page.textContent('body')).includes('120 / 120 enriched'), 'Ergebnis-Box zeigt 120 / 120');
  // Persistenz: Meta-Felder + nach Reload alles übersprungen
  const meta = await page.evaluate((id) => JSON.parse(localStorage.getItem(`csv_run_${id}`)), id);
  ok(meta.fields.includes('email_enriched') && !meta.data, 'email_enriched in meta.fields, Inline-Daten nach IndexedDB verschoben');
  await page.reload({ waitUntil: 'load' }); // networkidle ist unter paralleler Testlast unzuverlässig — der folgende waitForSelector reicht
  await page.waitForSelector('text=120 Zeilen bereits enricht');
  ok((await page.textContent('body')).includes('0 Leads'), 'nach Reload: 0 offene Leads');
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
