// End-to-end: KI-Spalten — ⚙ «In Einstellungen speichern» mit Instant Load (CSV),
// Settings-Tabelle zeigt die eigene KI-Spalte, neuer CSV-Upload hängt sie
// automatisch an und (autoRun) füllt sie per (gemocktem) /api/ai/analyze aus.
// Danach: «+ KI-Spalte»-Menü lädt eine eingebaute; Settings löscht die eigene.
const { playwright, login, fixture, shot, ok, BASE_URL, DIR } = require('./helpers');
const { chromium } = playwright();
const BASE = BASE_URL;
const S = DIR;
const fs = require('fs');

const PLAIN_CSV = fixture('plain_test.csv');
fs.writeFileSync(PLAIN_CSV, 'page_name,ad_text,email\nCoach Anna,Ich helfe dir beim Abnehmen,anna@x.de\nMaler Bob,Wir streichen Wände,bob@x.de\nYoga Cleo,Yoga für Anfänger,cleo@x.de\n');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await login(page);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/502/.test(m.text())) errors.push('CONSOLE ' + m.text().slice(0, 160)); });
  page.on('response', r => { if (r.status() >= 500 && !r.url().includes('/api/backend/')) errors.push(`HTTP ${r.status()} ${r.url()}`); });

  // Mock-KI: antwortet "ja" für Coaches/Yoga, sonst "nein"
  let aiCalls = 0;
  await page.route('**/api/ai/analyze', async route => {
    const body = JSON.parse(route.request().postData());
    aiCalls++;
    // Entscheidung NUR anhand der Zeile (Name), nicht anhand des Prompt-Texts
    const values = body.prompts.map(p => (/Coach Anna|Yoga Cleo/.test(p) ? 'ja' : 'nein'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values }) });
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('appSettings', JSON.stringify({
      apiKeys: { meta_ads: '', openai: '', gemini: '', anthropic: 'fake-key', hunter_io: '', findymail: '' },
      theme: 'noir',
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });

  // ── 1) Upload ohne LinkedIn-Marker → direkt in den Viewer (kein Modal) ──
  await page.locator('input[type="file"]').setInputFiles(PLAIN_CSV);
  await page.waitForURL(/\/csv\/csv_/, { timeout: 8000 });
  await page.waitForSelector('text=Coach Anna');
  ok(true, 'Upload → Viewer ohne Modal');

  // ── 2) KI-Spalte anlegen, Prompt setzen, in den Einstellungen mit Instant Load (CSV) + autoRun speichern ──
  await page.click('[data-testid="ai-column-menu-btn"]');
  await page.click('[data-testid="ai-column-new"]');
  await page.waitForSelector('text=Spalte konfigurieren');
  const nameInput = page.locator('input[placeholder="Spaltenname"]');
  await nameInput.fill('ki_coach');
  await nameInput.blur();
  await page.locator('textarea[placeholder^="Prompt"]').fill('Ist das ein Coach? Antworte ja oder nein.');
  await page.click('[data-testid="editor-save-template"]');
  await page.waitForSelector('[data-testid="template-save-form"]');
  const form = page.locator('[data-testid="template-save-form"]');
  ok((await form.innerText()).includes('ki_coach'), 'Formular zeigt den Spaltennamen als Titel (kein extra Vorlagenname)');
  await form.locator('label:has-text("CSV/Excel-Upload") input').check();
  await form.locator('label:has-text("direkt ausfüllen") input').check();
  await form.locator('[data-testid="template-save-confirm"]').click();
  await page.waitForSelector('text=KI-Spalte «ki_coach» gespeichert');
  const stored = await page.evaluate(() => ({
    presets: JSON.parse(localStorage.getItem('user_presets') || '[]'),
    flags: JSON.parse(localStorage.getItem('preset_flags') || '{}'),
  }));
  ok(stored.presets.length === 1 && stored.presets[0].name === 'ki_coach' && stored.presets[0].columns[0].name === 'ki_coach' && stored.presets[0].columns[0].provider === 'anthropic', 'user_presets enthält ki_coach mit Modell');
  const cfgSaved = await page.evaluate(() => JSON.parse(localStorage.getItem(`analysis_configs_${location.pathname.split('/csv/')[1]}`))[0]);
  ok(cfgSaved.presetId === stored.presets[0].id, 'Config merkt sich die Herkunft (presetId)');
  const fid = stored.presets[0].id;
  ok(stored.flags[fid]?.autoAdd?.csv === true && stored.flags[fid]?.autoRun === true, 'preset_flags: autoAdd.csv + autoRun');

  // ── 3) Settings → KI-Spalten zeigt die eigene KI-Spalte mit gesetzten Schaltern ──
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.click('text=KI-Spalten');
  await page.waitForSelector(`[data-testid="tpl-${fid}"]`);
  ok(await page.locator(`[data-testid="tpl-auto-csv-${fid}"]`).isChecked(), 'Settings: CSV-Instant-Load angehakt');
  ok(await page.locator(`[data-testid="tpl-autorun-${fid}"]`).isChecked(), 'Settings: direkt ausfüllen angehakt');
  ok(!(await page.locator(`[data-testid="tpl-auto-meta-${fid}"]`).isChecked()), 'Settings: Meta nicht angehakt');
  // Prompt der eigenen KI-Spalte bearbeiten + speichern
  await page.click(`[data-testid="tpl-edit-${fid}"]`);
  await page.fill(`[data-testid="tpl-prompt-${fid}"]`, 'Ist diese Person ein Coach oder Yoga-Lehrer? Antworte ja oder nein.');
  await page.click(`[data-testid="tpl-save-${fid}"]`);
  await page.waitForSelector(`[data-testid="tpl-saved-${fid}"]`);
  const edited = await page.evaluate(() => JSON.parse(localStorage.getItem('user_presets'))[0].columns[0].prompt);
  ok(edited.includes('Yoga-Lehrer'), 'Settings: Prompt der eigenen Vorlage gespeichert');
  await page.screenshot({ path: shot('tpl_settings.png') });

  // ── 4) Neuer Upload → Vorlage wird automatisch angehängt UND ausgefüllt ──
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('input[type="file"]').setInputFiles(PLAIN_CSV);
  await page.waitForURL(/\/csv\/csv_/, { timeout: 8000 });
  await page.waitForSelector('th:has-text("ki_coach")', { timeout: 8000 });
  ok(true, 'Instant Load: ki_coach-Spalte automatisch angehängt');
  await page.waitForFunction(() => document.body.innerText.includes('«ki_coach»: 3 klassifiziert'), null, { timeout: 15000 });
  ok(aiCalls >= 1, `autoRun: KI wurde aufgerufen (${aiCalls} Calls)`);
  const runId = page.url().split('/csv/')[1];
  const persisted = await page.evaluate(async (id) => {
    const meta = JSON.parse(localStorage.getItem(`csv_run_${id}`));
    return { fields: meta.fields, autorunLeft: localStorage.getItem(`autorun_analysis_${id}`) };
  }, runId);
  ok(persisted.fields.includes('ki_coach') && persisted.autorunLeft === null, 'Ergebnisse persistiert, Autorun-Flag entfernt');
  await page.screenshot({ path: shot('tpl_autorun.png') });

  // ── 5) «+ KI-Spalte»-Menü: eigene ist geladen (gesperrt), eingebaute KEEP/DROP laden (ohne ausfüllen) ──
  await page.click('[data-testid="ai-column-menu-btn"]');
  await page.waitForSelector('[data-testid="ai-column-menu"]');
  const menuText = await page.locator('[data-testid="ai-column-menu"]').innerText();
  ok(menuText.includes('ki_coach') && menuText.includes('⚡ CSV') && menuText.includes('▶ füllt sofort aus'), 'Menü zeigt eigene KI-Spalte mit ⚡ CSV + ▶');
  ok((await page.locator(`[data-testid="preset-loaded-${fid}"]`).count()) === 1, 'automatisch geladene KI-Spalte ist im Menü gesperrt');
  await page.screenshot({ path: shot('tpl_menu.png') });
  await page.click('[data-testid="preset-load-keep_drop"]');
  await page.waitForSelector('th:has-text("ki_bewertung")');
  ok(true, 'Vorlage-Menü: ki_bewertung angehängt');
  // Zweiter Lauf persistiert und darf ki_coach NICHT aus der CSV verdrängen
  const before = aiCalls;
  await page.click('[data-testid="ai-column-menu-btn"]');
  await page.click('[data-testid="ai-column-menu-btn"]'); // schließen
  const header = page.locator('th:has-text("ki_bewertung")');
  await header.hover();
  await header.locator('button[title*="nalys"], button:has-text("▶")').first().click();
  await page.waitForFunction(() => document.body.innerText.includes('«ki_bewertung»: 3 klassifiziert'), null, { timeout: 15000 });
  ok(aiCalls > before, 'ki_bewertung per ▶ ausgefüllt');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Coach Anna');
  const cells = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim().replace(/\s+/g, ' ')));
    return rows;
  });
  const flat = cells.flat().join(' ');
  const headers = await page.evaluate(() => [...document.querySelectorAll('thead th')].map(th => th.innerText.trim().replace(/\s+/g, ' ')));
  const kiIdx = headers.findIndex(h => h.toLowerCase().includes('ki_coach'));
  const kbIdx = headers.findIndex(h => h.toLowerCase().includes('ki_bewertung'));
  const kiVals = cells.map(r => r[kiIdx]);
  const kbVals = cells.map(r => r[kbIdx]);
  ok(kiVals.join(',') === 'ja,nein,ja', `nach Reload: ki_coach-Werte noch da (kein Überschreiben durch 2. Lauf) — ki_coach=${kiVals.join(',')}`);
  ok(kbVals.join(',') === 'ja,nein,ja', `nach Reload: ki_bewertung-Werte da — ki_bewertung=${kbVals.join(',')}`);
  void flat;
  const metaFields = await page.evaluate((id) => JSON.parse(localStorage.getItem(`csv_run_${id}`)).fields, runId);
  ok(metaFields.includes('ki_coach') && metaFields.includes('ki_bewertung'), `meta.fields enthält beide KI-Spalten: ${metaFields.join(',')}`);

  // ── 6) Settings: KI-Spalte löschen ──
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.click('text=KI-Spalten');
  await page.waitForSelector(`[data-testid="tpl-${fid}"]`);
  await page.locator(`[data-testid="tpl-${fid}"] [data-testid="tpl-delete-${fid}"]`).click();
  await page.locator(`[data-testid="tpl-${fid}"] button:has-text("Ja")`).click();
  await page.waitForTimeout(300);
  ok((await page.locator(`[data-testid="tpl-${fid}"]`).count()) === 0, 'Settings: eigene Vorlage gelöscht');
  const after = await page.evaluate(() => ({ p: JSON.parse(localStorage.getItem('user_presets') || '[]').length, f: Object.keys(JSON.parse(localStorage.getItem('preset_flags') || '{}')).length }));
  ok(after.p === 0 && after.f === 0, 'user_presets + preset_flags geleert');

  // ── 7) «+ Neue KI-Spalte» in Settings öffnet den Editor ──
  await page.click('[data-testid="tpl-new"]');
  await page.waitForSelector('[data-testid^="tpl-editor-"]');
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('user_presets')).length)) === 1, 'Settings: Neue KI-Spalte angelegt');

  ok(errors.length === 0, `keine Page/Console-Errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
