// Einstellungen → KI-Spalten (Tabelle): neue anlegen, bearbeiten (Titel/Modell/Version/Prompt),
// doppelte Titel abgelehnt, Schalter, eingebaute anpassen + ↺ Standard, kopieren, löschen
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await login(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.removeItem('user_presets'); localStorage.removeItem('preset_flags'); localStorage.removeItem('preset_overrides'); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('text=KI-Spalten');
  await page.waitForSelector('[data-testid="ai-columns-table"]');
  const presets = () => page.evaluate(() => JSON.parse(localStorage.getItem('user_presets') || '[]'));
  const flags = () => page.evaluate(() => JSON.parse(localStorage.getItem('preset_flags') || '{}'));
  ok((await page.locator('[data-testid="ai-columns-table"] tbody tr').count()) === 2, 'Tabelle: eine Zeile je eingebauter KI-Spalte');
  ok(!(await page.textContent('body')).includes('Spalten auf einmal'), 'kein «8 Spalten auf einmal» mehr');
  ok((await page.locator('[data-testid="tpl-linkedin_klassifizierung_v5"]').innerText()).includes('8 Detail-Spalten'), 'LinkedIn: 1 Spalte + 8 versteckte Detail-Spalten');

  // 3× neue KI-Spalte (oben + unten) — jede eine eigene Zeile, «direkt» standardmäßig an
  await page.click('[data-testid="tpl-new"]');
  await page.click('[data-testid="tpl-new-bottom"]');
  await page.click('[data-testid="tpl-new-bottom"]');
  let p = await presets();
  ok(p.length === 3 && p.every(x => x.columns.length === 1) && p[2].name === 'ki_spalte_3', `3 KI-Spalten angelegt (${p.map(x => x.name).join(', ')})`);
  ok(await page.locator(`[data-testid="tpl-autorun-${p[0].id}"]`).isChecked(), 'neue KI-Spalte: «direkt ausfüllen» an');
  const id = p[0].id;

  // Bearbeiten: Titel, Modell, Version, Prompt
  await page.waitForSelector(`[data-testid="tpl-editor-${p[2].id}"]`);
  await page.click(`[data-testid="tpl-edit-${id}"]`);
  await page.waitForSelector(`[data-testid="tpl-editor-${id}"]`);
  await page.fill(`[data-testid="tpl-title-${id}"]`, 'ki_nische');
  await page.selectOption(`[data-testid="tpl-model-${id}"]`, 'anthropic|claude-sonnet-5');
  await page.fill(`[data-testid="tpl-version-${id}"]`, 'v1');
  await page.fill(`[data-testid="tpl-prompt-${id}"]`, 'Welche Nische? Ein Wort.');
  await page.click(`[data-testid="tpl-save-${id}"]`);
  await page.waitForSelector(`[data-testid="tpl-saved-${id}"]`);
  p = await presets();
  const c = p.find(x => x.id === id);
  ok(c.name === 'ki_nische' && c.columns[0].name === 'ki_nische' && c.columns[0].provider === 'anthropic' && c.columns[0].model === 'claude-sonnet-5' && c.columns[0].promptVersion === 'v1' && c.columns[0].prompt === 'Welche Nische? Ein Wort.', 'KI-Spalte gespeichert: Titel, Modell, Version, Prompt');
  const row = await page.locator(`[data-testid="tpl-${id}"]`).innerText();
  ok(row.includes('ki_nische') && row.includes('Claude') && row.includes('claude-sonnet-5') && row.includes('v1') && row.includes('Welche Nische?'), 'Zeile zeigt alle Attribute');

  // Doppelter Titel wird abgelehnt
  const id2 = p[1].id;
  await page.click(`[data-testid="tpl-edit-${id2}"]`);
  await page.fill(`[data-testid="tpl-title-${id2}"]`, 'ki_nische');
  await page.fill(`[data-testid="tpl-prompt-${id2}"]`, 'x');
  await page.click(`[data-testid="tpl-save-${id2}"]`);
  await page.waitForSelector('text=schon vergeben');
  ok(true, 'doppelter Titel abgelehnt');
  await page.click(`[data-testid="tpl-edit-${id2}"]`); // schließen

  // Schalter direkt in der Zeile: CSV an, direkt aus
  await page.click(`[data-testid="tpl-auto-csv-${id}"]`);
  await page.click(`[data-testid="tpl-autorun-${id}"]`);
  await page.waitForTimeout(150);
  let f = await flags();
  ok(f[id]?.autoAdd?.csv === true && !f[id]?.autoRun, 'Schalter: bei CSV an, direkt aus (unabhängig)');

  // Eingebaute anpassen: Titel + Modell, nach Reload sichtbar, ↺ Standard
  await page.click('[data-testid="tpl-edit-keep_drop"]');
  await page.fill('[data-testid="tpl-title-keep_drop"]', 'ki_lead');
  await page.selectOption('[data-testid="tpl-model-keep_drop"]', 'gemini|gemini-2.0-flash');
  await page.click('[data-testid="tpl-save-keep_drop"]');
  await page.waitForSelector('[data-testid="tpl-saved-keep_drop"]');
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('text=KI-Spalten');
  await page.waitForSelector('[data-testid="tpl-keep_drop"]');
  const kd = await page.locator('[data-testid="tpl-keep_drop"]').innerText();
  ok(kd.includes('ki_lead') && kd.includes('Gemini') && kd.includes('angepasst'), 'eingebaute KI-Spalte: Titel + Modell angepasst, nach Reload da');
  const ov = await page.evaluate(() => JSON.parse(localStorage.getItem('preset_overrides') || '{}'));
  ok(ov.keep_drop?.ki_bewertung?.name === 'ki_lead' && ov.keep_drop?.ki_bewertung?.provider === 'gemini', 'Override unter dem Original-Titel abgelegt');
  await page.click('[data-testid="tpl-edit-keep_drop"]');
  await page.click('[data-testid="tpl-reset-keep_drop"]');
  await page.waitForTimeout(150);
  ok((await page.locator('[data-testid="tpl-keep_drop"]').innerText()).includes('ki_bewertung'), '↺ Standard stellt den Titel wieder her');

  // Kopieren → eigene, editierbare KI-Spalte
  await page.click('[data-testid="tpl-copy-keep_drop"]');
  await page.waitForTimeout(150);
  p = await presets();
  const copy = p.find(x => x.name === 'ki_bewertung_kopie');
  ok(!!copy && copy.userDefined && copy.columns[0].prompt.includes('KEEP'), 'Kopie als eigene KI-Spalte angelegt');

  // Löschen (Zeile)
  await page.locator(`[data-testid="tpl-delete-${id}"]`).click();
  await page.locator(`[data-testid="tpl-${id}"] button:has-text("Ja")`).click();
  await page.waitForTimeout(150);
  p = await presets();
  ok(!p.some(x => x.id === id), 'KI-Spalte gelöscht');
  ok(!(await flags())[id], 'Flags der gelöschten KI-Spalte entfernt');
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
