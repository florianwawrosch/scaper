// «+ KI-Spalte»-Menü: LinkedIn-Spalte auf Meta-Daten ausgegraut (Eingabespalten fehlen),
// gespeicherte KI-Spalte lädt EINE Tabellenspalte und ist danach gesperrt (✓ in Tabelle),
// «Neue KI-Spalte» legt eine leere Spalte an und öffnet ⚙, «direkt ausfüllen» startet die KI
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await login(page);
  let aiCalls = 0;
  await page.route('**/api/ai/analyze', async route => {
    aiCalls++;
    const body = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: body.prompts.map(() => 'ja') }) });
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const id = 'csv_menu_' + Date.now();
  await page.evaluate((id) => {
    localStorage.clear();
    localStorage.setItem('appSettings', JSON.stringify({ apiKeys: { meta_ads: '', openai: '', gemini: '', anthropic: 'k', hunter_io: '', findymail: '' }, theme: 'noir' }));
    localStorage.setItem('user_presets', JSON.stringify([
      { id: 'user_a', name: 'ki_a', columns: [{ name: 'ki_a', prompt: 'A?', provider: 'anthropic', model: 'claude-sonnet-5' }], userDefined: true },
      { id: 'user_b', name: 'ki_b', columns: [{ name: 'ki_b', prompt: 'B?' }], userDefined: true },
    ]));
    localStorage.setItem('preset_flags', JSON.stringify({ user_b: { autoRun: true } }));
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['page_name', 'ad_text'], filename: 'Meta: test', createdAt: new Date().toISOString(), rowCount: 2, data: [{ page_name: 'A', ad_text: 'x' }, { page_name: 'B', ad_text: 'y' }] }));
  }, id);
  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  ok((await page.locator('button:has-text("Vorlage")').count()) === 0, 'kein separater Vorlage-Button mehr — nur «+ KI-Spalte»');
  await page.waitForSelector('[data-testid="ai-column-menu-btn"]');
  await page.click('[data-testid="ai-column-menu-btn"]');
  await page.waitForSelector('[data-testid="ai-column-menu"]');
  const li = page.locator('[data-testid="preset-row-linkedin_klassifizierung_v5"]');
  ok((await li.innerText()).includes('braucht Spalten: voller_name'), 'LinkedIn-Spalte: fehlende Eingabespalten benannt');
  ok(await li.locator('[data-testid="preset-load-linkedin_klassifizierung_v5"]').isDisabled(), 'LinkedIn-Spalte auf Meta-Daten nicht ladbar');
  ok(!(await li.innerText()).includes('Spalten auf einmal'), 'keine «8 Spalten auf einmal» mehr');
  const ra = page.locator('[data-testid="preset-row-user_a"]');
  ok((await ra.innerText()).includes('Claude · claude-sonnet-5'), 'Zeile zeigt das gespeicherte KI-Modell');
  ok((await page.locator('[data-testid="preset-row-user_b"]').innerText()).includes('▶ füllt sofort aus'), 'Zeile zeigt «direkt ausfüllen»');

  // gespeicherte KI-Spalte laden → genau eine neue Spalte, danach gesperrt
  const thBefore = await page.locator('thead th').count();
  await ra.locator('[data-testid="preset-load-user_a"]').click();
  await page.waitForSelector('th:has-text("ki_a")');
  ok((await page.locator('thead th').count()) === thBefore + 1, 'genau EINE Tabellenspalte angelegt');
  await page.click('[data-testid="ai-column-menu-btn"]');
  await page.waitForSelector('[data-testid="preset-loaded-user_a"]');
  ok((await page.locator('[data-testid="preset-load-user_a"]').count()) === 0, 'geladene KI-Spalte ist gesperrt (✓ in Tabelle)');
  const cfgs = await page.evaluate((id) => JSON.parse(localStorage.getItem(`analysis_configs_${id}`)), id);
  ok(cfgs.length === 1 && cfgs[0].presetId === 'user_a' && cfgs[0].provider === 'anthropic' && cfgs[0].model === 'claude-sonnet-5', 'Config merkt sich Herkunft + Modell');

  // «direkt ausfüllen»: Laden startet die KI sofort
  await page.locator('[data-testid="preset-load-user_b"]').click();
  await page.waitForFunction(() => document.body.innerText.includes('«ki_b»: 2 klassifiziert'), null, { timeout: 15000 });
  ok(aiCalls >= 1, 'ki_b wurde nach dem Laden direkt ausgefüllt');

  // Neue KI-Spalte → leere Spalte + ⚙ offen
  await page.click('[data-testid="ai-column-menu-btn"]');
  await page.click('[data-testid="ai-column-new"]');
  await page.waitForSelector('text=Spalte konfigurieren');
  await page.waitForSelector('th:has-text("Analyse")');
  ok(true, '«Neue KI-Spalte» legt Spalte an und öffnet ⚙');
  await page.locator('span:has-text("Spalte konfigurieren") + button').click(); // ⚙ schließen (liegt sonst über der Toolbar)
  await page.waitForSelector('text=Spalte konfigurieren', { state: 'detached' });
  await page.click('[data-testid="ai-column-menu-btn"]');
  await page.locator('[data-testid="preset-load-keep_drop"]').click();
  await page.waitForSelector('th:has-text("ki_bewertung")');
  ok(true, 'eingebaute KEEP/DROP lädt ohne Nachfrage');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
